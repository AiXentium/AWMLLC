import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export type ExtractProjectInfoInput = {
  projectId: string;
  taskCategory?: "document_summarization" | "vision_analysis";
  sheets: { pageNumber: number; sheetLabel: string | null; text: string }[];
  images: string[];
  missingOnly?: string[] | null;
};

export type ExtractProjectInfoOutput = {
  fields: {
    key: string;
    value: string;
    confidence: number;
    pageNumber: number | null;
    snippet: string | null;
  }[];
  addresses: {
    address: string;
    role: "site" | "architect" | "owner" | "contractor" | "engineer" | "unknown";
    label: string | null;
    pageNumber: number | null;
    confidence: number;
    score: number;
  }[];
  provider?: string;
  model?: string;
  error?: string;
};

/**
 * Reads project record data out of supplied sheet text (or sheet images for
 * scanned sets) using the routed AI provider. Access is enforced by RLS: the
 * caller must be able to see the project.
 */
export const extractProjectInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractProjectInfoInput) => {
    if (!input?.projectId) throw new Error("A project is required.");
    return {
      projectId: String(input.projectId),
      taskCategory:
        input.taskCategory === "vision_analysis" ? "vision_analysis" : "document_summarization",
      sheets: (input.sheets ?? []).slice(0, 8).map((s) => ({
        pageNumber: Number(s.pageNumber) || 0,
        sheetLabel: s.sheetLabel ? String(s.sheetLabel).slice(0, 60) : null,
        text: String(s.text ?? "").slice(0, 9000),
      })),
      images: (input.images ?? []).slice(0, 3).map((i) => String(i).slice(0, 3_000_000)),
      missingOnly: Array.isArray(input.missingOnly)
        ? input.missingOnly.map(String).slice(0, 60)
        : null,
    };
  })
  .handler(async ({ data, context }): Promise<ExtractProjectInfoOutput> => {
    const { data: project, error: projectError } = await context.supabase
      .from("projects")
      .select("id,city,postal_code")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new Error("Project not found or not visible to you.");

    const { buildChain, buildExtractionPrompt, runExtractionModel, scoreAddress } =
      await import("./extraction.server");

    const { data: route } = await context.supabase
      .from("ai_model_routes")
      .select("provider,model,fallback_provider,fallback_model,max_output_tokens,enabled")
      .eq("task_category", data.taskCategory)
      .eq("enabled", true)
      .maybeSingle();

    const started = Date.now();
    const { data: run } = await context.supabase
      .from("ai_runs")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        task_category: data.taskCategory,
        agent_key: "project_info_extraction",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    const result = await runExtractionModel({
      chain: buildChain(route ?? null, { needsVision: data.images.length > 0 }),
      prompt: buildExtractionPrompt({
        sheets: data.sheets,
        hasImages: data.images.length > 0,
        missingOnly: data.missingOnly,
      }),
      images: data.images,
      maxOutputTokens: route?.max_output_tokens ?? 2048,
    });

    if (run?.id) {
      await context.supabase
        .from("ai_runs")
        .update({
          status: result.error ? "failed" : "succeeded",
          provider: result.provider ?? null,
          model: result.model ?? null,
          error_message: result.error ? result.error.slice(0, 500) : null,
          finished_at: new Date().toISOString(),
          latency_ms: Date.now() - started,
        })
        .eq("id", run.id);
    }

    if (result.usage && result.provider && result.model) {
      await context.supabase.from("ai_usage").insert({
        run_id: run?.id ?? null,
        user_id: context.userId,
        project_id: data.projectId,
        provider: result.provider,
        model: result.model,
        task_category: data.taskCategory,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        estimated_cost_usd: result.usage.costUsd,
        latency_ms: result.usage.latencyMs,
        succeeded: true,
        used_fallback: false,
      });
    }

    const hints = { city: project.city, postal: project.postal_code, street: null };
    return {
      fields: result.fields,
      addresses: result.addresses
        .map((a) => ({ ...a, score: scoreAddress(a, result.fields, hints) }))
        .sort((a, b) => b.score - a.score),
      provider: result.provider,
      model: result.model,
      error: result.error,
    };
  });

/** Geocodes one address string. Uses OpenStreetMap Nominatim — no API key. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => {
    const address = String(input?.address ?? "").trim();
    if (address.length < 6) throw new Error("An address is required.");
    return { address: address.slice(0, 300) };
  })
  .handler(async ({ data }) => {
    const { geocodeAddressText } = await import("./extraction.server");
    return await geocodeAddressText(data.address);
  });
