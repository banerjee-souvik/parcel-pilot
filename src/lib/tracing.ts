import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db";
import { traceSpans, traces } from "./db/schema";

type SpanKind = "model_call" | "tool_call" | "guardrail" | "error";
type SpanOutcome = "ok" | "refused" | "proposal" | "error";

type BufferedSpan = {
  id: string;
  seq: number;
  kind: SpanKind;
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number | null;
  tokens: number | null;
  outcome: SpanOutcome;
  startedAt: Date;
};

export type Tracer = ReturnType<typeof createTracer>;

// Inspects a tool's Result<T> return value to classify the span outcome, so the trace viewer can
// distinguish a plain success from a guardrail refusal or a two-phase proposal at a glance.
function classifyToolOutput(output: unknown): SpanOutcome {
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (o.ok === false) return "refused";
    if (o.ok === true && o.data && typeof o.data === "object" && "proposalId" in (o.data as object)) {
      return "proposal";
    }
  }
  return "ok";
}

export function createTracer({ chatId, model }: { chatId: string; model: string }) {
  const traceId = `t_${nanoid(12)}`;
  const spans: BufferedSpan[] = [];
  let seq = 0;
  let totalTokens = 0;
  const startedAt = new Date();

  async function init() {
    await db.insert(traces).values({ id: traceId, chatId, model, status: "running" });
  }

  function recordStep(step: { usage?: { totalTokens?: number }; finishReason?: string }) {
    const tokens = step.usage?.totalTokens ?? null;
    if (tokens) totalTokens += tokens;
    spans.push({
      id: `span_${nanoid(12)}`,
      seq: seq++,
      kind: "model_call",
      name: model,
      input: null,
      output: { finishReason: step.finishReason ?? null },
      durationMs: null,
      tokens,
      outcome: "ok",
      startedAt: new Date(),
    });
  }

  const toolStarts = new Map<string, Date>();

  // Event shapes match AI SDK v7's ToolExecutionStartEvent/ToolExecutionEndEvent exactly (verified
  // against node_modules/ai/dist/index.d.ts) — call details are nested under `.toolCall`, and
  // `.toolOutput` is a discriminated union on `type: "tool-result" | "tool-error"`.
  function toolStart(event: { toolCall: { toolCallId: string; toolName: string; input: unknown } }) {
    toolStarts.set(event.toolCall.toolCallId, new Date());
  }

  function toolEnd(event: {
    toolCall: { toolCallId: string; toolName: string; input: unknown };
    toolExecutionMs: number;
    toolOutput: { type: "tool-result"; output: unknown } | { type: "tool-error"; error: unknown };
  }) {
    const start = toolStarts.get(event.toolCall.toolCallId) ?? new Date();
    toolStarts.delete(event.toolCall.toolCallId);
    const toolOutput = event.toolOutput;
    const output = toolOutput.type === "tool-error" ? toolOutput.error : toolOutput.output;
    const outcome: SpanOutcome = toolOutput.type === "tool-error" ? "error" : classifyToolOutput(output);
    spans.push({
      id: `span_${nanoid(12)}`,
      seq: seq++,
      kind: "tool_call",
      name: event.toolCall.toolName,
      input: event.toolCall.input,
      output,
      durationMs: Math.round(event.toolExecutionMs),
      tokens: null,
      outcome,
      startedAt: start,
    });
  }

  function guardrailRefusal(name: string, refusal: { code: string; message: string }) {
    spans.push({
      id: `span_${nanoid(12)}`,
      seq: seq++,
      kind: "guardrail",
      name: refusal.code,
      input: null,
      output: { message: refusal.message },
      durationMs: null,
      tokens: null,
      outcome: "refused",
      startedAt: new Date(),
    });
  }

  async function finalize(status: "completed" | "refusal" | "error") {
    if (spans.length > 0) {
      await db.insert(traceSpans).values(
        spans.map((s) => ({
          id: s.id,
          traceId,
          seq: s.seq,
          kind: s.kind,
          name: s.name,
          input: s.input,
          output: s.output,
          durationMs: s.durationMs,
          tokens: s.tokens,
          outcome: s.outcome,
          startedAt: s.startedAt,
        }))
      );
    }
    await db
      .update(traces)
      .set({
        status,
        totalTokens: totalTokens || null,
        durationMs: Date.now() - startedAt.getTime(),
      })
      .where(eq(traces.id, traceId));
  }

  return { traceId, init, recordStep, toolStart, toolEnd, guardrailRefusal, finalize };
}
