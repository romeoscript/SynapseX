export type ActivityItem = {
  id: number
  type: string
  agentId: string | null
  data: string | null
  txHash: string | null
  createdAt: string
}

export function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function shortId(id: string): string {
  if (id.startsWith("0x") && id.length > 16) return `${id.slice(0, 6)}...${id.slice(-4)}`
  return id
}

export function safeParseJSON(data: string | null): Record<string, unknown> {
  if (!data) return {}
  try { return JSON.parse(data) } catch { return {} }
}

export function statusStyle(status: string): string {
  switch (status) {
    case "active": return "text-amber-400 bg-amber-400/10"
    case "tp_hit": return "text-green-400 bg-green-400/10"
    case "sl_hit": return "text-red-400 bg-red-400/10"
    case "expired": return "text-zinc-300 bg-zinc-400/10"
    default: return "text-zinc-400 bg-zinc-500/10"
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "active": return "LIVE"
    case "tp_hit": return "TP HIT"
    case "sl_hit": return "SL HIT"
    case "expired": return "EXPIRED"
    default: return status.toUpperCase()
  }
}
