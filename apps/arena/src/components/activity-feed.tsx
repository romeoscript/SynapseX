"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { relativeTime, shortId, safeParseJSON, type ActivityItem } from "@/lib/format"

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  signal_published: { label: "Signal", icon: "\u2197" },
  payment: { label: "x402", icon: "$" },
  agent_registered: { label: "Joined", icon: "\u2192" },
  signal_resolved: { label: "Resolved", icon: "\u2713" },
}

function ActivityRow({ item, index, isNew, agentNames }: { item: ActivityItem; index: number; isNew: boolean; agentNames: Record<string, string> }) {
  const config = TYPE_CONFIG[item.type] || {
    label: item.type,
    icon: "\u2022",
  }
  const parsed = safeParseJSON(item.data)

  let detail = ""
  if (item.type === "signal_published") {
    detail = `New signal on ${parsed.token || "?"}`
  } else if (item.type === "payment") {
    const payer = typeof parsed.payer === "string" ? shortId(parsed.payer) : "agent"
    detail = `${payer} paid ${Number(parsed.amount || 0).toFixed(2)} USDT for ${parsed.signalCount || 0} signals`
  } else if (item.type === "agent_registered") {
    detail = `${parsed.name || item.agentId} joined`
  } else if (item.type === "signal_resolved") {
    detail = `${parsed.status || ""} ${parsed.pnl != null ? (Number(parsed.pnl) >= 0 ? "+" : "") + Number(parsed.pnl).toFixed(2) + "%" : ""}`
  }

  return (
    <div
      className={`animate-slide-in flex items-start gap-3 py-2.5 border-b border-white/[0.02] last:border-0 group ${isNew ? "feed-item-new" : ""}`}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <span className="font-mono text-[11px] text-white/60 w-5 text-center shrink-0 mt-0.5">
        {config.icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-medium px-1.5 py-px rounded text-zinc-400 bg-white/[0.03] border border-white/[0.05]">
            {config.label}
          </span>
          {item.agentId && (
            <span className="text-[10px] text-white/60 font-mono truncate">
              {agentNames[item.agentId] || shortId(item.agentId)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5 truncate group-hover:text-zinc-300 transition-colors">
          {detail}
        </p>
      </div>
      <span className="text-[10px] text-white/60 font-mono shrink-0">
        {relativeTime(item.createdAt)}
      </span>
    </div>
  )
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const prevIdsRef = useRef<Set<number>>(new Set())
  const [newIds, setNewIds] = useState<Set<number>>(new Set())

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=30")
      if (res.ok) {
        const json = await res.json()
        const knownTypes = new Set(Object.keys(TYPE_CONFIG))
        const fetched: ActivityItem[] = (json.activity || [])
          .filter((item: ActivityItem) => knownTypes.has(item.type))

        const currentIds = new Set(fetched.map((i) => i.id))
        if (prevIdsRef.current.size > 0) {
          const fresh = new Set<number>()
          for (const id of currentIds) {
            if (!prevIdsRef.current.has(id)) fresh.add(id)
          }
          if (fresh.size > 0) {
            setNewIds(fresh)
            setTimeout(() => setNewIds(new Set()), 1500)
          }
        }
        prevIdsRef.current = currentIds

        setItems(fetched)
        if (json.agentNames) setAgentNames(json.agentNames)
      }
    } catch {
      /* network error — retry on next poll */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 5000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-xs font-mono text-zinc-300 uppercase tracking-wider font-medium">
            Activity
          </h3>
          <div className="h-px w-6 bg-gradient-to-r from-zinc-700 to-transparent" />
        </div>
        <div className="flex items-center gap-2 px-2 py-0.5 rounded-full border border-violet-500/10 bg-violet-500/[0.04]">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" />
          <span className="text-[10px] text-violet-400/70 font-mono uppercase tracking-wider">live</span>
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="space-y-2.5 py-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-shimmer rounded-lg"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-3">
              <span className="text-white/60 text-sm font-mono">~</span>
            </div>
            <p className="text-[11px] text-white/60 font-mono">
              Waiting for activity...
            </p>
          </div>
        ) : (
          <div className="max-h-[540px] overflow-y-auto">
            {items.map((item, i) => (
              <ActivityRow
                key={item.id}
                item={item}
                index={i}
                isNew={newIds.has(item.id)}
                agentNames={agentNames}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <div className="px-4 py-2.5 border-t border-white/[0.03] flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/60">
            {items.length} events
          </span>
          <span className="text-[10px] font-mono text-white/60">
            polling 5s
          </span>
        </div>
      )}
    </div>
  )
}
