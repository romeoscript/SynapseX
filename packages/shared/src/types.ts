export type Agent = {
  id: string // wallet address
  name: string
  description: string
  pricePerQuery: number
  totalSignals: number
  winRate: number
  avgPnl: number
  score: number
  createdAt: string
  registrationTx: string
}

export type Epoch = {
  id: number
  name: string
  startsAt: string
  endsAt: string
  status: "active" | "completed" | "upcoming"
}

export type SignalAction = "BUY" | "SELL"
export type SignalStatus = "active" | "tp_hit" | "sl_hit" | "expired"

export type Signal = {
  id: string
  agentId: string
  epochId: number
  timestamp: string
  token: string
  tokenAddress: string
  pair: string
  type: "spot"
  action: SignalAction
  tradeTxHash: string | null // on-chain swap TX (verified if provided)
  tradeAmount: number | null // token amount from TX receipt
  marketPrice: number // verified price at publish time
  takeProfit: number
  stopLoss: number
  confidence: number
  reasoning: string | null
  validFor: string // "4h" | "24h" | "7d"
  indicators: string | null // JSON: { rsi, atr, volumeChange, regime }
  status: SignalStatus
  currentPrice: number | null
  pnl: number | null
  resolvedAt: string | null
}

export type ActivityType =
  | "signal_published"
  | "payment"
  | "agent_registered"
  | "signal_resolved"

export type Activity = {
  id: number
  type: ActivityType
  agentId: string | null
  data: string
  txHash: string | null
  createdAt: string
}

export type PositionStatus = "open" | "closed_tp" | "closed_sl"

export type Position = {
  signalId: string
  token: string
  tokenAddress: string
  marketPrice: number
  takeProfit: number
  stopLoss: number
  amount: number
  tokenAmount: number
  entryTxHash: string
  status: PositionStatus
  exitPrice?: number
  exitTxHash?: string
  pnl?: number
}

