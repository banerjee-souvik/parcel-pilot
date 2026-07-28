// Shown instantly on first navigation into /traces, while the layout's listTraces() DB call
// resolves — same gap as [id]/loading.tsx, one level up.
export default function TracesLoading() {
  return (
    <div className="flex h-screen w-full flex-col bg-bg-subtle">
      <div className="flex items-center justify-between border-b border-border bg-bg px-6 py-3.5">
        <div className="flex animate-pulse items-center gap-2.5">
          <div className="h-[30px] w-[30px] rounded-lg bg-bg-subtle" />
          <div className="h-4 w-24 rounded bg-bg-subtle" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[360px] shrink-0 animate-pulse flex-col gap-px border-r border-border bg-bg p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-border py-3">
              <div className="h-2 w-2 shrink-0 rounded-full bg-bg-subtle" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="h-3 w-28 rounded bg-bg-subtle" />
                <div className="h-2.5 w-40 rounded bg-bg-subtle" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-subtle" />
        </div>
      </div>
    </div>
  );
}
