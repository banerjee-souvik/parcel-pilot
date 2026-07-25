import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import type { Receipt } from "../domain/types";
import type { Tracer } from "../tracing";
import { buildSystemPrompt } from "./prompt";
import { getModel } from "./provider";
import { buildTools } from "./tools";

// data-receipt parts record a confirmed/cancelled action outside the tool-call loop (the confirm
// endpoint writes them directly). The model only sees them if we translate them into text here —
// otherwise a confirmed action on turn N is invisible to the model on turn N+1. See tech-design.md §10.
function receiptToText(data: unknown): string {
  const d = data as { status: "executed" | "cancelled"; receipt?: Receipt };
  if (d.status === "cancelled") return "[The customer cancelled the pending action.]";
  const r = d.receipt;
  return r ? `[Action executed. Confirmation ${r.confirmationNumber}: ${r.summary}]` : "[Action executed.]";
}

// Single agent entrypoint, shared by the API route and the eval harness — they must never diverge,
// or the evals stop proving anything about what actually runs in production. See tech-design.md §9.
export async function buildAgentStream({
  chatId,
  uiMessages,
  model = getModel(),
  tracer,
}: {
  chatId: string;
  uiMessages: UIMessage[];
  model?: Parameters<typeof streamText>[0]["model"];
  tracer: Tracer;
}) {
  return streamText({
    model,
    instructions: buildSystemPrompt({ today: new Date() }),
    messages: await convertToModelMessages(uiMessages, {
      convertDataPart: (part) =>
        part.type === "data-receipt" ? { type: "text", text: receiptToText(part.data) } : undefined,
    }),
    tools: buildTools({ chatId }),
    stopWhen: isStepCount(6),
    onStepEnd: (step) => tracer.recordStep(step),
    onToolExecutionStart: (call) => tracer.toolStart(call),
    onToolExecutionEnd: (call) => tracer.toolEnd(call),
  });
}
