import { APICallError, generateId, RetryError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";
import { describeError } from "@/app/api/chat/route";
import { buildAgentStream } from "@/lib/agent/run";
import * as services from "@/lib/domain/services";
import { createTracer } from "@/lib/tracing";
import { newChatId, resetDb } from "../harness";

// No real API calls — a mock model that always throws a 429-shaped APICallError, matching a real
// Gemini free-tier exhaustion observed live during Day 1/2 testing (decisions.md #8, #10).
function rateLimitedModel() {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new APICallError({
        message: "Rate limit exceeded",
        url: "https://mock.invalid/generate",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      });
    },
  });
}

describe("rate-limit-degradation", () => {
  beforeEach(resetDb);

  it("classifies a 429 as RATE_LIMITED, not a generic error", () => {
    const err = new APICallError({
      message: "Rate limit exceeded",
      url: "https://mock.invalid/generate",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    expect(JSON.parse(describeError(err))).toEqual({ code: "RATE_LIMITED" });
  });

  it("a non-429 error still degrades to a typed (non-leaking) marker", () => {
    expect(JSON.parse(describeError(new Error("boom")))).toMatchObject({ code: "UNKNOWN" });
  });

  // Found live, not by inspection: the AI SDK retries a transient failure internally first, and once
  // retries are exhausted it throws a RetryError wrapping the attempts — the object onError actually
  // receives isn't the bare APICallError. A real Groq 429 was misclassified as UNKNOWN because of
  // exactly this until fixed; this test pins the exact wrapped shape that broke it.
  it("classifies a 429 as RATE_LIMITED even wrapped in a RetryError (what the SDK actually throws)", () => {
    const inner = new APICallError({
      message: "Rate limit exceeded",
      url: "https://mock.invalid/generate",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const wrapped = new RetryError({ message: "Failed after 3 attempts", reason: "maxRetriesExceeded", errors: [inner, inner] });
    expect(JSON.parse(describeError(wrapped))).toEqual({ code: "RATE_LIMITED" });
  });

  it("the user's message survives even when the model call fails outright (invariant 6)", async () => {
    const chatId = newChatId();
    await services.ensureChat(chatId);
    const userMessageId = generateId();
    await services.persistMessage(chatId, {
      id: userMessageId,
      role: "user",
      parts: [{ type: "text", text: "Where is SS-4417-DEMO?" }],
    });

    const tracer = createTracer({ chatId, model: "mock-429" });
    await tracer.init();
    const result = await buildAgentStream({
      chatId,
      uiMessages: [{ id: userMessageId, role: "user", parts: [{ type: "text", text: "Where is SS-4417-DEMO?" }] }],
      model: rateLimitedModel(),
      tracer,
    });

    // The AI SDK swallows a mid-stream error into a stream part rather than rejecting — draining
    // the stream should not throw, it should just produce no text.
    await result.consumeStream();
    await tracer.finalize("error");

    const persisted = await services.loadMessages(chatId);
    expect(persisted.some((m) => m.id === userMessageId)).toBe(true);
  });
});
