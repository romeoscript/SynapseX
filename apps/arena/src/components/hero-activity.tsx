"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { relativeTime, shortId, safeParseJSON, type ActivityItem } from "@/lib/format"

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  signal_published: { label: "Signal", icon: "↗", color: "#38BDF8" },
  payment:          { label: "x402",   icon: "$", color: "#F59E0B" },
  agent_registered: { label: "Joined", icon: "→", color: "#34D399" },
  signal_resolved:  { label: "Resolved", icon: "✓", color: "#94A3B8" },
}

const KNOWN_TYPES = new Set(Object.keys(TYPE_CONFIG))

function formatDetail(item: ActivityItem): string {
  const parsed = safeParseJSON(item.data)
  switch (item.type) {
    case "signal_published":
      return `New signal on ${parsed.token || "?"}`
    case "payment": {
      const payer = typeof parsed.payer === "string" ? shortId(parsed.payer) : "agent"
      const count = Number(parsed.signalCount || 1)
      return `${payer} paid ${Number(parsed.amount || 0).toFixed(2)} USDT for ${count} signal${count > 1 ? "s" : ""}`
    }
    case "agent_registered":
      return `${parsed.name || item.agentId || "agent"} registered`
    case "signal_resolved": {
      const pnl = Number(parsed.pnl || 0)
      return `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}% ${parsed.status === "tp_hit" ? "TP hit" : "SL hit"}`
    }
    default:
      return ""
  }
}

const ROW_H = 62
const MAX_VISIBLE = 6
const POLL_INTERVAL = 5000

export function HeroActivity() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const lastTopIdRef = useRef<number | null>(null)
  const initialLoadRef = useRef(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=10")
      if (!res.ok) return
      const json = await res.json()
      const fetched: ActivityItem[] = (json.activity || []).filter(
        (item: ActivityItem) => KNOWN_TYPES.has(item.type)
      )
      const visible = fetched.slice(0, MAX_VISIBLE)
      if (json.agentNames) setAgentNames(json.agentNames)

      if (initialLoadRef.current && visible.length > 1) {
        initialLoadRef.current = false
        const topItem = visible[0]
        setItems(visible.slice(1))
        setTimeout(() => setReady(true), 50)
        setTimeout(() => {
          setItems(visible)
          setHighlightId(topItem.id)
          lastTopIdRef.current = topItem.id
          setTimeout(() => setHighlightId(null), 1800)
        }, 600)
      } else {
        setItems(visible)
        if (!ready) setTimeout(() => setReady(true), 50)
        const topId = visible[0]?.id ?? null
        if (topId && topId !== lastTopIdRef.current) {
          setHighlightId(topId)
          setTimeout(() => setHighlightId(null), 1800)
        }
        lastTopIdRef.current = topId
      }
    } catch { /* retry on next poll */ }
  }, [ready])

  useEffect(() => { fetchActivity() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const interval = setInterval(fetchActivity, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchActivity])

  if (items.length === 0) return null

  return (
    <div className="relative w-full" style={{ height: `${ROW_H * MAX_VISIBLE}px` }}>
      {items.map((item, i) => {
        const config = TYPE_CONFIG[item.type]!
        const detail = formatDetail(item)
        const isHighlighted = item.id === highlightId
        const opacity = Math.max(0.07, 1 - i * 0.17)

        return (
          <div
            key={item.id}
            className={`absolute inset-x-0 ${isHighlighted ? "activity-enter" : ""}`}
            style={{
              top: `${i * ROW_H}px`,
              opacity,
              transition: ready
                ? "top 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.65s ease"
                : "none",
            }}
          >
            <div
              className="mx-1 rounded-lg border px-4 py-3 flex items-center gap-3"
              style={{
                background: isHighlighted ? "rgba(56, 189, 248, 0.05)" : "rgba(7, 16, 28, 0.9)",
                borderColor: isHighlighted ? "rgba(56, 189, 248, 0.25)" : "#162035",
                boxShadow: isHighlighted ? "0 0 18px rgba(56, 189, 248, 0.07)" : "none",
                transition: "background 1.4s ease, border-color 1.4s ease, box-shadow 1.4s ease",
              }}
            >
              {/* Type icon */}
              <span
                className="shrink-0 text-xs font-mono w-5 text-center select-none"
                style={{ color: config.color, fontFamily: "var(--font-dm-mono), monospace" }}
              >
                {config.icon}
              </span>

              {/* Type badge */}
              <span
                className="shrink-0 text-[10px] font-mono font-medium px-2 py-0.5 rounded"
                style={{
                  color: config.color,
                  background: `rgba(${config.color === "#38BDF8" ? "56,189,248" : config.color === "#F59E0B" ? "245,158,11" : config.color === "#34D399" ? "52,211,153" : "148,163,184"}, 0.08)`,
                  border: `1px solid rgba(${config.color === "#38BDF8" ? "56,189,248" : config.color === "#F59E0B" ? "245,158,11" : config.color === "#34D399" ? "52,211,153" : "148,163,184"}, 0.12)`,
                  fontFamily: "var(--font-dm-mono), monospace",
                }}
              >
                {config.label}
              </span>

              {/* Detail */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] truncate"
                  style={{ color: "#94A3B8", fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {detail}
                </p>
              </div>

              {/* Meta */}
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                {item.agentId && (
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "#4A5E7A", fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {agentNames[item.agentId] || shortId(item.agentId)}
                  </span>
                )}
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "#2A3A55", fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {relativeTime(item.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
