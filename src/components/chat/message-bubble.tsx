import { cn } from "@/lib/utils";

export function MessageBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="inline-block rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-white">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("w-full pr-10")}>
      <div className="w-full rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md bg-bg-subtle px-3.5 py-2.5 text-sm leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}
