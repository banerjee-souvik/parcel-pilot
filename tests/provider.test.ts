import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEvalModelId, getModelId, MissingProviderError } from "@/lib/agent/provider";

const ENV_KEYS = ["GOOGLE_GENERATIVE_AI_API_KEY", "GROQ_API_KEY", "EVAL_MODEL"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("getModelId — provider fallback order", () => {
  it("prefers Google when both keys are set", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.GROQ_API_KEY = "test-key";
    expect(getModelId()).toBe("gemini-3.6-flash");
  });

  it("falls back to Groq when only the Groq key is set", () => {
    process.env.GROQ_API_KEY = "test-key";
    expect(getModelId()).toBe("openai/gpt-oss-120b");
  });

  it("throws MissingProviderError when neither key is set", () => {
    expect(() => getModelId()).toThrow(MissingProviderError);
  });
});

describe("getEvalModelId — EVAL_MODEL override", () => {
  it("pins Google when EVAL_MODEL=google, even if Groq is also configured", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.GROQ_API_KEY = "test-key";
    process.env.EVAL_MODEL = "google";
    expect(getEvalModelId()).toBe("gemini-3.6-flash");
  });

  it("pins Groq when EVAL_MODEL=groq, even if only Google is configured", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.EVAL_MODEL = "groq";
    expect(getEvalModelId()).toBe("openai/gpt-oss-120b");
  });

  it("falls back to the normal provider order when EVAL_MODEL is unset", () => {
    process.env.GROQ_API_KEY = "test-key";
    expect(getEvalModelId()).toBe("openai/gpt-oss-120b");
  });
});
