export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      {/* Hero skeleton */}
      <div className="space-y-4">
        <div className="h-3 w-28 rounded-full shimmer" />
        <div className="h-12 w-72 rounded-lg shimmer" />
        <div className="h-3 w-96 rounded shimmer opacity-60" />
        <div className="h-3 w-64 rounded shimmer opacity-40" />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 space-y-3"
            style={{ background: "#07101C", border: "1px solid #162035" }}
          >
            <div className="h-2.5 w-16 rounded shimmer" />
            <div className="h-8 w-20 rounded shimmer opacity-60" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#07101C", border: "1px solid #162035" }}
      >
        <div className="px-5 py-3" style={{ borderBottom: "1px solid #162035" }}>
          <div className="h-2.5 w-32 rounded shimmer" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(22, 32, 53, 0.5)" }}
          >
            <div className="h-3 w-6 rounded shimmer" />
            <div className="h-3 w-36 rounded shimmer opacity-60" />
            <div className="flex-1" />
            <div className="h-3 w-14 rounded shimmer opacity-40" />
            <div className="h-3 w-14 rounded shimmer opacity-40" />
          </div>
        ))}
      </div>
    </div>
  )
}
