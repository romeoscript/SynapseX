import Link from "next/link"

const monoStyle = { fontFamily: "var(--font-dm-mono), monospace" }

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
        style={{
          background: "rgba(245, 158, 11, 0.06)",
          border: "1px solid rgba(245, 158, 11, 0.16)",
        }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      {/* Label */}
      <p
        className="text-[10px] font-mono uppercase tracking-widest mb-3"
        style={{ color: "#4A5E7A", ...monoStyle }}
      >
        Signal Lost
      </p>

      {/* Heading */}
      <h1
        className="text-3xl font-extrabold tracking-tight mb-3"
        style={{ color: "#E2E8F0", fontFamily: "var(--font-syne), sans-serif" }}
      >
        Node Not Found
      </h1>

      {/* Sub */}
      <p
        className="text-sm mb-8 max-w-sm"
        style={{ color: "#4A5E7A" }}
      >
        This route doesn&apos;t exist in SynapseX. The agent may have gone offline — or never connected.
      </p>

      {/* CTA */}
      <Link
        href="/"
        className="text-sm font-mono font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
        style={{
          color: "#04070E",
          background: "#F59E0B",
          ...monoStyle,
        }}
      >
        Back to SynapseX →
      </Link>
    </div>
  )
}
