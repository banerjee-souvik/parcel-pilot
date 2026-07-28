import { APICallError, createUIMessageStreamResponse, generateId, RetryError, toUIMessageStream, type UIMessage } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { buildAgentStream } from "@/lib/agent/run";
import { MissingProviderError, getModelId } from "@/lib/agent/provider";
import * as services from "@/lib/domain/services";
import { redisPublisher, redisSubscriber } from "@/lib/redis";
import { createTracer } from "@/lib/tracing";

export const maxDuration = 60;

// Errors thrown mid-stream (rate limits, provider outages) don't reject buildAgentStream's promise —
// the AI SDK swallows them internally and emits a generic "error" chunk instead. This onError hook is
// the only place we get to shape what the client actually sees, so we JSON-encode a typed marker the
// client can parse for the rate-limit banner, falling back to plain text for anything unrecognized.
// Exported so the rate-limit-degradation eval can verify this exact function (not a reimplementation
// of it) classifies a mock 429 correctly.
//
// A real 429 doesn't necessarily arrive as a bare APICallError — the SDK retries transient failures
// internally first, and once retries are exhausted it throws a RetryError wrapping the underlying
// attempts in `.errors`/`.lastError`. Checking APICallError.isInstance(error) directly missed this:
// confirmed live, a genuine Groq 429 was misclassified as UNKNOWN because the object `onError`
// actually received was the RetryError wrapper, not the APICallError inside it.
function unwrapRetryError(error: unknown): unknown {
  if (!RetryError.isInstance(error)) return error;
  return error.errors.find((e) => APICallError.isInstance(e) && e.statusCode === 429) ?? error.lastError;
}

export function describeError(error: unknown): string {
  const cause = unwrapRetryError(error);
  if (APICallError.isInstance(cause) && cause.statusCode === 429) {
    return JSON.stringify({ code: "RATE_LIMITED" });
  }
  return JSON.stringify({ code: "UNKNOWN", message: "Something went wrong. Please try again." });
}

export async function POST(req: Request) {
  const { id: chatId, message }: { id: string; message: UIMessage } = await req.json();

  await services.ensureChat(chatId);
  const prior = await services.loadMessages(chatId);
  const messages = [...prior.map(services.toUIMessage), message];

  // Invariant: persist the user's message before calling the model, so a failed/rate-limited
  // call never loses their input. See tech-design.md §0 invariant 6.
  await services.persistMessage(chatId, { id: message.id, role: message.role, parts: message.parts });
  await services.setActiveStream(chatId, null);

  let modelId: string;
  try {
    modelId = getModelId();
  } catch (err) {
    if (err instanceof MissingProviderError) {
      return Response.json({ error: { code: "NO_PROVIDER", message: err.message } }, { status: 503 });
    }
    throw err;
  }

  const tracer = createTracer({ chatId, model: modelId });
  await tracer.init();

  let result: Awaited<ReturnType<typeof buildAgentStream>>;
  try {
    result = await buildAgentStream({ chatId, uiMessages: messages, tracer });
  } catch (err) {
    // Anything thrown before the stream response even exists (e.g. history conversion) would
    // otherwise leave this trace stuck at "running" forever — nothing downstream ever finalizes it.
    await tracer.finalize("error");
    throw err;
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: generateId,
      onError: describeError,
      onEnd: ({ messages: finalMessages }) => {
        after(async () => {
          const last = finalMessages.at(-1);
          if (last && last.role === "assistant") {
            await services.persistMessage(chatId, { id: last.id, role: last.role, parts: last.parts });
          }
          await services.setActiveStream(chatId, null);
          await tracer.finalize("completed");
        });
      },
    }),
    async consumeSseStream({ stream }) {
      // Graceful degradation covers two distinct cases: REDIS_URL unset (redisPublisher/Subscriber
      // are null, skip immediately), and REDIS_URL set but Redis unreachable (caught here so a down
      // Redis degrades to plain streaming instead of failing the request).
      if (!redisPublisher || !redisSubscriber) return;
      try {
        const streamId = generateId();
        const streamContext = createResumableStreamContext({
          waitUntil: after,
          publisher: redisPublisher,
          subscriber: redisSubscriber,
        });
        await streamContext.createNewResumableStream(streamId, () => stream);
        await services.setActiveStream(chatId, streamId);
      } catch (err) {
        console.warn("Resumable stream unavailable, continuing without resumption:", err);
      }
    },
  });
}
