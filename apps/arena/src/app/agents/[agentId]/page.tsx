import Link from "next/link"
import { notFound } from "next/navigation"
import { getDB } from "@/db"
import { agents, signals, activity } from "@/db/schema"
import { eq, desc, sql, and } from "drizzle-orm"
import { AgentSignalsTable } from "@/components/agent-signals-table"
import { AgentActivityPanel } from "@/components/agent-activity-panel"

export const dynamic = "force-dynamic"

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const monoStyle = { fontFamily: "var(--font-dm-mono), monospace" }

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const db = getDB()

  const [agent] = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      pricePerQuery: agents.pricePerQuery,
      totalSignals: agents.totalSignals,
      winRate: agents.winRate,
      avgPnl: agents.avgPnl,
      createdAt: agents.createdAt,
      registrationTx: agents.registrationTx,
    })
    .from(agents)
    .where(eq(agents.id, agentId))

  if (!agent) notFound()

  const allSignals = await db
    .select()
    .from(signals)
    .where(eq(signals.agentId, agentId))
    .orderBy(desc(signals.timestamp))

  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signals)
    .where(and(eq(signals.agentId, agentId), eq(signals.status, "active")))

  const allAgentScores = await db
    .select({ id: agents.id, score: agents.score })
    .from(agents)
    .orderBy(desc(agents.score))
  const rank = allAgentScores.findIndex((a) => a.id === agentId) + 1

  const paymentActivities = await db
    .select({ data: activity.data })
    .from(activity)
    .where(and(eq(activity.type, "payment"), eq(activity.agentId, agentId)))

  let totalEarnings = 0
  const uniqueBuyers = new Set<string>()
  for (const pa of paymentActivities) {
    if (!pa.data) continue
    try {
      const d = JSON.parse(pa.data)
      totalEarnings += Number(d.amount || 0)
      if (d.payer) uniqueBuyers.add(String(d.payer).toLowerCase())
    } catch { /* skip */ }
  }

  const perfStats = [
    {
      label: "Win Rate",
      value: `${agent.winRate.toFixed(1)}%`,
      valueColor: agent.winRate >= 60 ? "#34D399" : agent.winRate >= 40 ? "#F59E0B" : "#94A3B8",
    },
    {
      label: "Avg PnL",
      value: `${agent.avgPnl >= 0 ? "+" : ""}${agent.avgPnl.toFixed(2)}%`,
      valueColor: agent.avgPnl >= 0 ? "#34D399" : "#FB7185",
    },
    {
      label: "Total Signals",
      value: agent.totalSignals.toString(),
      valueColor: "#E2E8F0",
    },
    {
      label: "Active Now",
      value: (activeCount?.count ?? 0).toString(),
      valueColor: "#F59E0B",
    },
  ]

  const commerceStats = [
    {
      label: "Earnings",
      value: `$${totalEarnings.toFixed(2)}`,
      sub: "USDT received",
      valueColor: "#34D399",
    },
    {
      label: "Payments",
      value: paymentActivities.length.toString(),
      sub: "x402 transactions",
      valueColor: "#E2E8F0",
    },
    {
      label: "Unique Buyers",
      value: uniqueBuyers.size.toString(),
      sub: "agents / wallets",
      valueColor: "#E2E8F0",
    },
    {
      label: "Price",
      value: `$${agent.pricePerQuery.toFixed(2)}`,
      sub: "per query",
      valueColor: "#F59E0B",
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav
        className="reveal stagger-1 flex items-center gap-2 text-xs font-mono"
        style={{ color: "#4A5E7A", ...monoStyle }}
      >
        <Link href="/" className="transition-colors hover:text-[#94A3B8]">
          SynapseX
        </Link>
        <span>/</span>
        <span style={{ color: "#94A3B8" }}>{agent.name}</span>
      </nav>

      {/* Agent Header */}
      <div className="reveal stagger-2 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl md:text-3xl font-extrabold tracking-tight"
              style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
            >
              {agent.name}
            </h1>
            {rank > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md"
                style={{
                  color: rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#C2722A" : "#4A5E7A",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid #162035",
                  ...monoStyle,
                }}
              >
                #{rank} Global
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs" style={{ color: "#4A5E7A" }}>{agent.description}</p>
          )}
          <div
            className="flex items-center gap-3 text-[10px] font-mono"
            style={{ color: "#2A3A55", ...monoStyle }}
          >
            <span title={agent.id}>{truncateAddress(agent.id)}</span>
            {agent.registrationTx && (
              <a
                href={`https://www.okx.com/web3/explorer/xlayer/tx/${agent.registrationTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#F59E0B]"
              >
                reg tx ↗
              </a>
            )}
          </div>
        </div>
        <div>
          <span
            className="font-mono text-xs font-semibold px-3.5 py-2 rounded-lg"
            style={{
              color: "#F59E0B",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.16)",
              ...monoStyle,
            }}
          >
            ${agent.pricePerQuery.toFixed(2)} / query
          </span>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="reveal stagger-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {perfStats.map((stat, i) => (
          <div
            key={stat.label}
            className={`surface stat-hover rounded-xl p-5 reveal stagger-${i + 3}`}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-2"
              style={{ color: "#4A5E7A", ...monoStyle }}
            >
              {stat.label}
            </p>
            <p
              className="text-2xl md:text-3xl font-black font-mono"
              style={{ color: stat.valueColor, fontFamily: "var(--font-dm-mono), monospace" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* x402 Commerce Stats */}
      <div className="reveal stagger-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {commerceStats.map((stat, i) => (
          <div
            key={stat.label}
            className={`surface stat-hover rounded-xl p-5 reveal stagger-${i + 5}`}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-2"
              style={{ color: "#4A5E7A", ...monoStyle }}
            >
              {stat.label}
            </p>
            <p
              className="text-2xl md:text-3xl font-black font-mono"
              style={{ color: stat.valueColor, fontFamily: "var(--font-dm-mono), monospace" }}
            >
              {stat.value}
            </p>
            <p
              className="text-[10px] font-mono mt-1"
              style={{ color: "#2A3A55", ...monoStyle }}
            >
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Signals + Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 reveal stagger-7">
          <AgentSignalsTable signals={allSignals} />
        </div>
        <div className="reveal stagger-8">
          <AgentActivityPanel agentId={agentId} />
        </div>
      </div>

      <div className="pt-6 pb-12 text-center" style={{ borderTop: "1px solid #162035" }}>
        <p
          className="text-[10px] font-mono"
          style={{ color: "#2A3A55", ...monoStyle }}
        >
          SynapseX — X Layer Hackathon 2026
        </p>
      </div>
    </div>
  )
}
