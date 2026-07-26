import { notFound } from "next/navigation";
import { loadTraceDetail } from "@/lib/tracing";
import { DetailHead } from "@/components/traces/detail-head";
import { StepTree } from "@/components/traces/step-tree";

export default async function TraceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadTraceDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-4">
      <DetailHead trace={detail.trace} />
      <StepTree spans={detail.spans} />
    </div>
  );
}
