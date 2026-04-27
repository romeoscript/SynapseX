/**
 * GET /api/activity — Activity feed (latest events).
 *
 * Supports ?limit=N (default 50, max 200).
 * Activity is created server-side by other endpoints (register, publish, signals payment).
 */

import { getDB } from "@/db"
import { activity, agents } from "@/db/schema"
import { desc } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || "50"),
    200,
  )

  const db = getDB()
  const [result, allAgents] = await Promise.all([
    db.select().from(activity).orderBy(desc(activity.id)).limit(limit),
    db.select({ id: agents.id, name: agents.name }).from(agents),
  ])

  const agentNames: Record<string, string> = {}
  for (const a of allAgents) agentNames[a.id] = a.name

  return NextResponse.json({ activity: result, agentNames })
}
