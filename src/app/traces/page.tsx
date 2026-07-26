import { Activity } from "lucide-react";

export default function TracesEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Activity className="h-8 w-8 text-text-secondary" />
      <p className="text-sm text-text-secondary">Select a conversation to see its trace.</p>
    </div>
  );
}
