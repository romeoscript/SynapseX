/**
 * POST /api/publish — Publish a trading signal.
 *
 * Auth: API key via `X-API-Key` header.
 * Rate limited to 10 signals per hour per agent.
 */

import { getDB } from "@/db"
import { agents, signals, activity } from "@/db/schema"
import { getCurrentPrice } from "@/lib/okx-market"
import { getCurrentEpoch } from "@/lib/epochs"
import { verifyTradeTx } from "@/lib/verify-tx"
import { eq, and, gte, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

const MAX_SIGNALS_PER_HOUR = 10

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("X-API-Key")
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing X-API-Key header" },
      { status: 401 },
    )
  }

  const db = getDB()

  // Authenticate agent by API key
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKey, apiKey))
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  // Rate limit: max 10 signals/hour
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signals)
    .where(and(eq(signals.agentId, agent.id), gte(signals.timestamp, oneHourAgo)))

  if (Number(count) >= MAX_SIGNALS_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${MAX_SIGNALS_PER_HOUR} signals per hour` },
      { status: 429 },
    )
  }

  // Parse and validate signal
  const body = await req.json()
  const {
    token,
    tokenAddress,
    pair,
    action,
    tradeTxHash,
    takeProfit,
    stopLoss,
    confidence,
    reasoning,
    validFor,
    indicators,
  } = body

  if (
    !token ||
    !tokenAddress ||
    !pair ||
    !action ||
    !takeProfit ||
    !stopLoss ||
    !confidence
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: token, tokenAddress, pair, action, takeProfit, stopLoss, confidence",
      },
      { status: 400 },
    )
  }

  if (action !== "BUY" && action !== "SELL") {
    return NextResponse.json(
      { error: "action must be BUY or SELL" },
      { status: 400 },
    )
  }

  // If tradeTxHash provided, verify it on-chain
  let tradeAmount: number | null = null
  if (tradeTxHash) {
    // Check tradeTxHash hasn't been used before
    const [existingTx] = await db
      .select({ id: signals.id })
      .from(signals)
      .where(eq(signals.tradeTxHash, tradeTxHash))
    if (existingTx) {
      return NextResponse.json(
        { error: "This trade TX has already been used for a signal" },
        { status: 400 },
      )
    }

    // Verify trade TX on-chain: exists, from agent wallet, recent, correct token
    const txResult = await verifyTradeTx(tradeTxHash, agent.id, tokenAddress)
    if (!txResult.valid) {
      return NextResponse.json(
        { error: `Trade TX verification failed: ${txResult.reason}` },
        { status: 400 },
      )
    }
    tradeAmount = txResult.tokenAmount
  }

  // Validate token exists on X Layer by fetching current market price
  const marketPrice = await getCurrentPrice(tokenAddress)
  if (marketPrice === null) {
    return NextResponse.json(
      { error: "Token not found on X Layer DEX — no market data available for this address" },
      { status: 400 },
    )
  }

  const epoch = await getCurrentEpoch(db)
  const signalId = `SIG-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`

  await db.insert(signals).values({
    id: signalId,
    agentId: agent.id,
    epochId: epoch.id,
    timestamp: new Date().toISOString(),
    token,
    tokenAddress,
    pair,
    type: "spot",
    action,
    tradeTxHash: tradeTxHash || null,
    tradeAmount,
    marketPrice,
    takeProfit,
    stopLoss,
    confidence,
    reasoning: reasoning || "",
    validFor: validFor || "24h",
    indicators: indicators ? (typeof indicators === "string" ? indicators : JSON.stringify(indicators)) : null,
    status: "active",
  })

  // Increment agent's total signal count
  await db
    .update(agents)
    .set({ totalSignals: sql`${agents.totalSignals} + 1` })
    .where(eq(agents.id, agent.id))

  // Log activity
  await db.insert(activity).values({
    type: "signal_published",
    agentId: agent.id,
    data: JSON.stringify({
      signalId,
      token,
      action,
      confidence,
      marketPrice,
    }),
    txHash: tradeTxHash || null,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ signalId, tradeTxHash: tradeTxHash || null, marketPrice })
}
