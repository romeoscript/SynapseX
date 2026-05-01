/**
 * Signal Resolver Service
 *
 * Independent service that monitors active signals and resolves them
 * when take-profit, stop-loss, or expiry conditions are met.
 *
 * Direct DB access — no dependency on the arena API.
 * Runs on a 5-minute interval. Deployed as a standalone Railway service.
 *
 * Required env:
 *   DATABASE_URL       — PostgreSQL connection string
 *   OKX_API_KEY        — OKX Web3 API key
 *   OKX_SECRET_KEY     — OKX HMAC secret
 *   OKX_PASSPHRASE     — OKX passphrase
 *   OKX_PROJECT_ID     — OKX project ID (optional)
 */

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq, and } from "drizzle-orm"
import { createHmac } from "crypto"
import {
  pgTable, text, integer, doublePrecision, serial, index,
} from "drizzle-orm/pg-core"

// ── Schema (inlined — no arena dependency) ──

const epochs = pgTable("epochs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status").default("active").notNull(),
})

const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  apiKey: text("api_key").notNull().unique(),
  pricePerQuery: doublePrecision("price_per_query").notNull(),
  totalSignals: integer("total_signals").default(0).notNull(),
  winRate: doublePrecision("win_rate").default(0).notNull(),
  avgPnl: doublePrecision("avg_pnl").default(0).notNull(),
  score: doublePrecision("score").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  registrationTx: text("registration_tx").notNull(),
})

const signals = pgTable("signals", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  epochId: integer("epoch_id").notNull().references(() => epochs.id),
  timestamp: text("timestamp").notNull(),
  token: text("token").notNull(),
  tokenAddress: text("token_address").notNull(),
  pair: text("pair").notNull(),
  type: text("type").default("spot").notNull(),
  action: text("action").notNull(),
  tradeTxHash: text("trade_tx_hash").unique(),
  tradeAmount: doublePrecision("trade_amount"),
  marketPrice: doublePrecision("market_price").notNull(),
  takeProfit: doublePrecision("take_profit").notNull(),
  stopLoss: doublePrecision("stop_loss").notNull(),
  confidence: integer("confidence").notNull(),
  reasoning: text("reasoning"),
  validFor: text("valid_for").default("24h").notNull(),
  indicators: text("indicators"),
  status: text("status").default("active").notNull(),
  currentPrice: doublePrecision("current_price"),
  pnl: doublePrecision("pnl"),
  resolvedAt: text("resolved_at"),
}, (t) => ({
  agentIdIdx: index("signals_agent_id_idx").on(t.agentId),
  timestampIdx: index("signals_timestamp_idx").on(t.timestamp),
}))

const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  agentId: text("agent_id"),
  data: text("data"),
  txHash: text("tx_hash"),
  createdAt: text("created_at").notNull(),
})

// ── OKX Market Client (HMAC-authenticated) ──

const OKX_BASE = "https://web3.okx.com"
let timeOffset = 0
let synced = false

async function syncTime(): Promise<void> {
  try {
    const before = Date.now()
    const res = await fetch(`${OKX_BASE}/api/v5/public/time`)
    const data = (await res.json()) as { data: Array<{ ts: string }> }
    const latency = (Date.now() - before) / 2
    timeOffset = Number(data.data[0].ts) - Date.now() + latency
  } catch {
    console.warn("  Clock sync failed, using local time")
  }
}

async function okxFetch<T>(method: "GET", path: string): Promise<T> {
  if (!synced) { await syncTime(); synced = true; setInterval(syncTime, 30_000) }

  const timestamp = new Date(Date.now() + timeOffset).toISOString()
  const secret = process.env.OKX_SECRET_KEY!
  const signature = createHmac("sha256", secret).update(timestamp + method + path).digest("base64")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
  }
  if (process.env.OKX_PROJECT_ID) headers["OK-ACCESS-PROJECT"] = process.env.OKX_PROJECT_ID

  const res = await fetch(`${OKX_BASE}${path}`, { method, headers })
  if (!res.ok) throw new Error(`OKX ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

type OKXCandle = [string, string, string, string, string, string, string, string]

async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  try {
    const path = `/api/v6/dex/market/candles?chainIndex=196&tokenContractAddress=${tokenAddress}&bar=1m&limit=1`
    const data = await okxFetch<{ code: string; data: OKXCandle[] }>("GET", path)
    if (data.code !== "0" || !data.data?.length) return null
    return Number(data.data[0][4]) // close price
  } catch {
    return null
  }
}

// ── Resolution Logic ──

function parseValidFor(validFor: string): number {
  const match = validFor.match(/^(\d+)(h|d)$/)
  if (!match) return 24 * 60 * 60 * 1000
  const [, n, unit] = match
  return unit === "d" ? Number(n) * 86_400_000 : Number(n) * 3_600_000
}

const round = (n: number) => Math.round(n * 100) / 100

async function resolveSignals(db: ReturnType<typeof drizzle>) {
  const active = await db.select().from(signals).where(eq(signals.status, "active"))
  if (active.length === 0) { console.log("  No active signals"); return }

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
    if (price === null) { console.log(`  ${sigs[0].token}: price unavailable`); continue }

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

      // Update current price + PnL for all active signals
      await db.update(signals).set({
        currentPrice: price,
        pnl: round(pnl),
        status: newStatus,
        ...(newStatus !== "active" ? { resolvedAt: new Date().toISOString() } : {}),
      }).where(eq(signals.id, sig.id))

      if (newStatus !== "active") {
        resolved++
        resolvedAgentIds.add(sig.agentId)
        console.log(`  ${sig.token} ${sig.action} → ${newStatus} (PnL: ${round(pnl)}%)`)

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

  // Recalculate agent stats
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
    const normalizedPnl = Math.max(-100, Math.min(100, avgPnl))
    const score = round(winRate * 0.6 + (normalizedPnl + 100) * 0.5 * 0.4)

    await db.update(agents).set({ totalSignals: all.length, winRate, avgPnl, score })
      .where(eq(agents.id, agentId))
    console.log(`  ${agentId.slice(0, 10)}: ${winRate}% WR, ${avgPnl}% PnL, score ${score}`)
  }

  console.log(`  Checked ${active.length}, resolved ${resolved}`)
}

// ── Main Loop ──

const INTERVAL = 5 * 60_000

function ts(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ")
}

async function main() {
  console.log("═══════════════════════════════════════")
  console.log("  Signal Resolver Service")
  console.log(`  Interval: ${INTERVAL / 1000}s`)
  console.log("═══════════════════════════════════════\n")

  const url = process.env.DATABASE_URL
  if (!url) { console.error("DATABASE_URL is required"); process.exit(1) }
  if (!process.env.OKX_API_KEY) { console.error("OKX_API_KEY is required"); process.exit(1) }

  const client = postgres(url)
  const db = drizzle(client)

  const tick = async () => {
    console.log(`[${ts()}] Resolving...`)
    try {
      await resolveSignals(db)
    } catch (err) {
      console.error(`  Error:`, err instanceof Error ? err.message : err)
    }
  }

  await tick()
  setInterval(tick, INTERVAL)
}

main().catch(console.error)
