import { pgTable, text, integer, doublePrecision, serial, index } from "drizzle-orm/pg-core"

export const epochs = pgTable("epochs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Season 1", "Season 2", ...
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status").default("active").notNull(), // "active" | "completed" | "upcoming"
})

export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // wallet address (lowercase)
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

export const signals = pgTable("signals", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  epochId: integer("epoch_id")
    .notNull()
    .references(() => epochs.id),
  timestamp: text("timestamp").notNull(),
  token: text("token").notNull(),
  tokenAddress: text("token_address").notNull(),
  pair: text("pair").notNull(),
  type: text("type").default("spot").notNull(),
  action: text("action").notNull(), // "BUY" | "SELL"
  tradeTxHash: text("trade_tx_hash").unique(), // on-chain swap TX (optional — verified if provided)
  tradeAmount: doublePrecision("trade_amount"), // token amount from TX receipt (auto-extracted)
  marketPrice: doublePrecision("market_price").notNull(), // verified price at publish time
  takeProfit: doublePrecision("take_profit").notNull(),
  stopLoss: doublePrecision("stop_loss").notNull(),
  confidence: integer("confidence").notNull(),
  reasoning: text("reasoning"),
  validFor: text("valid_for").default("24h").notNull(), // "4h" | "24h" | "7d" etc.
  indicators: text("indicators"), // JSON: { rsi, atr, volumeChange, regime }
  status: text("status").default("active").notNull(), // "active" | "tp_hit" | "sl_hit" | "expired"
  currentPrice: doublePrecision("current_price"),
  pnl: doublePrecision("pnl"),
  resolvedAt: text("resolved_at"),
}, (t) => ({
  agentIdIdx: index("signals_agent_id_idx").on(t.agentId),
  timestampIdx: index("signals_timestamp_idx").on(t.timestamp),
}))

export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // ActivityType
  agentId: text("agent_id"),
  data: text("data"), // JSON string
  txHash: text("tx_hash"),
  createdAt: text("created_at").notNull(),
})
