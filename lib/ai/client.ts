import "server-only";
import { generateObject, generateText, streamText, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ZodType } from "zod";

// Only GEMINI is wired up in this phase. The provider column/type already
// allows OPENAI/ANTHROPIC so a later phase can add an adapter here without a
// schema change -- callers never import a provider SDK directly, only this
// file and lib/ai/gateway.ts do.
export type AIProviderKey = "GEMINI" | "OPENAI" | "ANTHROPIC";

// gemini-3.6-flash exists but carries a very restrictive preview free-tier
// quota (observed: 20 requests total) -- gemini-2.5-flash is the current
// stable model with the standard, much higher free-tier limit.
const GEMINI_MODEL_ID = "gemini-2.5-flash";

// Without a bound, a slow/rate-limited/hung provider request leaves the UI
// spinning forever with no error ever surfacing (observed during manual
// testing: AI Check appeared stuck indefinitely). 45s comfortably covers a
// real vision-extraction call; anything slower than that should fail loudly
// instead of spinning silently.
const REQUEST_TIMEOUT_MS = 45_000;

function resolveModel(apiKey: string, provider: AIProviderKey) {
  if (provider !== "GEMINI") {
    throw new Error(`AI provider "${provider}" is not implemented yet. Only Gemini is supported in this phase.`);
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google(GEMINI_MODEL_ID);
}

export async function generateProviderText(params: {
  apiKey: string;
  provider: AIProviderKey;
  prompt: string;
}) {
  const model = resolveModel(params.apiKey, params.provider);
  const result = await generateText({ model, prompt: params.prompt, abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return result.text;
}

export async function generateProviderObject<T>(params: {
  apiKey: string;
  provider: AIProviderKey;
  prompt: string;
  schema: ZodType<T>;
  // Vision input for document-reading features -- raw file bytes + its mime
  // type, sent as a file part alongside the text prompt. Gemini 2.0 Flash
  // accepts both images and PDFs this way.
  file?: { data: Buffer; mediaType: string };
}) {
  const model = resolveModel(params.apiKey, params.provider);
  const abortSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const result = params.file
    ? await generateObject({
        model,
        schema: params.schema,
        abortSignal,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: params.prompt },
              { type: "file", data: params.file.data, mediaType: params.file.mediaType },
            ],
          },
        ],
      })
    : await generateObject({ model, prompt: params.prompt, schema: params.schema, abortSignal });
  return result.object;
}

export function streamProviderText(params: {
  apiKey: string;
  provider: AIProviderKey;
  system?: string;
  messages: ModelMessage[];
  onFinish?: () => void;
}) {
  const model = resolveModel(params.apiKey, params.provider);
  return streamText({
    model,
    system: params.system,
    messages: params.messages,
    onFinish: params.onFinish,
    // Without this, a mid-stream provider error (bad key, rate limit, etc.)
    // would fail silently -- the client just sees the stream end early.
    onError: (event) => {
      console.error("[ai] stream error:", event.error instanceof Error ? event.error.message : event.error);
    },
  });
}
