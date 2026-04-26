import { epochs } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { DB } from "@/db"

export type EpochRow = typeof epochs.$inferSelect

export async function getCurrentEpoch(db: DB): Promise<EpochRow> {
  const [epoch] = await db
    .select()
    .from(epochs)
    .where(eq(epochs.status, "active"))

  if (!epoch) throw new Error("No active epoch found")
  return epoch
}

export function getEpochTimeRemaining(epoch: EpochRow): {
  days: number
  hours: number
  totalMs: number
} {
  const ms = new Date(epoch.endsAt).getTime() - Date.now()
  if (ms <= 0) return { days: 0, hours: 0, totalMs: 0 }
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return { days, hours, totalMs: ms }
}
