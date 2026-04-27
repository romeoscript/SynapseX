/**
 * GET /api/signals-feed — Public feed of signals + consumer activity.
 *
 * Returns censored signals (no TP/SL/confidence/reasoning) and
 * recent payment activity (who read whose signals).
 */

import { getDB } from "@/db"
import { signals, agents, activity } from "@/db/schema"
import { desc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = getDB()

  // All signals (cumulative, no epoch filter) — censored public info only
  const recentSignals = await db
    .select({
      id: signals.id,
      agentId: signals.agentId,
      timestamp: signals.timestamp,
      token: signals.token,
      pair: signals.pair,
      action: signals.action,
      tradeTxHash: signals.tradeTxHash,
      status: signals.status,
      pnl: signals.pnl,
      resolvedAt: signals.resolvedAt,
    })
    .from(signals)
    .orderBy(desc(signals.timestamp))

  // Agent names for display
  const allAgents = await db
    .select({ id: agents.id, name: agents.name, score: agents.score })
    .from(agents)

  const agentMap = Object.fromEntries(allAgents.map((a) => [a.id, a]))

  // x402 events: payments + registrations
  const events = await db
    .select({
      id: activity.id,
      type: activity.type,
      agentId: activity.agentId,
      data: activity.data,
      txHash: activity.txHash,
      createdAt: activity.createdAt,
    })
    .from(activity)
    .where(inArray(activity.type, ["payment", "agent_registered"]))
    .orderBy(desc(activity.id))

  return NextResponse.json({
    signals: recentSignals,
    events,
    agents: agentMap,
  })
}
