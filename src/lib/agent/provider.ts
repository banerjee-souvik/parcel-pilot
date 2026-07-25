import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";

export class MissingProviderError extends Error {
  constructor() {
    super("No LLM provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY.");
    this.name = "MissingProviderError";
  }
}

// Model names verified live against provider docs on 2026-07-25 — gemini-2.5-flash and
// llama-3.3-70b-versatile (both assumed in earlier planning) turned out to be deprecated/deprecating
// by then. gemini-3.6-flash confirmed free-tier; openai/gpt-oss-120b is Groq's current recommended
// free-tier replacement (llama-3.3-70b-versatile deprecates 2026-08-16).
const GOOGLE_MODEL = "gemini-3.6-flash";
const GROQ_MODEL = "openai/gpt-oss-120b";

export function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return google(GOOGLE_MODEL);
  if (process.env.GROQ_API_KEY) return groq(GROQ_MODEL);
  throw new MissingProviderError();
}

export function getModelId(): string {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return GOOGLE_MODEL;
  if (process.env.GROQ_API_KEY) return GROQ_MODEL;
  throw new MissingProviderError();
}
