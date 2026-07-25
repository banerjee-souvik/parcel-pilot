import { createUIMessageStreamResponse, generateId, toUIMessageStream, type UIMessage } from "ai";
import { after } from "next/server";
import { buildAgentStream } from "@/lib/agent/run";
import { MissingProviderError, getModelId } from "@/lib/agent/provider";
import * as services from "@/lib/domain/services";
import { createTracer } from "@/lib/tracing";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { id: chatId, message }: { id: string; message: UIMessage } = await req.json();

  await services.ensureChat(chatId);
  const prior = await services.loadMessages(chatId);
  const messages = [...prior.map(toUIMessage), message];

  // Invariant: persist the user's message before calling the model, so a failed/rate-limited
  // call never loses their input. See tech-design.md §0 invariant 6.
  await services.persistMessage(chatId, { id: message.id, role: message.role, parts: message.parts });

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

  const result = await buildAgentStream({ chatId, uiMessages: messages, tracer });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: generateId,
      onEnd: ({ messages: finalMessages }) => {
        after(async () => {
          const last = finalMessages.at(-1);
          if (last && last.role === "assistant") {
            await services.persistMessage(chatId, { id: last.id, role: last.role, parts: last.parts });
          }
          await tracer.finalize("completed");
        });
      },
    }),
  });
}

function toUIMessage(row: { id: string; role: string; parts: unknown }): UIMessage {
  return { id: row.id, role: row.role as UIMessage["role"], parts: row.parts as UIMessage["parts"] };
}
