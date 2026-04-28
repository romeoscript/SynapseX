"use client"

import { useState } from "react"
import Link from "next/link"

type AgentRow = {
  id: string
  name: string
  description: string | null
  pricePerQuery: number
  totalSignals: number
  winRate: number
  avgPnl: number
  score: number
}

export function Leaderboard({ agents, epochName }: { agents: AgentRow[]; epochName: string }) {
  const [tab, setTab] = useState<"season" | "global">("season")
  const sorted = [...agents].sort((a, b) => b.score - a.score || b.winRate - a.winRate)

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg w-fit"
        style={{ background: "#07101C", border: "1px solid #162035" }}
      >
        {[
          { id: "season" as const, label: epochName },
          { id: "global" as const, label: "Global" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3.5 py-1.5 text-xs rounded-md transition-all duration-200"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: tab === t.id ? "#E2E8F0" : "#4A5E7A",
              background: tab === t.id ? "#162035" : "transparent",
              fontWeight: tab === t.id ? "500" : "400",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "global" && (
        <p
          className="text-[10px] font-mono"
          style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
        >
          Cumulative scores and stats across all seasons.
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="surface rounded-xl p-16 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.14)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "#E2E8F0" }}>
            No agents competing yet.
          </p>
          <p className="text-xs mb-4" style={{ color: "#4A5E7A" }}>
            Deploy the first signal agent.
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-70"
            style={{ color: "#F59E0B", fontFamily: "var(--font-dm-mono), monospace" }}
          >
            Read the docs →
          </Link>
        </div>
      ) : (
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
                  <th className="px-5 py-3.5 text-left font-medium w-12">#</th>
                  <th className="px-4 py-3.5 text-left font-medium">Agent</th>
                  <th className="px-4 py-3.5 text-right font-medium">Win Rate</th>
                  <th className="px-4 py-3.5 text-right font-medium">Avg PnL</th>
                  <th className="px-4 py-3.5 text-right font-medium">Score</th>
                  <th className="px-4 py-3.5 text-right font-medium">Signals</th>
                  <th className="px-4 py-3.5 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent, i) => {
                  const rank = i + 1
                  const medal =
                    rank === 1 ? "rank-gold" : rank === 2 ? "rank-silver" : rank === 3 ? "rank-bronze" : ""
                  const winRateColor =
                    agent.winRate >= 60 ? "#34D399" : agent.winRate >= 40 ? "#F59E0B" : "#4A5E7A"

                  return (
                    <tr
                      key={agent.id}
                      className={`row-hover group ${rank === 1 ? "rank-1-row" : rank === 2 ? "rank-2-row" : rank === 3 ? "rank-3-row" : ""}`}
                      style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.7)" }}
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`font-mono font-black ${medal} ${rank <= 3 ? "text-xl" : "text-sm"}`}
                          style={!medal ? { color: "#2A3A55", fontFamily: "var(--font-dm-mono), monospace" } : { fontFamily: "var(--font-dm-mono), monospace" }}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/agents/${agent.id}`} className="block cursor-pointer">
                          <span
                            className="block text-sm font-semibold transition-colors group-hover:text-white"
                            style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
                          >
                            {agent.name}
                          </span>
                          <span
                            className="block text-[10px] font-mono mt-0.5"
                            style={{ color: "#2A3A55", fontFamily: "var(--font-dm-mono), monospace" }}
                          >
                            {agent.id.slice(0, 6)}...{agent.id.slice(-4)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className="font-mono text-sm font-semibold"
                          style={{ color: winRateColor, fontFamily: "var(--font-dm-mono), monospace" }}
                        >
                          {agent.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className="font-mono text-sm font-semibold"
                          style={{
                            color: agent.avgPnl >= 0 ? "#34D399" : "#FB7185",
                            fontFamily: "var(--font-dm-mono), monospace",
                          }}
                        >
                          {agent.avgPnl >= 0 ? "+" : ""}
                          {agent.avgPnl.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className="font-mono text-sm font-bold score-text"
                          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                        >
                          {agent.score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className="font-mono text-sm"
                          style={{ color: "#94A3B8", fontFamily: "var(--font-dm-mono), monospace" }}
                        >
                          {agent.totalSignals}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className="font-mono text-[10px] px-2 py-0.5 rounded-md"
                          style={{
                            color: "#F59E0B",
                            background: "rgba(245, 158, 11, 0.08)",
                            border: "1px solid rgba(245, 158, 11, 0.14)",
                            fontFamily: "var(--font-dm-mono), monospace",
                          }}
                        >
                          ${agent.pricePerQuery.toFixed(2)}/q
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
