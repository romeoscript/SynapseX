"use client"

import { useState } from "react"
import Link from "next/link"

type Signal = {
  id: string
  token: string
  action: string
  marketPrice: number
  takeProfit: number
  stopLoss: number
  confidence: number
  validFor: string
  status: string
  pnl: number | null
  currentPrice: number | null
  indicators: string | null
  reasoning: string | null
  tradeTxHash: string | null
  timestamp: string
}

const PAGE_SIZE = 25

const monoStyle = { fontFamily: "var(--font-dm-mono), monospace" }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 0) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentSignalsTable({ signals }: { signals: Signal[] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(signals.length / PAGE_SIZE))
  const paged = signals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const resolvedSignals = paged.filter((s) => s.status !== "active")

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#07101C", border: "1px solid #162035" }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid #162035" }}
      >
        <h2
          className="text-xs font-mono uppercase tracking-wider font-semibold"
          style={{ color: "#94A3B8", ...monoStyle }}
        >
          Signals
        </h2>
        <span
          className="text-[10px] font-mono"
          style={{ color: "#4A5E7A", ...monoStyle }}
        >
          {signals.length} total
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="p-12 text-center">
          <p
            className="text-xs font-mono"
            style={{ color: "#4A5E7A", ...monoStyle }}
          >
            No signals published yet.
          </p>
        </div>
      ) : (
        <>
          {/* Blurred lock preview */}
          <div className="relative">
            <div className="blur-[6px] opacity-25 select-none pointer-events-none">
              <table className="w-full text-sm">
                <tbody>
                  {[0, 1, 2].map((i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.5)" }}>
                      <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: "#E2E8F0" }}>xSOL</td>
                      <td className="px-4 py-3"><span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded badge-buy">BUY</span></td>
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: "#94A3B8" }}>$91.32</td>
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: "#34D399" }}>$94.50</td>
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: "#FB7185" }}>$88.10</td>
                      <td className="px-4 py-3 text-center font-mono text-xs" style={{ color: "#94A3B8" }}>82%</td>
                      <td className="px-4 py-3 text-right text-[10px] font-mono" style={{ color: "#4A5E7A" }}>3h ago</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lock overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: "rgba(7, 16, 28, 0.7)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.18)" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#38BDF8" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p
                className="text-[11px] font-mono mb-3 text-center"
                style={{ color: "#4A5E7A", ...monoStyle }}
              >
                Unlock direction, TP, SL, confidence &amp; reasoning via x402
              </p>
              <Link
                href="/docs"
                className="text-xs font-mono font-semibold px-4 py-1.5 rounded-lg transition-all duration-200 hover:opacity-90"
                style={{
                  color: "#F59E0B",
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.18)",
                  ...monoStyle,
                }}
              >
                Access via x402 →
              </Link>
            </div>
          </div>

          {/* Resolved signals */}
          {resolvedSignals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{
                      borderBottom: "1px solid #162035",
                      color: "#4A5E7A",
                      ...monoStyle,
                    }}
                  >
                    <th className="px-4 py-2.5 text-left font-medium">Token</th>
                    <th className="px-4 py-2.5 text-left font-medium">Side</th>
                    <th className="px-4 py-2.5 text-right font-medium">Market</th>
                    <th className="px-4 py-2.5 text-center font-medium">Valid</th>
                    <th className="px-4 py-2.5 text-right font-medium">Result</th>
                    <th className="px-4 py-2.5 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedSignals.map((sig) => {
                    const isTpHit = sig.status === "tp_hit"
                    const isSlHit = sig.status === "sl_hit"
                    const resultColor = isTpHit ? "#34D399" : isSlHit ? "#FB7185" : "#94A3B8"
                    const resultBg = isTpHit ? "rgba(52,211,153,0.10)" : isSlHit ? "rgba(251,113,133,0.10)" : "rgba(148,163,184,0.08)"

                    const pnlDisplay =
                      sig.pnl != null
                        ? `${sig.pnl >= 0 ? "+" : ""}${sig.pnl.toFixed(2)}%`
                        : isTpHit ? "TP HIT" : isSlHit ? "SL HIT" : "EXPIRED"

                    return (
                      <tr
                        key={sig.id}
                        className="row-hover"
                        style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.5)" }}
                      >
                        <td
                          className="px-4 py-2.5 font-mono text-xs font-semibold"
                          style={{ color: "#E2E8F0", ...monoStyle }}
                        >
                          {sig.token}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${sig.action === "BUY" ? "badge-buy" : "badge-sell"}`}
                            style={monoStyle}
                          >
                            {sig.action}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-right font-mono text-xs"
                          style={{ color: "#94A3B8", ...monoStyle }}
                        >
                          ${sig.marketPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: "#4A5E7A", ...monoStyle }}
                          >
                            {sig.validFor}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                            style={{ color: resultColor, background: resultBg, ...monoStyle }}
                          >
                            {pnlDisplay}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-right text-[10px] font-mono"
                          style={{ color: "#4A5E7A", ...monoStyle }}
                        >
                          {relativeTime(sig.timestamp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: "1px solid #162035" }}
            >
              <span
                className="text-[10px] font-mono"
                style={{ color: "#4A5E7A", ...monoStyle }}
              >
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    color: "#94A3B8",
                    background: "#0C1628",
                    border: "1px solid #162035",
                    ...monoStyle,
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    color: "#94A3B8",
                    background: "#0C1628",
                    border: "1px solid #162035",
                    ...monoStyle,
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
  )
}
