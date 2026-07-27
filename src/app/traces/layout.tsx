import Link from "next/link";
import { MessageCircle, Package } from "lucide-react";
import { listTraces } from "@/lib/tracing";
import { RunList } from "@/components/traces/run-list";

// Without this, `next build`/`next start` can statically prerender this layout's DB query once and
// cache it — a real bug found live: the run list kept showing a stale snapshot after `next build`,
// missing traces created seconds earlier. This data is inherently request-time; nothing here should
// ever be cached.
export const dynamic = "force-dynamic";

export default async function TracesLayout({ children }: { children: React.ReactNode }) {
  const runs = await listTraces();

  return (
    <div className="flex h-screen w-full flex-col bg-bg-subtle">
      <div className="flex items-center justify-between border-b border-border bg-bg px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent">
            <Package className="h-[17px] w-[17px] text-white" />
          </div>
          <span className="text-[15px] font-semibold text-text-primary">Parcel Pilot</span>
          <span className="text-[15px] text-text-secondary">/</span>
          <span className="text-[15px] font-medium text-text-secondary">Traces</span>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-subtle"
        >
          <MessageCircle className="h-[15px] w-[15px]" />
          Open chat
        </Link>
      </div>
      <div className="flex min-h-0 flex-1">
        <RunList runs={runs} />
        <div className="flex flex-1 flex-col overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
