/**
 * GET /api/agents/:agentId — Public stats for a single agent.
 *
 * No auth required. Returns agent profile + signal summary stats.
 * Does NOT return signals (those are behind x402 paywall).
 */

import { getDB } from "@/db"
import { agents, signals } from "@/db/schema"
import { getCurrentEpoch } from "@/lib/epochs"
import { eq, sql, and } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const db = getDB()
  const epoch = await getCurrentEpoch(db)

  const [agent] = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      pricePerQuery: agents.pricePerQuery,
      totalSignals: agents.totalSignals,
      winRate: agents.winRate,
      avgPnl: agents.avgPnl,
      score: agents.score,
      createdAt: agents.createdAt,
      registrationTx: agents.registrationTx,
    })
    .from(agents)
    .where(eq(agents.id, agentId))

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signals)
    .where(and(eq(signals.agentId, agentId), eq(signals.epochId, epoch.id), eq(signals.status, "active")))

  return NextResponse.json({
    epoch: { id: epoch.id, name: epoch.name, endsAt: epoch.endsAt },
    agent: {
      ...agent,
      activeSignals: activeCount?.count ?? 0,
    },
  })
}
