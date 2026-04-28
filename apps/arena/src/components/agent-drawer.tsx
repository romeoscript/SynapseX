"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { relativeTime, safeParseJSON } from "@/lib/format"

type AgentDetail = {
  id: string
  name: string
  description: string | null
  pricePerQuery: number
  totalSignals: number
  winRate: number
  avgPnl: number
  score: number
  createdAt: string
  registrationTx: string
  activeSignals: number
}

type FeedEvent = {
  kind: string
  label: string
  detail: string
  status: string
  statusColor: string
  time: string
}

const monoStyle = { fontFamily: "var(--font-dm-mono), monospace" }

export function AgentDrawer({
  agentId,
  onClose,
  allAgentIds,
}: {
  agentId: string
  onClose: () => void
  allAgentIds: string[]
}) {
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  const rank = allAgentIds.indexOf(agentId) + 1

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agents/${agentId}`)
      .then((r) => r.json())
      .then((json) => {
        setAgent(json.agent)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [agentId])

  useEffect(() => {
    fetch("/api/signals-feed")
      .then((r) => r.json())
      .then((json) => {
        const items: FeedEvent[] = []

        for (const s of json.signals || []) {
          if (s.agentId !== agentId) continue
          items.push({
            kind: "signal",
            label: "SIGNAL",
            detail: `${s.action} ${s.pair}${s.pnl !== null ? ` ${s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}%` : ""}`,
            status:
              s.status === "active" ? "LIVE"
              : s.status === "tp_hit" ? "TP HIT"
              : s.status === "sl_hit" ? "SL HIT"
              : "EXPIRED",
            statusColor:
              s.status === "active" ? "amber"
              : s.status === "tp_hit" ? "green"
              : s.status === "sl_hit" ? "red"
              : "muted",
            time: s.timestamp,
          })
        }

        for (const e of json.events || []) {
          if (e.agentId !== agentId) continue
          if (e.type === "agent_registered") {
            items.push({
              kind: "register",
              label: "REGISTER",
              detail: "joined SynapseX",
              status: "CONFIRMED",
              statusColor: "green",
              time: e.createdAt,
            })
          } else if (e.type === "payment") {
            const parsed = safeParseJSON(e.data)
            const payer = typeof parsed.payer === "string"
              ? `${parsed.payer.slice(0, 6)}...${parsed.payer.slice(-4)}`
              : "?"
            const count = Number(parsed.signalCount || 0)
            items.push({
              kind: "payment",
              label: "x402",
              detail: `${payer} read ${count} signal${count !== 1 ? "s" : ""}`,
              status: "PAID",
              statusColor: "amber",
              time: e.createdAt,
            })
          }
        }

        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setEvents(items.slice(0, 10))
      })
      .catch(() => {})
  }, [agentId])

  const statusStyle = (color: string) => {
    const map: Record<string, { color: string; bg: string; border: string }> = {
      amber: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.15)" },
      green: { color: "#34D399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.15)" },
      red:   { color: "#FB7185", bg: "rgba(251,113,133,0.10)", border: "rgba(251,113,133,0.15)" },
      muted: { color: "#4A5E7A", bg: "rgba(74,94,122,0.10)",  border: "rgba(74,94,122,0.15)" },
    }
    return map[color] || map.muted
  }

  const kindColor = (kind: string) => {
    if (kind === "signal") return "#38BDF8"
    if (kind === "register") return "#34D399"
    return "#F59E0B"
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(4, 7, 14, 0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-md z-50 overflow-y-auto slide-in-right"
        style={{ background: "#07101C", borderLeft: "1px solid #162035" }}
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{
            background: "rgba(7, 16, 28, 0.95)",
            borderBottom: "1px solid #162035",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#F59E0B" }}
            />
            <span
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "#4A5E7A", ...monoStyle }}
            >
              Agent Profile
            </span>
          </div>
          <button
            onClick={onClose}
            className="transition-colors p-1 rounded-md"
            style={{ color: "#4A5E7A" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading || !agent ? (
          <div className="p-6 flex items-center justify-center h-40">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(245, 158, 11, 0.2)", borderTopColor: "#F59E0B" }}
            />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Agent info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2
                  className="text-xl font-extrabold"
                  style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {agent.name}
                </h2>
                {rank > 0 && (
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                    style={{
                      color: rank === 1 ? "#F59E0B" : "#4A5E7A",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid #162035",
                      ...monoStyle,
                    }}
                  >
                    #{rank}
                  </span>
                )}
              </div>
              {agent.description && (
                <p className="text-xs" style={{ color: "#4A5E7A" }}>{agent.description}</p>
              )}
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "#2A3A55", ...monoStyle }}
                >
                  {agent.id.slice(0, 6)}...{agent.id.slice(-4)}
                </span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                  style={{
                    color: "#F59E0B",
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.14)",
                    ...monoStyle,
                  }}
                >
                  ${agent.pricePerQuery.toFixed(2)}/query
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: "Win Rate",
                  value: `${agent.winRate.toFixed(1)}%`,
                  color: agent.winRate >= 60 ? "#34D399" : agent.winRate >= 40 ? "#F59E0B" : "#94A3B8",
                },
                {
                  label: "Avg PnL",
                  value: `${agent.avgPnl >= 0 ? "+" : ""}${agent.avgPnl.toFixed(2)}%`,
                  color: agent.avgPnl >= 0 ? "#34D399" : "#FB7185",
                },
                {
                  label: "Score",
                  value: agent.score.toFixed(1),
                  color: "#F59E0B",
                  isScore: true,
                },
                {
                  label: "Signals",
                  value: agent.totalSignals.toString(),
                  color: "#E2E8F0",
                  sub: `${agent.activeSignals} active`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg p-3.5"
                  style={{ background: "#0C1628", border: "1px solid #162035" }}
                >
                  <p
                    className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                    style={{ color: "#4A5E7A", ...monoStyle }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className={`text-2xl font-black font-mono ${stat.isScore ? "score-text" : ""}`}
                    style={!stat.isScore ? { color: stat.color, ...monoStyle } : { ...monoStyle }}
                  >
                    {stat.value}
                  </p>
                  {stat.sub && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "#F59E0B", ...monoStyle }}>
                      {stat.sub}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3
                  className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: "#4A5E7A", ...monoStyle }}
                >
                  Recent Activity
                </h3>
                <div className="h-px flex-1" style={{ background: "#162035" }} />
              </div>

              {events.length === 0 ? (
                <p className="text-xs font-mono" style={{ color: "#4A5E7A", ...monoStyle }}>
                  No activity yet.
                </p>
              ) : (
                <div className="space-y-0">
                  {events.map((ev, i) => {
                    const ss = statusStyle(ev.statusColor)
                    return (
                      <div
                        key={i}
                        className="reveal-left flex items-center justify-between py-2.5"
                        style={{
                          borderBottom: "1px solid rgba(22, 32, 53, 0.7)",
                          animationDelay: `${i * 0.04}s`,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-[10px] font-mono font-medium shrink-0"
                            style={{ color: kindColor(ev.kind), ...monoStyle }}
                          >
                            {ev.label}
                          </span>
                          <span
                            className="text-[10px] font-mono truncate"
                            style={{ color: "#94A3B8", ...monoStyle }}
                          >
                            {ev.detail}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span
                            className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded"
                            style={{ color: ss.color, background: ss.bg, border: `1px solid ${ss.border}`, ...monoStyle }}
                          >
                            {ev.status}
                          </span>
                          <span
                            className="text-[10px] font-mono w-12 text-right"
                            style={{ color: "#2A3A55", ...monoStyle }}
                          >
                            {relativeTime(ev.time)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Link
              href={`/agents/${agent.id}`}
              className="block text-center text-xs font-mono py-2.5 rounded-lg transition-all duration-200"
              style={{
                color: "#F59E0B",
                background: "rgba(245, 158, 11, 0.06)",
                border: "1px solid rgba(245, 158, 11, 0.14)",
                ...monoStyle,
              }}
            >
              View full profile →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
