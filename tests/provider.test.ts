import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEvalModelId, getModelId, MissingProviderError } from "@/lib/agent/provider";

const ENV_KEYS = ["GROQ_API_KEY"] as const;
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

describe("getModelId", () => {
  it("returns the Groq model when GROQ_API_KEY is set", () => {
    process.env.GROQ_API_KEY = "test-key";
    expect(getModelId()).toBe("openai/gpt-oss-120b");
  });

  it("throws MissingProviderError when no key is set", () => {
    expect(() => getModelId()).toThrow(MissingProviderError);
  });
});

describe("getEvalModelId", () => {
  it("matches getModelId — evals use the same provider as prod", () => {
    process.env.GROQ_API_KEY = "test-key";
    expect(getEvalModelId()).toBe(getModelId());
  });
});
