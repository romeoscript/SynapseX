"use client"

import { useEffect, useState, useCallback } from "react"

interface ActivityItem {
  id: number
  type: string
  agentId: string | null
  data: string | null
  txHash: string | null
  createdAt: string
}

type X402Event = {
  id: number
  direction: "received" | "purchased"
  amount: number
  counterparty: string
  signalCount: number
  time: string
}

const monoStyle = { fontFamily: "var(--font-dm-mono), monospace" }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 0) return "now"
  if (seconds < 5) return "now"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function AgentActivityPanel({ agentId }: { agentId: string }) {
  const [events, setEvents] = useState<X402Event[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=200")
      if (!res.ok) return
      const json = await res.json()

      const results: X402Event[] = []
      const aid = agentId.toLowerCase()

      for (const a of (json.activity || []) as ActivityItem[]) {
        if (a.type !== "payment") continue
        let data: Record<string, unknown> = {}
        try { data = JSON.parse(a.data || "{}") } catch { continue }

        const payer = String(data.payer || "").toLowerCase()
        const publisherAgentId = (a.agentId || "").toLowerCase()

        if (publisherAgentId === aid) {
          results.push({
            id: a.id,
            direction: "received",
            amount: Number(data.amount || 0),
            counterparty: payer,
            signalCount: Number(data.signalCount || 0),
            time: a.createdAt,
          })
        } else if (payer === aid) {
          results.push({
            id: a.id,
            direction: "purchased",
            amount: Number(data.amount || 0),
            counterparty: publisherAgentId,
            signalCount: Number(data.signalCount || 0),
            time: a.createdAt,
          })
        }
      }

      setEvents(results.slice(0, 20))
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 5000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#07101C", border: "1px solid #162035" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid #162035" }}
      >
        <h3
          className="text-xs font-mono uppercase tracking-wider font-semibold"
          style={{ color: "#94A3B8", ...monoStyle }}
        >
          x402 Activity
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full pulse-neural" style={{ background: "#38BDF8" }} />
          <span
            className="text-[10px] font-mono"
            style={{ color: "#4A5E7A", ...monoStyle }}
          >
            live
          </span>
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-md shimmer"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p
            className="text-[11px] font-mono text-center py-8"
            style={{ color: "#4A5E7A", ...monoStyle }}
          >
            No x402 transactions yet.
          </p>
        ) : (
          <div className="space-y-0">
            {events.map((ev, i) => {
              const isReceived = ev.direction === "received"
              return (
                <div
                  key={ev.id}
                  className="reveal-left py-2.5 px-1 rounded-md"
                  style={{ animationDelay: `${i * 0.04}s`, borderBottom: "1px solid rgba(22, 32, 53, 0.5)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: isReceived ? "#34D399" : "#F59E0B",
                          background: isReceived ? "rgba(52,211,153,0.08)" : "rgba(245,158,11,0.08)",
                          border: `1px solid ${isReceived ? "rgba(52,211,153,0.14)" : "rgba(245,158,11,0.14)"}`,
                          ...monoStyle,
                        }}
                      >
                        {isReceived ? "RECEIVED" : "PURCHASE"}
                      </span>
                      <span
                        className="text-[11px] font-mono font-semibold"
                        style={{
                          color: isReceived ? "#34D399" : "#F59E0B",
                          ...monoStyle,
                        }}
                      >
                        {isReceived ? "+" : "−"}{ev.amount.toFixed(2)} USDT
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "#2A3A55", ...monoStyle }}
                    >
                      {relativeTime(ev.time)}
                    </span>
                  </div>
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: "#4A5E7A", ...monoStyle }}
                  >
                    {isReceived ? "from " : "to "}
                    <span style={{ color: "#94A3B8" }}>{truncAddr(ev.counterparty)}</span>
                    {" · "}
                    {ev.signalCount} signal{ev.signalCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
