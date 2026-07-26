import { desc, eq } from "drizzle-orm";
import { generateId, readUIMessageStream, toUIMessageStream, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { buildAgentStream } from "@/lib/agent/run";
import { getEvalModel, getEvalModelId } from "@/lib/agent/provider";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed";
import * as services from "@/lib/domain/services";
import { createTracer } from "@/lib/tracing";

// Drives the real agent loop directly (no HTTP) so evals exercise exactly what production runs —
// buildAgentStream is the one place both this harness and the API route call into. See tech-design.md §14.

export async function resetDb() {
  await seedDatabase();
}

export function newChatId(): string {
  return `c_eval_${nanoid(8)}`;
}

export type ToolCallRecord = { turn: number; name: string; input: unknown; output: unknown };

// A tool's Result<T> shape (see domain/types.ts) — evals inspect this directly rather than
// re-deriving refusal detection logic that already lives in the app.
type ToolResultLike = { ok: boolean; code?: string; message?: string };

export type ScenarioResult = {
  chatId: string;
  history: UIMessage[];
  toolCalls: ToolCallRecord[];
  refusals: { code: string; message: string }[];
  textByTurn: string[];
};

type TurnOutcome = {
  toolResults: Awaited<Awaited<ReturnType<typeof buildAgentStream>>["toolResults"]>;
  text: string;
  assistantMessage?: UIMessage;
};

async function runOneTurn(chatId: string, messages: UIMessage[]): Promise<TurnOutcome> {
  const tracer = createTracer({ chatId, model: getEvalModelId() });
  await tracer.init();
  const result = await buildAgentStream({ chatId, uiMessages: messages, model: getEvalModel(), tracer });

  const uiStream = toUIMessageStream({ stream: result.stream, originalMessages: messages, generateMessageId: generateId });
  let assistantMessage: UIMessage | undefined;
  for await (const msg of readUIMessageStream({ stream: uiStream })) {
    assistantMessage = msg;
  }
  await tracer.finalize("completed");

  const [toolResults, text] = await Promise.all([result.toolResults, result.text]);
  return { toolResults, text, assistantMessage };
}

// Real network calls to a real provider occasionally hang or blip — retries once on any failure
// before giving up, per tech-design.md §14 ("retries once on infra failure, then fails loudly").
// Observed for real: a 60s-timeout-configured run once took 553s before erroring, then passed
// cleanly in isolation seconds later — a transient hang, not a reproducible bug.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn("Eval turn failed, retrying once:", err instanceof Error ? err.message : err);
    return fn();
  }
}

// Runs a scripted multi-turn conversation through the real agent loop. Each turn: build the user
// message, call buildAgentStream, drain the stream via the same toUIMessageStream/readUIMessageStream
// path production uses (not a hand-rolled one), and fold the result into history for the next turn.
export async function runTurns(chatId: string, userTexts: string[]): Promise<ScenarioResult> {
  await services.ensureChat(chatId);
  let history: UIMessage[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const refusals: { code: string; message: string }[] = [];
  const textByTurn: string[] = [];

  for (let turn = 0; turn < userTexts.length; turn++) {
    const userMessage: UIMessage = { id: generateId(), role: "user", parts: [{ type: "text", text: userTexts[turn] }] };
    const messages = [...history, userMessage];

    const { toolResults, text, assistantMessage } = await withRetry(() => runOneTurn(chatId, messages));

    for (const tr of toolResults) {
      toolCalls.push({ turn, name: tr.toolName, input: tr.input, output: tr.output });
      const output = tr.output as ToolResultLike;
      if (output && output.ok === false && output.code && output.message) {
        refusals.push({ code: output.code, message: output.message });
      }
    }
    textByTurn.push(text);
    history = assistantMessage ? [...messages, assistantMessage] : messages;
  }

  return { chatId, history, toolCalls, refusals, textByTurn };
}

// Bypasses the LLM entirely — confirms/cancels a proposal exactly the way the confirm/cancel HTTP
// routes do, by calling the same service functions directly. Used for concurrency/idempotency
// assertions that have nothing to do with model behavior.
export async function confirmProposal(proposalId: string, chatId: string) {
  return services.executeProposal(proposalId, chatId);
}

export async function cancelProposal(proposalId: string, chatId: string) {
  return services.cancelProposal(proposalId, chatId);
}

// Finds the most recent proposal (of any kind) created for a chat during a scenario — scenarios
// don't get the proposalId back from runTurns (it's buried in a tool output), so this is the
// pragmatic way to grab it for a follow-up confirm/cancel call without threading it through by hand.
export async function latestProposalId(chatId: string): Promise<string | null> {
  const [row] = await db.select().from(actions).where(eq(actions.chatId, chatId)).orderBy(desc(actions.createdAt)).limit(1);
  return row?.id ?? null;
}
