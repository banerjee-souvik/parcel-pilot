import { groq } from "@ai-sdk/groq";

export class MissingProviderError extends Error {
  constructor() {
    super("No LLM provider configured. Set GROQ_API_KEY.");
    this.name = "MissingProviderError";
  }
}

// Model name verified live against Groq's docs on 2026-07-25 — llama-3.3-70b-versatile (assumed in
// earlier planning) is on a deprecation clock three weeks out; openai/gpt-oss-120b is Groq's current
// recommended free-tier replacement. See decisions.md #20 for why Groq is now the only provider.
const GROQ_MODEL = "openai/gpt-oss-120b";

export function getModel() {
  if (process.env.GROQ_API_KEY) return groq(GROQ_MODEL);
  throw new MissingProviderError();
}

export function getModelId(): string {
  if (process.env.GROQ_API_KEY) return GROQ_MODEL;
  throw new MissingProviderError();
}

// Kept as a thin alias rather than removed: the eval harness imports getEvalModel/getEvalModelId
// specifically (not getModel/getModelId), and that seam is worth keeping even with one provider —
// evals should always be able to diverge from prod's provider choice without a call-site change.
export function getEvalModel() {
  return getModel();
}

export function getEvalModelId(): string {
  return getModelId();
}
