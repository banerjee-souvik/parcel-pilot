// Shown instantly on navigation while loadTraceDetail() resolves — the shared layout's RunList
// doesn't re-render on a sibling [id] navigation, so without this, switching between runs is a
// silent gap with no feedback until the new trace's data is ready.
export default function TraceDetailLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded bg-bg-subtle" />
          <div className="h-5 w-24 rounded-full bg-bg-subtle" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-20 rounded-md bg-bg-subtle" />
          <div className="h-6 w-24 rounded-md bg-bg-subtle" />
          <div className="h-6 w-16 rounded-md bg-bg-subtle" />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex items-center gap-3 py-3 pl-[18px] pr-4.5 ${i < 3 ? "border-b border-border" : ""}`}
          >
            <div className="h-[17px] w-[17px] shrink-0 rounded-full bg-bg-subtle" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-3 w-32 rounded bg-bg-subtle" />
              <div className="h-2.5 w-48 rounded bg-bg-subtle" />
            </div>
            <div className="h-2.5 w-10 shrink-0 rounded bg-bg-subtle" />
            <div className="h-5 w-14 shrink-0 rounded-md bg-bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
