import { NextResponse } from "next/server"
import { getDB } from "@/db"
import { signals, agents, epochs, activity } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { createHmac } from "crypto"

const OKX_BASE = "https://web3.okx.com"

type OKXCandle = [string, string, string, string, string, string, string, string]

async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  try {
    const timestamp = new Date().toISOString()
    const path = `/api/v6/dex/market/candles?chainIndex=196&tokenContractAddress=${tokenAddress}&bar=1m&limit=1`
    const secret = process.env.OKX_SECRET_KEY!
    const signature = createHmac("sha256", secret).update(timestamp + "GET" + path).digest("base64")

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
    }
    if (process.env.OKX_PROJECT_ID) headers["OK-ACCESS-PROJECT"] = process.env.OKX_PROJECT_ID

    const res = await fetch(`${OKX_BASE}${path}`, { headers })
    const data = await res.json() as { code: string; data: OKXCandle[] }
    if (data.code !== "0" || !data.data?.length) return null
    return Number(data.data[0][4])
  } catch {
    return null
  }
}

function parseValidFor(validFor: string): number {
  const match = validFor.match(/^(\d+)(h|d)$/)
  if (!match) return 24 * 60 * 60 * 1000
  const [, n, unit] = match
  return unit === "d" ? Number(n) * 86_400_000 : Number(n) * 3_600_000
}

const round = (n: number) => Math.round(n * 100) / 100

export async function GET(req: Request) {
  // Verify Vercel cron secret in production
  const authHeader = req.headers.get("authorization")
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDB()
  const active = await db.select().from(signals).where(eq(signals.status, "active"))

  if (active.length === 0) {
    return NextResponse.json({ resolved: 0, checked: 0 })
  }

  // Group by token to minimize API calls
  const byToken = new Map<string, typeof active>()
  for (const sig of active) {
    const group = byToken.get(sig.tokenAddress) || []
    group.push(sig)
    byToken.set(sig.tokenAddress, group)
  }

  let resolved = 0
  const resolvedAgentIds = new Set<string>()

  for (const [tokenAddress, sigs] of byToken) {
    const price = await getCurrentPrice(tokenAddress)
    if (price === null) continue

    for (const sig of sigs) {
      const pnl = sig.action === "BUY"
        ? ((price - sig.marketPrice) / sig.marketPrice) * 100
        : ((sig.marketPrice - price) / sig.marketPrice) * 100

      let newStatus = "active"
      if (sig.action === "BUY") {
        if (price >= sig.takeProfit) newStatus = "tp_hit"
        else if (price <= sig.stopLoss) newStatus = "sl_hit"
      } else {
        if (price <= sig.takeProfit) newStatus = "tp_hit"
        else if (price >= sig.stopLoss) newStatus = "sl_hit"
      }

      const age = Date.now() - new Date(sig.timestamp).getTime()
      if (newStatus === "active" && age > parseValidFor(sig.validFor)) newStatus = "expired"

      await db.update(signals).set({
        currentPrice: price,
        pnl: round(pnl),
        status: newStatus,
        ...(newStatus !== "active" ? { resolvedAt: new Date().toISOString() } : {}),
      }).where(eq(signals.id, sig.id))

      if (newStatus !== "active") {
        resolved++
        resolvedAgentIds.add(sig.agentId)
        await db.insert(activity).values({
          type: "signal_resolved",
          agentId: sig.agentId,
          data: JSON.stringify({
            signalId: sig.id, token: sig.token, status: newStatus,
            marketPrice: sig.marketPrice, exitPrice: price, pnl: round(pnl),
          }),
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  // Recalculate agent stats for affected agents
  for (const agentId of resolvedAgentIds) {
    const [epoch] = await db.select().from(epochs).where(eq(epochs.status, "active"))
    if (!epoch) continue

    const all = await db.select().from(signals)
      .where(and(eq(signals.agentId, agentId), eq(signals.epochId, epoch.id)))
    const closed = all.filter((s) => s.status !== "active")
    if (closed.length === 0) continue

    const wins = closed.filter(
      (s) => s.status === "tp_hit" || (s.status === "expired" && (s.pnl || 0) > 0),
    ).length
    const winRate = round((wins / closed.length) * 100)
    const avgPnl = round(closed.reduce((sum, s) => sum + (s.pnl || 0), 0) / closed.length)
    const score = round(winRate * 0.6 + (Math.max(-100, Math.min(100, avgPnl)) + 100) * 0.5 * 0.4)

    await db.update(agents).set({ totalSignals: all.length, winRate, avgPnl, score })
      .where(eq(agents.id, agentId))
  }

  return NextResponse.json({ resolved, checked: active.length })
}
