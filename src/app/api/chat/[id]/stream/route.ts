import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import * as services from "@/lib/domain/services";
import { redisPublisher, redisSubscriber } from "@/lib/redis";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: chatId } = await params;
  const chat = await services.loadChat(chatId);

  if (!chat?.activeStreamId || !redisPublisher || !redisSubscriber) {
    return new Response(null, { status: 204 });
  }

  try {
    const streamContext = createResumableStreamContext({
      waitUntil: after,
      publisher: redisPublisher,
      subscriber: redisSubscriber,
    });
    const stream = await streamContext.resumeExistingStream(chat.activeStreamId);

    if (!stream) {
      return new Response(null, { status: 204 });
    }

    return new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS });
  } catch (err) {
    console.warn("Resumable stream unavailable:", err);
    return new Response(null, { status: 204 });
  }
}
