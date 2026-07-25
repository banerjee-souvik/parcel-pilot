import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import type { Tracer } from "../tracing";
import { buildSystemPrompt } from "./prompt";
import { getModel } from "./provider";
import { buildTools } from "./tools";

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
    messages: await convertToModelMessages(uiMessages),
    tools: buildTools({ chatId }),
    stopWhen: isStepCount(6),
    onStepEnd: (step) => tracer.recordStep(step),
    onToolExecutionStart: (call) => tracer.toolStart(call),
    onToolExecutionEnd: (call) => tracer.toolEnd(call),
  });
}
