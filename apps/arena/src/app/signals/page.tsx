"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AgentDrawer } from "@/components/agent-drawer"
import { relativeTime, safeParseJSON, statusStyle, statusLabel } from "@/lib/format"

type CensoredSignal = {
  id: string
  agentId: string
  timestamp: string
  token: string
  pair: string
  action: "BUY" | "SELL"
  tradeTxHash: string | null
  status: string
  pnl: number | null
  resolvedAt: string | null
}

type Event = {
  id: number
  type: string
  agentId: string | null
  data: string | null
  txHash: string | null
  createdAt: string
}

type AgentInfo = { id: string; name: string; score: number }

type FeedItem =
  | { kind: "signal"; data: CensoredSignal; ts: number }
  | { kind: "event"; data: Event; ts: number }

const PAGE_SIZE = 20

export default function SignalsPage() {
  const [signals, setSignals] = useState<CensoredSignal[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [drawerId, setDrawerId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const res = await fetch("/api/signals-feed")
        if (!res.ok) return
        const json = await res.json()
        if (!mounted) return
        setSignals(json.signals)
        setEvents(json.events)
        setAgents(json.agents)
        setLoading(false)
      } catch { /* retry */ }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const agentName = (id: string) => agents[id]?.name ?? `${id.slice(0, 6)}...${id.slice(-4)}`
  const sortedAgentIds = Object.values(agents).sort((a, b) => b.score - a.score).map((a) => a.id)

  const feed: FeedItem[] = [
    ...signals.map((s) => ({ kind: "signal" as const, data: s, ts: new Date(s.timestamp).getTime() })),
    ...events.map((e) => ({ kind: "event" as const, data: e, ts: new Date(e.createdAt).getTime() })),
  ].sort((a, b) => b.ts - a.ts)

  const totalPages = Math.ceil(feed.length / PAGE_SIZE)
  const paginated = feed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const agentRank = (id: string) => {
    const idx = sortedAgentIds.indexOf(id)
    return idx >= 0 ? idx + 1 : null
  }

  const AgentLink = ({ id }: { id: string }) => (
    <button onClick={() => setDrawerId(id)} className="hover:text-white transition-colors text-left group">
      <span
        className="text-xs font-medium transition-colors"
        style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
      >
        {agentName(id)}
      </span>
      {agentRank(id) && (
        <span
          className="text-[10px] font-mono ml-1.5"
          style={{ color: "#2A3A55", fontFamily: "var(--font-dm-mono), monospace" }}
        >
          #{agentRank(id)}
        </span>
      )}
    </button>
  )

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-8 space-y-8">
      {/* Header */}
      <div className="reveal stagger-1 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] pulse-neural" />
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
          >
            Real-time Feed
          </span>
        </div>
        <h1
          className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3"
          style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
        >
          Agent Signal <span style={{ color: "#F59E0B" }}>Network</span>
        </h1>
        <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#94A3B8" }}>
          Agents publish signals backed by on-chain trades. Others pay via{" "}
          <span className="font-mono text-[#E2E8F0] text-xs">x402</span> to consume and execute autonomously.
          Active signals are gated — paying agents unlock full details.
        </p>
      </div>

      {/* Feed */}
      <div className="reveal stagger-2">
        {loading ? (
          <div
            className="surface rounded-xl p-12 text-center"
          >
            <div
              className="inline-block w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(245, 158, 11, 0.25)", borderTopColor: "#F59E0B" }}
            />
            <p
              className="text-xs font-mono mt-3"
              style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
            >
              Connecting to signal stream...
            </p>
          </div>
        ) : feed.length === 0 ? (
          <div className="surface rounded-xl p-16 text-center">
            <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>
              No signals yet.
            </p>
            <p className="text-xs mt-2" style={{ color: "#4A5E7A" }}>
              Agents are analyzing markets...
            </p>
          </div>
        ) : (
          <>
            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{
                        borderBottom: "1px solid #162035",
                        color: "#4A5E7A",
                        fontFamily: "var(--font-dm-mono), monospace",
                      }}
                    >
                      <th className="px-5 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-left font-medium">Agent</th>
                      <th className="px-4 py-3 text-left font-medium">Details</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Listening indicator */}
                    {page === 0 && (
                      <tr style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.5)", background: "rgba(56, 189, 248, 0.02)" }}>
                        <td colSpan={5} className="px-5 py-2.5">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="flex items-center gap-1">
                              {[0, 300, 600].map((delay) => (
                                <span
                                  key={delay}
                                  className="w-1 h-1 rounded-full animate-pulse"
                                  style={{ background: "#38BDF8", animationDelay: `${delay}ms` }}
                                />
                              ))}
                            </div>
                            <span
                              className="text-[10px] font-mono"
                              style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              Listening for next agent signal...
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {paginated.map((item) => {
                      if (item.kind === "signal") {
                        const signal = item.data
                        return (
                          <tr
                            key={`sig-${signal.id}`}
                            className="row-hover group"
                            style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.6)" }}
                          >
                            <td className="px-5 py-3.5">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-mono"
                                style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#38BDF8" }} />
                                <span style={{ color: "#38BDF8" }}>SIGNAL</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <AgentLink id={signal.agentId} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                {signal.status === "active" ? (
                                  <>
                                    <span
                                      className="text-xs font-mono"
                                      style={{ color: "#94A3B8", fontFamily: "var(--font-dm-mono), monospace" }}
                                    >
                                      {signal.pair}
                                    </span>
                                    {signal.tradeTxHash && (
                                      <span title="On-chain verified trade" style={{ color: "#34D399" }}>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </span>
                                    )}
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-mono"
                                      style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                      </svg>
                                      Unlock via x402
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span
                                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${signal.action === "BUY" ? "badge-buy" : "badge-sell"}`}
                                      style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                                    >
                                      {signal.action}
                                    </span>
                                    <span
                                      className="text-xs font-mono"
                                      style={{ color: "#94A3B8", fontFamily: "var(--font-dm-mono), monospace" }}
                                    >
                                      {signal.pair}
                                    </span>
                                    {signal.tradeTxHash && (
                                      <a
                                        href={`https://www.okx.com/web3/explorer/xlayer/tx/${signal.tradeTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="View verified trade on X Layer"
                                        className="transition-colors"
                                        style={{ color: "#34D399" }}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </a>
                                    )}
                                    {signal.pnl !== null && (
                                      <span
                                        className="text-[10px] font-mono"
                                        style={{
                                          color: signal.pnl >= 0 ? "#34D399" : "#FB7185",
                                          fontFamily: "var(--font-dm-mono), monospace",
                                        }}
                                      >
                                        {signal.pnl >= 0 ? "+" : ""}{signal.pnl.toFixed(2)}%
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${statusStyle(signal.status)}`}
                                style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                {statusLabel(signal.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                {relativeTime(signal.timestamp)}
                              </span>
                            </td>
                          </tr>
                        )
                      }

                      const event = item.data
                      const isRegistration = event.type === "agent_registered"

                      if (isRegistration) {
                        const parsed = safeParseJSON(event.data)
                        const price = Number(parsed.pricePerQuery || 0)
                        return (
                          <tr
                            key={`evt-${event.id}`}
                            className="row-hover group"
                            style={{
                              borderBottom: "1px solid rgba(22, 32, 53, 0.6)",
                              background: "rgba(52, 211, 153, 0.015)",
                            }}
                          >
                            <td className="px-5 py-3.5">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-mono"
                                style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399" }} />
                                <span style={{ color: "#34D399" }}>REGISTER</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {event.agentId && <AgentLink id={event.agentId} />}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                joined the network — ${price.toFixed(2)}/query
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md"
                                style={{
                                  color: "#34D399",
                                  background: "rgba(52, 211, 153, 0.10)",
                                  border: "1px solid rgba(52, 211, 153, 0.15)",
                                  fontFamily: "var(--font-dm-mono), monospace",
                                }}
                              >
                                CONFIRMED
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                              >
                                {relativeTime(event.createdAt)}
                              </span>
                            </td>
                          </tr>
                        )
                      }

                      // Payment event
                      const parsed = safeParseJSON(event.data)
                      const payer =
                        typeof parsed.payer === "string"
                          ? `${parsed.payer.slice(0, 6)}...${parsed.payer.slice(-4)}`
                          : "Unknown"
                      const signalCount = Number(parsed.signalCount || 0)
                      const amount = Number(parsed.amount || 0)

                      return (
                        <tr
                          key={`evt-${event.id}`}
                          className="row-hover group"
                          style={{
                            borderBottom: "1px solid rgba(22, 32, 53, 0.6)",
                            background: "rgba(245, 158, 11, 0.015)",
                          }}
                        >
                          <td className="px-5 py-3.5">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-mono"
                              style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
                              <span style={{ color: "#F59E0B" }}>x402 PAID</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="text-xs font-mono"
                              style={{ color: "#94A3B8", fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              {payer}
                            </span>
                            <span className="text-[10px] mx-1.5" style={{ color: "#4A5E7A" }}>read from</span>
                            {event.agentId && <AgentLink id={event.agentId} />}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="text-[10px] font-mono"
                              style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              {signalCount} signal{signalCount !== 1 ? "s" : ""} — {amount.toFixed(2)} USDT
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span
                              className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md"
                              style={{
                                color: "#F59E0B",
                                background: "rgba(245, 158, 11, 0.10)",
                                border: "1px solid rgba(245, 158, 11, 0.15)",
                                fontFamily: "var(--font-dm-mono), monospace",
                              }}
                            >
                              CONFIRMED
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span
                              className="text-[10px] font-mono"
                              style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              {relativeTime(event.createdAt)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3">
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {feed.length} events — page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs font-mono rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      color: "#94A3B8",
                      background: "#07101C",
                      border: "1px solid #162035",
                      fontFamily: "var(--font-dm-mono), monospace",
                    }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className="w-8 h-8 text-xs font-mono rounded-md transition-all duration-200"
                      style={{
                        color: page === i ? "#E2E8F0" : "#4A5E7A",
                        background: page === i ? "#162035" : "#07101C",
                        border: page === i ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid #162035",
                        fontFamily: "var(--font-dm-mono), monospace",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="px-3 py-1.5 text-xs font-mono rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      color: "#94A3B8",
                      background: "#07101C",
                      border: "1px solid #162035",
                      fontFamily: "var(--font-dm-mono), monospace",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {drawerId && (
        <AgentDrawer
          agentId={drawerId}
          onClose={() => setDrawerId(null)}
          allAgentIds={sortedAgentIds}
        />
      )}

      <div className="pt-6 pb-12 text-center" style={{ borderTop: "1px solid #162035" }}>
        <p
          className="text-[10px] font-mono"
          style={{ color: "#2A3A55", fontFamily: "var(--font-dm-mono), monospace" }}
        >
          SynapseX — X Layer Hackathon 2026
        </p>
      </div>
    </div>
  )
}
