import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export type AiProviderStatus = {
  mode: "demo" | "live";
  provider: string;
  model: string;
  reason: string;
  /** Masked availability of each server-side key. Never returns key material. */
  keys: {
    openrouter: boolean;
    gemini: boolean;
    groq: boolean;
    openai: boolean;
    anthropic: boolean;
  };
};

export type NarrationResult = {
  text: string | null;
  mode: "demo" | "live";
  provider?: string;
  model?: string;
  usedFallback?: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  error?: string;
};

export const getAiProviderStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiProviderStatus> => {
    const { configuredProviders, FREE_PROVIDERS } = await import("./providers.server");
    const available = configuredProviders();
    const keys = {
      openrouter: available.includes("openrouter"),
      gemini: available.includes("gemini"),
      groq: available.includes("groq"),
      openai: available.includes("openai"),
      anthropic: available.includes("anthropic"),
    };

    if (!available.length) {
      return {
        mode: "demo",
        provider: "none",
        model: "—",
        reason:
          "No server-side model key is configured. Responses are deterministic database answers only.",
        keys,
      };
    }

    const freeCount = available.filter((p) => (FREE_PROVIDERS as string[]).includes(p)).length;
    const primary = available[0];
    return {
      mode: "live",
      provider: primary,
      model:
        "Free-first rotation" + (freeCount ? ` (${freeCount} free)` : "") + ", paid fallback last",
      reason:
        "Server-side model keys are configured. Free providers are tried first and the paid providers are kept as last-resort fallbacks. Deterministic database facts are computed first, then narrated by the routed model.",
      keys,
    };
  },
);

