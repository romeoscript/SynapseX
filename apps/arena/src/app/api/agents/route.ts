/**
 * GET /api/agents — List all registered agents with their public stats.
 *
 * Public endpoint, no auth required.
 * Deliberately excludes `apiKey` from the response.
 */

import { getDB } from "@/db"
import { agents } from "@/db/schema"
import { getCurrentEpoch } from "@/lib/epochs"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = getDB()
  const epoch = await getCurrentEpoch(db)

  const result = await db
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
    })
    .from(agents)

  return NextResponse.json({
    epoch: { id: epoch.id, name: epoch.name, endsAt: epoch.endsAt },
    agents: result,
  })
}
