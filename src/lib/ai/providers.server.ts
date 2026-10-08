/**
 * Server-only AI provider adapters.
 *
 * One `callProvider()` interface with five adapters:
 *  - openrouter → OpenRouter API, free models via `:free` suffix (OPENROUTER_API_KEY)
 *  - gemini     → Google Gemini OpenAI-compatible endpoint, free tier (GEMINI_API_KEY)
 *  - groq       → Groq OpenAI-compatible endpoint, free tier (GROQ_API_KEY)
 *  - openai     → OpenAI Chat Completions API  (OPENAI_API_KEY)
 *  - anthropic  → Anthropic Messages API       (ANTHROPIC_API_KEY)
 *
 * Rotation order is free-first: OpenRouter → Gemini → Groq, with the paid
 * providers (OpenAI, Anthropic) kept as last-resort fallbacks.
 *
 * Keys are only ever read here, inside handlers on the server. Nothing is
 * returned to the browser except masked status flags.
 */

export type ProviderKey = "openrouter" | "gemini" | "groq" | "openai" | "anthropic";

/** Rotation order: free providers first, paid providers last. */
export const PROVIDER_PRIORITY: ProviderKey[] = [
  "openrouter",
  "gemini",
  "groq",
  "openai",
  "anthropic",
];

export const FREE_PROVIDERS: ProviderKey[] = ["openrouter", "gemini", "groq"];

