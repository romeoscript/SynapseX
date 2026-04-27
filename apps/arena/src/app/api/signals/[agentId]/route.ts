/**
 * GET /api/signals/[agentId] — Fetch signals for an agent.
 *
 * Conditional x402 payment:
 *   - No new signals since `?since=` → free 200
 *   - New signals exist, no payment → 402 with signal count hint
 *   - New signals exist, valid payment → 200 with signal data
 */

import { paymentRequired, processPayment, attachPaymentResponse } from "@/lib/x402"
import { getDB } from "@/db"
import { agents, signals, activity } from "@/db/schema"
import { getCurrentEpoch } from "@/lib/epochs"
import { eq, gt, and, desc } from "drizzle-orm"
import { USDT_ADDRESS } from "@ethy-arena/shared"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const since = req.nextUrl.searchParams.get("since")

  const db = getDB()

  // Check agent exists
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  // Only return signals from current epoch
  const epoch = await getCurrentEpoch(db)
  const conditions = [eq(signals.agentId, agentId), eq(signals.epochId, epoch.id)]
  if (since) {
    // Look up the timestamp of the since signal to use for cursor pagination
    const [existing] = await db
      .select({ timestamp: signals.timestamp })
      .from(signals)
      .where(and(eq(signals.id, since), eq(signals.agentId, agentId)))
    if (existing) {
      conditions.push(gt(signals.timestamp, existing.timestamp))
    }
    // Unknown cursor → ignored, all signals returned (triggers payment)
  }

  const newSignals = await db
    .select()
    .from(signals)
    .where(and(...conditions))
    .orderBy(desc(signals.timestamp))

  // No new signals → free response
  if (newSignals.length === 0) {
    return NextResponse.json({ newSignals: 0 })
  }

  // New signals exist → require x402 payment
  const paymentConfig = {
    amount: String(Math.round(agent.pricePerQuery * 1_000_000)),
    asset: USDT_ADDRESS,
    payTo: process.env.ARENA_WALLET_ADDRESS!,
    description: `Signal access: ${agent.name}`,
  }

  try {
    const payment = await processPayment(req, paymentConfig)
    if (!payment) {
      // Include count hint in 402 body so client knows there ARE signals
      return paymentRequired(paymentConfig, { newSignals: newSignals.length })
    }

    // Payment successful — log and return signals
    await db.insert(activity).values({
      type: "payment",
      agentId,
      data: JSON.stringify({
        payer: payment.payer,
        amount: agent.pricePerQuery,
        signalCount: newSignals.length,
      }),
      txHash: payment.txHash,
      createdAt: new Date().toISOString(),
    })

    return attachPaymentResponse(
      NextResponse.json({ signals: newSignals }),
      payment,
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment failed" },
      { status: 400 },
    )
  }
}