/** Admin-only connection test against a single provider. Returns no key material. */
export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      provider: "openrouter" | "gemini" | "groq" | "openai" | "anthropic";
      model?: string;
    }) => {
      if (
        !input ||
        !["openrouter", "gemini", "groq", "openai", "anthropic"].includes(input.provider)
      ) {
        throw new Error("Unknown provider.");
      }
      return {
        provider: input.provider,
        model: input.model ? String(input.model).slice(0, 120) : undefined,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only workspace administrators can test provider connections.");

    const { callProvider, providerApiKey, DEFAULT_MODELS } = await import("./providers.server");
    const model = data.model || DEFAULT_MODELS[data.provider];

    if (!providerApiKey(data.provider)) {
      await context.supabase
        .from("ai_provider_configs")
        .update({
          status: "not_configured",
          key_configured: false,
          last_test_at: new Date().toISOString(),
          last_error: "No API key configured.",
        })
        .eq("provider", data.provider);
      return { ok: false, error: "No API key configured for this provider.", model };
    }

    try {
      const result = await callProvider({
        provider: data.provider,
        model,
        system: "You are a connection test. Reply with the single word OK.",
        prompt: "Reply with OK.",
        maxOutputTokens: 16,
        timeoutMs: 20_000,
      });
      await context.supabase
        .from("ai_provider_configs")
        .update({
          status: "ready",
          key_configured: true,
          last_test_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("provider", data.provider);
      return { ok: true, model, latencyMs: result.latencyMs, sample: result.text.slice(0, 80) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider test failed.";
      await context.supabase
        .from("ai_provider_configs")
        .update({
          status: "error",
          key_configured: true,
          last_test_at: new Date().toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("provider", data.provider);
      return { ok: false, error: message, model };
    }
  });

/**
 * Narrates deterministic facts. The model never computes values — it only
 * rewrites verified data that was already read from the database under RLS.
 * Routes through ai_model_routes with retry, provider fallback, and usage logging.
 */
export const narrateAiAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      facts: string;
      agentLabel: string;
      agentPersona?: string;
      taskCategory?: string;
      memory?: string;
      projectId?: string | null;
      conversationId?: string | null;
      images?: string[];
      /** When true, Claude Opus leads the chain (takeoff math: counting). */
      mathTask?: boolean;
    }) => {
      if (!input || typeof input.prompt !== "string" || typeof input.facts !== "string") {
        throw new Error("Invalid narration request.");
      }
      return {
        prompt: input.prompt.slice(0, 4000),
        facts: input.facts.slice(0, 24000),
        agentLabel: String(input.agentLabel ?? "AWM Construction Super Agent").slice(0, 120),
        agentPersona: String(input.agentPersona ?? "").slice(0, 3000),
        taskCategory: String(input.taskCategory ?? "general_chat").slice(0, 60),
        memory: String(input.memory ?? "").slice(0, 6000),
        projectId: input.projectId ?? null,
        conversationId: input.conversationId ?? null,
        images: (input.images ?? []).slice(0, 4).map((i) => String(i).slice(0, 2_000_000)),
        mathTask: Boolean(input.mathTask),
      };
    },
  )
  .handler(async ({ data, context }): Promise<NarrationResult> => {
    const {
      callWithRetry,
      configuredProviders,
      estimateCostUsd,
      providerApiKey,
      PROVIDER_PRIORITY,
      DEFAULT_MODELS,
      defaultModelFor,
      takeoffMathCandidate,
      SYSTEM_PROMPT,
      VISION_SYSTEM_SUFFIX,
    } = await import("./providers.server");

    const system = data.images.length ? SYSTEM_PROMPT + VISION_SYSTEM_SUFFIX : SYSTEM_PROMPT;

    const available = configuredProviders();
    if (!available.length) return { text: null, mode: "demo" };

    // ---- Resolve the routing chain from ai_model_routes -------------------
    const { data: route } = await context.supabase
      .from("ai_model_routes")
      .select(
        "provider,model,fallback_provider,fallback_model,max_output_tokens,enabled,requires_vision",
      )
      .eq("task_category", data.taskCategory)
      .eq("enabled", true)
      .maybeSingle();

    type Candidate = {
      provider: "openrouter" | "gemini" | "groq" | "openai" | "anthropic";
      model: string;
    };
    const chain: Candidate[] = [];

    // Rotation order is always free-first (OpenRouter → Gemini → Groq), paid last.
    // The DB route's per-provider model choices are honored; only the order is fixed.
    // Vision tasks skip providers without a vision-capable free model.
    const needsVision = data.images.length > 0;
    const routeModels = new Map<string, string>();
    if (route?.provider && route?.model) routeModels.set(route.provider, route.model);
    if (route?.fallback_provider && route?.fallback_model)
      routeModels.set(route.fallback_provider, route.fallback_model);
    // Takeoff math (opening counts) leads with Claude Opus when the Anthropic
    // key is configured; otherwise the free-first rotation runs as usual.
    // Opus failures fall through to the normal rotation.
    if (data.mathTask) {
      const math = takeoffMathCandidate();
      if (math) chain.push(math);
    }
    for (const p of PROVIDER_PRIORITY) {
      const model = routeModels.get(p) ?? defaultModelFor(p, needsVision);
      if (!model) continue;
      chain.push({ provider: p, model });
    }

    const usable = chain.filter((c) => Boolean(providerApiKey(c.provider)));
    if (!usable.length) return { text: null, mode: "demo" };

    const startedAt = new Date().toISOString();
    const { data: run } = await context.supabase
      .from("ai_runs")
      .insert({
        conversation_id: data.conversationId,
        project_id: data.projectId,
        user_id: context.userId,
        task_category: data.taskCategory,
        status: "running",
        provider: usable[0].provider,
        model: usable[0].model,
        started_at: startedAt,
      })
      .select("id")
      .maybeSingle();

    const prompt = [
      `Specialist handling this request: ${data.agentLabel}`,
      data.agentPersona
        ? `\nSPECIALIST PERSONA (answer as this trade expert):\n${data.agentPersona}`
        : "",
      data.memory
        ? `\nAPPROVED PROJECT/COMPANY MEMORY (context only, never override verified data):\n${data.memory}`
        : "",
      ``,
      `USER QUESTION:`,
      data.prompt,
      ``,
      `VERIFIED PROJECT DATA (computed from the database — reproduce figures exactly):`,
      data.facts,
      ``,
      `Answer the user's question using only the verified project data above.`,
    ].join("\n");

    let lastError = "Model request failed.";
    for (let i = 0; i < usable.length; i++) {
      const candidate = usable[i];
      try {
        const result = await callWithRetry({
          provider: candidate.provider,
          model: candidate.model,
          system,
          prompt,
          images: data.images.length ? data.images : undefined,
          maxOutputTokens: route?.max_output_tokens ?? 2048,
          timeoutMs: 45_000,
        });

        const cost = estimateCostUsd(result.model, result.inputTokens, result.outputTokens);
        const usedFallback = i > 0;

        if (run?.id) {
          await context.supabase
            .from("ai_runs")
            .update({
              status: "succeeded",
              provider: result.provider,
              model: result.model,
              used_fallback: usedFallback,
              attempt: i + 1,
              finished_at: new Date().toISOString(),
              latency_ms: result.latencyMs,
            })
            .eq("id", run.id);
        }

        await context.supabase.from("ai_usage").insert({
          run_id: run?.id ?? null,
          user_id: context.userId,
          project_id: data.projectId,
          provider: result.provider,
          model: result.model,
          task_category: data.taskCategory,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          estimated_cost_usd: cost,
          latency_ms: result.latencyMs,
          succeeded: true,
          used_fallback: usedFallback,
        });

        return {
          text: result.text,
          mode: "live",
          provider: result.provider,
          model: result.model,
          usedFallback,
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: cost,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Model request failed.";
      }
    }

    if (run?.id) {
      await context.supabase
        .from("ai_runs")
        .update({
          status: "failed",
          error_message: lastError.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    return { text: null, mode: "demo", error: lastError };
  });

export type { ProviderKey } from "./providers.server";
