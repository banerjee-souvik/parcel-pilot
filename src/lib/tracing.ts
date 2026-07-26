import { count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db";
import { chats, traceSpans, traces } from "./db/schema";

type SpanKind = "model_call" | "tool_call" | "guardrail" | "error";
type SpanOutcome = "ok" | "refused" | "proposal" | "executed" | "cancelled" | "error";

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

  // "completed" from the caller just means "the stream didn't crash" — it can't see whether a
  // guardrail refused something mid-run, only the buffered spans know that. Derive the real status
  // from them so the trace list's refusal (amber) dot isn't permanently unreachable.
  async function finalize(callerStatus: "completed" | "error") {
    const status: "completed" | "refusal" | "error" =
      callerStatus === "error" ? "error" : spans.some((s) => s.outcome === "refused") ? "refusal" : "completed";
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

// A single deterministic action (confirm/cancel) doesn't fit the streaming-oriented Tracer above —
// there's no model call, no multi-step lifecycle, just one thing that happened. Record it as its
// own tiny one-span trace instead of overloading createTracer for a shape it wasn't built for.
export async function recordActionTrace({
  chatId,
  name,
  input,
  output,
  durationMs,
  outcome,
  status,
}: {
  chatId: string;
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  outcome: SpanOutcome;
  status: "completed" | "error";
}) {
  const traceId = `t_${nanoid(12)}`;
  await db.insert(traces).values({ id: traceId, chatId, model: "system", status, durationMs });
  await db.insert(traceSpans).values({
    id: `span_${nanoid(12)}`,
    traceId,
    seq: 0,
    kind: "tool_call",
    name,
    input,
    output,
    durationMs,
    tokens: null,
    outcome,
    startedAt: new Date(),
  });
}

// --- Reads, for the /traces UI. Kept here alongside the writer since this file owns the
// traces/trace_spans tables end to end — services.ts owns shipments/actions/chats/messages. ---

export async function listTraces() {
  const rows = await db
    .select({
      id: traces.id,
      chatId: traces.chatId,
      chatTitle: chats.title,
      model: traces.model,
      status: traces.status,
      totalTokens: traces.totalTokens,
      durationMs: traces.durationMs,
      createdAt: traces.createdAt,
    })
    .from(traces)
    .leftJoin(chats, eq(chats.id, traces.chatId))
    .orderBy(desc(traces.createdAt));

  const counts = await db.select({ traceId: traceSpans.traceId, n: count() }).from(traceSpans).groupBy(traceSpans.traceId);
  const countByTraceId = new Map(counts.map((c) => [c.traceId, c.n]));

  return rows.map((r) => ({ ...r, stepCount: countByTraceId.get(r.id) ?? 0 }));
}

export async function loadTraceDetail(traceId: string) {
  const [trace] = await db
    .select({
      id: traces.id,
      chatId: traces.chatId,
      chatTitle: chats.title,
      model: traces.model,
      status: traces.status,
      totalTokens: traces.totalTokens,
      durationMs: traces.durationMs,
      createdAt: traces.createdAt,
    })
    .from(traces)
    .leftJoin(chats, eq(chats.id, traces.chatId))
    .where(eq(traces.id, traceId))
    .limit(1);
  if (!trace) return null;

  const spans = await db.select().from(traceSpans).where(eq(traceSpans.traceId, traceId)).orderBy(traceSpans.seq);
  return { trace, spans };
}