/** Sensible default model per provider (free-tier models where applicable). */
export const DEFAULT_MODELS: Record<ProviderKey, string> = {
  openrouter: "qwen/qwen3.8-27b:free",
  gemini: "gemini-3.8-flash",
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

/**
 * Default vision-capable model per provider. Null means the provider has no
 * usable vision model on its free tier and must be skipped for image tasks.
 */
export const DEFAULT_VISION_MODELS: Record<ProviderKey, string | null> = {
  openrouter: "qwen/qwen3.8-27b:free",
  gemini: "gemini-3.8-flash",
  groq: null,
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

/** Returns the default model for a provider, or null when it can't do the task. */
export function defaultModelFor(provider: ProviderKey, needsVision: boolean): string | null {
  return needsVision ? DEFAULT_VISION_MODELS[provider] : DEFAULT_MODELS[provider];
}

/**
 * Math-grade models for takeoff counting. Claude Opus and Sonnet are the
 * accurate counters for schedule reading, opening counts and quantity math.
 * Both support images, so they work for vision and text math tasks alike.
 */
export const MATH_MODELS = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-5",
} as const;

export type MathTier = "best" | "balanced";

/**
 * Returns the math-grade model for a provider. Anthropic gets Opus (best
 * accuracy) or Sonnet (cost-balanced); other providers keep their default.
 */
export function mathModelFor(provider: ProviderKey, tier: MathTier = "best"): string | null {
  if (provider === "anthropic") {
    return tier === "best" ? MATH_MODELS.opus : MATH_MODELS.sonnet;
  }
  return DEFAULT_MODELS[provider];
}

/**
 * The Claude Opus candidate for math tasks, or null when ANTHROPIC_API_KEY
 * is not set. Chain builders prepend it so Opus leads and the normal
 * free-first rotation follows as fallback.
 */
export function takeoffMathCandidate(): { provider: ProviderKey; model: string } | null {
  if (!providerApiKey("anthropic")) return null;
  const model = mathModelFor("anthropic", "best");
  if (!model) return null;
  return { provider: "anthropic", model };
}

export type GenerateInput = {
  provider: ProviderKey;
  model: string;
  system: string;
  prompt: string;
  /** Optional image inputs (https URL or data URL) for vision-capable models. */
  images?: string[];
  maxOutputTokens?: number | null;
  timeoutMs?: number;
};

export type GenerateResult = {
  text: string;
  provider: ProviderKey;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export function providerApiKey(provider: ProviderKey): string | null {
  switch (provider) {
    case "openrouter":
      return process.env.OPENROUTER_API_KEY || null;
    case "gemini":
      return process.env.GEMINI_API_KEY || null;
    case "groq":
      return process.env.GROQ_API_KEY || null;
    case "openai":
      return process.env.OPENAI_API_KEY || null;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || null;
    default:
      return null;
  }
}

export function configuredProviders(): ProviderKey[] {
  return PROVIDER_PRIORITY.filter((p) => Boolean(providerApiKey(p)));
}

/** Rough per-million-token pricing used only for internal cost estimates. */
const PRICING: Record<string, { in: number; out: number }> = {
  "qwen/qwen3.8-27b:free": { in: 0, out: 0 },
  "gemini-3.8-flash": { in: 0, out: 0 },
  "llama-3.1-8b-instant": { in: 0, out: 0 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-opus-4-1": { in: 15, out: 75 },
  "claude-3-5-haiku-latest": { in: 0.8, out: 4 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  default: { in: 1, out: 4 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICING[model] ?? PRICING.default;
  return Number(((inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out).toFixed(6));
}

export type ProviderErrorCategory =
  "missing_key" | "auth" | "rate_limit" | "timeout" | "server" | "invalid_request" | "unknown";

export class ProviderError extends Error {
  category: ProviderErrorCategory;
  status?: number;
  constructor(message: string, category: ProviderErrorCategory, status?: number) {
    super(message);
    this.category = category;
    this.status = status;
  }
}

function categorize(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (status >= 400) return "invalid_request";
  return "unknown";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(`Request timed out after ${timeoutMs}ms.`, "timeout");
    }
    throw new ProviderError(error instanceof Error ? error.message : "Network failure.", "unknown");
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI chat completions with vision support. */
async function callChatCompletions(
  input: GenerateInput,
  opts: { baseUrl: string; headers: Record<string, string>; model: string },
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const content: unknown[] = [{ type: "text", text: input.prompt }];
  for (const url of input.images ?? []) content.push({ type: "image_url", image_url: { url } });

  const res = await fetchWithTimeout(
    `${opts.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "content-type": "application/json", ...opts.headers },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.images?.length ? content : input.prompt },
        ],
        ...(input.maxOutputTokens ? { max_completion_tokens: input.maxOutputTokens } : {}),
      }),
    },
    input.timeoutMs ?? 45_000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(
      `${res.status} ${body.slice(0, 400)}`,
      categorize(res.status),
      res.status,
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(input: GenerateInput, apiKey: string) {
  const blocks: unknown[] = [];
  for (const url of input.images ?? []) {
    if (url.startsWith("data:")) {
      const [meta, data] = url.split(",");
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: meta.slice(5).split(";")[0], data },
      });
    } else {
      blocks.push({ type: "image", source: { type: "url", url } });
    }
  }
  blocks.push({ type: "text", text: input.prompt });

  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        system: input.system,
        max_tokens: input.maxOutputTokens ?? 2048,
        messages: [{ role: "user", content: blocks }],
      }),
    },
    input.timeoutMs ?? 45_000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(
      `${res.status} ${body.slice(0, 400)}`,
      categorize(res.status),
      res.status,
    );
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n"),
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}

/** Single unified generate() call against one provider — no retry, no fallback. */
export async function callProvider(input: GenerateInput): Promise<GenerateResult> {
  const key = providerApiKey(input.provider);
  if (!key) throw new ProviderError(`No API key configured for ${input.provider}.`, "missing_key");

  const started = Date.now();
  let out: { text: string; inputTokens: number; outputTokens: number };

  if (input.provider === "anthropic") {
    out = await callAnthropic(input, key);
  } else if (input.provider === "openai") {
    out = await callChatCompletions(input, {
      baseUrl: "https://api.openai.com/v1",
      headers: { authorization: `Bearer ${key}` },
      model: input.model,
    });
  } else if (input.provider === "openrouter") {
    out = await callChatCompletions(input, {
      baseUrl: "https://openrouter.ai/api/v1",
      headers: {
        authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://awm-platform.local",
        "X-Title": "AWM Takeoff AI",
      },
      model: input.model,
    });
  } else if (input.provider === "gemini") {
    out = await callChatCompletions(input, {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { authorization: `Bearer ${key}` },
      model: input.model,
    });
  } else if (input.provider === "groq") {
    out = await callChatCompletions(input, {
      baseUrl: "https://api.groq.com/openai/v1",
      headers: { authorization: `Bearer ${key}` },
      model: input.model,
    });
  } else {
    throw new ProviderError(`Unknown provider: ${input.provider}.`, "invalid_request");
  }

  if (!out.text.trim()) throw new ProviderError("Model returned an empty response.", "server");

  return {
    text: out.text,
    provider: input.provider,
    model: input.model,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    latencyMs: Date.now() - started,
  };
}

/** Retries transient failures with backoff; permanent failures fail fast. */
export async function callWithRetry(input: GenerateInput, attempts = 2): Promise<GenerateResult> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callProvider(input);
    } catch (error) {
      last = error;
      const category = error instanceof ProviderError ? error.category : "unknown";
      const retryable =
        category === "rate_limit" || category === "server" || category === "timeout";
      if (!retryable || attempt === attempts) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw last;
}

export type FallbackAttempt = { provider: ProviderKey; model: string; error: string };

export type FallbackResult =
  | { ok: true; result: GenerateResult; attempts: FallbackAttempt[] }
  | { ok: false; attempts: FallbackAttempt[] };

/**
 * Automatic rotation across providers in free-first priority order.
 * Tries each configured provider with its default model (or the override),
 * collecting per-provider errors. Paid providers are only reached when every
 * free provider failed or is unconfigured.
 */
export async function callWithFallback(
  base: Omit<GenerateInput, "provider" | "model">,
  opts?: { modelOverride?: Partial<Record<ProviderKey, string>>; perProviderAttempts?: number },
): Promise<FallbackResult> {
  const attempts: FallbackAttempt[] = [];
  for (const provider of configuredProviders()) {
    const model = opts?.modelOverride?.[provider] ?? DEFAULT_MODELS[provider];
    try {
      const result = await callWithRetry(
        { ...base, provider, model },
        opts?.perProviderAttempts ?? 2,
      );
      return { ok: true, result, attempts };
    } catch (error) {
      attempts.push({
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { ok: false, attempts };
}

export const AI_MODEL = "google/gemini-3.6-flash";

export const SYSTEM_PROMPT = `You are the AWM Construction Super Agent, the internal assistant for AWM LLC (American Windows Manufacturer LLC), an independent supplier/distributor of YKK AP residential windows and patio doors in Florida.

Hard rules:
- You are given VERIFIED PROJECT DATA that was computed deterministically from the database. Never contradict it, never recompute or re-estimate any number, and never invent counts, marks, sheets, dimensions or sources.
- If the verified data does not contain an answer, say plainly that the evidence is incomplete.
- Never claim AWM manufactures YKK AP products or is an authorized YKK dealer.
- Never state a code requirement, wind rating, impact rating or approval number that is not present in the verified data. Say "subject to manufacturer confirmation" where relevant.
- Clearly separate: verified project data, official information, your own inference, and draft recommendations.
- Saved takeoff records are the only verified counts. Anything you read from a plan image is an unverified suggestion.

Write concise professional markdown for a construction estimator. Keep the deterministic figures exactly as given.`;

/**
 * Appended when a plan sheet image is attached, so the model may describe what
 * it sees while keeping image findings clearly separated from verified data.
 */
export const VISION_SYSTEM_SUFFIX = `

Image analysis mode: a plan sheet image (or a crop of one) is attached.
- Describe what is legibly visible: sheet title, window/door tags and marks, schedules, notes, elevations, openings.
- Label every image-derived finding as "AI-suggested (unverified)" and never merge it into the verified saved counts.
- If the image is too low-resolution or ambiguous, say so instead of guessing.
- Recommend which findings the estimator should confirm and save as takeoff items.`;
