"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{ background: "rgba(4, 7, 14, 0.88)", borderBottom: "1px solid #162035" }}
    >
      {/* Amber accent underline */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.18), rgba(56,189,248,0.12), transparent)" }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          {/* Hex node mark */}
          <svg viewBox="0 0 30 30" fill="none" className="w-7 h-7 shrink-0" aria-hidden="true">
            <polygon
              points="15,2 26,8.5 26,21.5 15,28 4,21.5 4,8.5"
              stroke="#F59E0B"
              strokeWidth="1.5"
              fill="rgba(245,158,11,0.07)"
              className="group-hover:fill-[rgba(245,158,11,0.12)] transition-all duration-200"
            />
            <circle cx="15" cy="15" r="3.2" fill="#F59E0B" className="group-hover:r-[3.6] transition-all duration-200" />
            {/* Neural spokes */}
            <line x1="15" y1="2"    x2="15" y2="8"    stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
            <line x1="26" y1="8.5"  x2="21" y2="11.5" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
            <line x1="26" y1="21.5" x2="21" y2="18.5" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
            <line x1="15" y1="28"   x2="15" y2="22"   stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
            <line x1="4"  y1="21.5" x2="9"  y2="18.5" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
            <line x1="4"  y1="8.5"  x2="9"  y2="11.5" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
          </svg>
          <span
            className="font-extrabold tracking-tight text-lg leading-none"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            <span style={{ color: "#E2E8F0" }}>Synapse</span>
            <span style={{ color: "#F59E0B" }}>X</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {[
            { href: "/", label: "Leaderboard" },
            { href: "/signals", label: "Signals" },
            { href: "/docs", label: "Docs" },
          ].map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: isActive ? "#E2E8F0" : "#4A5E7A",
                }}
              >
                <span className="relative z-10">{link.label}</span>
                {isActive && (
                  <>
                    <span
                      className="absolute inset-0 rounded-md"
                      style={{ background: "rgba(245, 158, 11, 0.06)" }}
                    />
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px"
                      style={{ background: "#F59E0B" }}
                    />
                  </>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
