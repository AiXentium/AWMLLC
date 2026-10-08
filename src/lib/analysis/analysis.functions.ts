import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import type { SheetCategory } from "./shared";
import type { OcrSource } from "@/lib/ocr/types";

export type ClassifySheetsInput = {
  projectId: string;
  sheets: {
    pageNumber: number;
    sheetLabel: string | null;
    title: string | null;
    text: string;
    hint: string;
  }[];
};

export type ClassifySheetsOutput = {
  sheets: {
    pageNumber: number;
    category: SheetCategory;
    confidence: number;
    reason: string | null;
  }[];
  provider?: string;
  model?: string;
  error?: string;
};

export type ReadSchedulesInput = {
  projectId: string;
  sheets: {
    pageNumber: number;
    sheetLabel: string | null;
    category: string;
    text: string;
    ocrSource?: OcrSource | null;
    ocrConfidence?: number | null;
    ocrNeedsReview?: boolean | null;
  }[];
  images: string[];
};

export type ReadSchedulesOutput = {
  rows: {
    pageNumber: number | null;
    scheduleType: "window" | "door" | "glazing";
    mark: string | null;
    typeLabel: string | null;
    width: string | null;
    height: string | null;
    quantity: number;
    material: string | null;
    glazing: string | null;
    operation: string | null;
    notes: string | null;
    confidence: number;
  }[];
  provider?: string;
  model?: string;
  error?: string;
};

/** Shared bookkeeping: routed chain, ai_runs row, ai_usage row. */
async function withRoutedRun<T>(
  context: { supabase: typeof import("@/integrations/supabase/client").supabase; userId: string },
  opts: {
    projectId: string;
    taskCategory: "document_classification" | "vision_analysis" | "document_summarization";
    agentKey: string;
    needsVision?: boolean;
    /** When true, Claude Opus leads the chain (takeoff math: counting, schedules). */
    mathTask?: boolean;
  },
  execute: (
    chain: { provider: "openrouter" | "gemini" | "groq" | "openai" | "anthropic"; model: string }[],
    maxTokens: number | null,
  ) => Promise<{
    value: T;
    provider?: string;
    model?: string;
    usage?: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
    error?: string;
  }>,
): Promise<{ value: T; provider?: string; model?: string; error?: string }> {
  const { buildChain } = await import("@/lib/extraction/extraction.server");

  const { data: route } = await context.supabase
    .from("ai_model_routes")
    .select("provider,model,fallback_provider,fallback_model,max_output_tokens,enabled")
    .eq("task_category", opts.taskCategory)
    .eq("enabled", true)
    .maybeSingle();

  const started = Date.now();
  const { data: run } = await context.supabase
    .from("ai_runs")
    .insert({
      project_id: opts.projectId,
      user_id: context.userId,
      task_category: opts.taskCategory,
      agent_key: opts.agentKey,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  const result = await execute(
    buildChain(route ?? null, { needsVision: opts.needsVision, mathTask: opts.mathTask }),
    route?.max_output_tokens ?? 4096,
  );

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
      project_id: opts.projectId,
      provider: result.provider,
      model: result.model,
      task_category: opts.taskCategory,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      estimated_cost_usd: result.usage.costUsd,
      latency_ms: result.usage.latencyMs,
      succeeded: true,
      used_fallback: false,
    });
  }

  return {
    value: result.value,
    provider: result.provider,
    model: result.model,
    error: result.error,
  };
}

async function assertProjectVisible(
  supabase: typeof import("@/integrations/supabase/client").supabase,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Project not found or not visible to you.");
}

/**
 * Classifies a batch of sheets into takeoff-relevant categories. RLS enforces
 * that the caller can see the project.
 */
export const classifyPlanSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ClassifySheetsInput) => {
    if (!input?.projectId) throw new Error("A project is required.");
    return {
      projectId: String(input.projectId),
      sheets: (input.sheets ?? []).slice(0, 40).map((s) => ({
        pageNumber: Number(s.pageNumber) || 0,
        sheetLabel: s.sheetLabel ? String(s.sheetLabel).slice(0, 60) : null,
        title: s.title ? String(s.title).slice(0, 160) : null,
        text: String(s.text ?? "").slice(0, 2500),
        hint: String(s.hint ?? "other").slice(0, 40),
      })),
    };
  })
  .handler(async ({ data, context }): Promise<ClassifySheetsOutput> => {
    await assertProjectVisible(context.supabase, data.projectId);
    const { buildClassifyPrompt, normalizeClassification, runAnalysisModel, CLASSIFY_SYSTEM } =
      await import("./analysis.server");

    const outcome = await withRoutedRun<ClassifySheetsOutput["sheets"]>(
      context,
      {
        projectId: data.projectId,
        taskCategory: "document_classification",
        agentKey: "plan_sheet_classifier",
      },
      async (chain, maxTokens) => {
        const result = await runAnalysisModel({
          chain,
          system: CLASSIFY_SYSTEM,
          prompt: buildClassifyPrompt(data.sheets),
          images: [],
          maxOutputTokens: maxTokens,
        });
        return {
          value: result.error ? [] : normalizeClassification(result.raw),
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          error: result.error,
        };
      },
    );

    return {
      sheets: outcome.value,
      provider: outcome.provider,
      model: outcome.model,
      error: outcome.error,
    };
  });

/** Reads window/door/glazing schedule rows off the identified schedule sheets. */
export const readPlanSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReadSchedulesInput) => {
    if (!input?.projectId) throw new Error("A project is required.");
    return {
      projectId: String(input.projectId),
      sheets: (input.sheets ?? []).slice(0, 6).map((s) => ({
        pageNumber: Number(s.pageNumber) || 0,
        sheetLabel: s.sheetLabel ? String(s.sheetLabel).slice(0, 60) : null,
        category: String(s.category ?? "window_schedule").slice(0, 40),
        text: String(s.text ?? "").slice(0, 9000),
        ocrSource: (s.ocrSource === "pdf-text" ||
        s.ocrSource === "tesseract" ||
        s.ocrSource === "google-document-ai" ||
        s.ocrSource === "azure-document-intelligence"
          ? s.ocrSource
          : null) as OcrSource | null,
        ocrConfidence: typeof s.ocrConfidence === "number" ? s.ocrConfidence : null,
        ocrNeedsReview: Boolean(s.ocrNeedsReview),
      })),
      images: (input.images ?? []).slice(0, 3).map((i) => String(i).slice(0, 3_000_000)),
    };
  })
  .handler(async ({ data, context }): Promise<ReadSchedulesOutput> => {
    await assertProjectVisible(context.supabase, data.projectId);
    const { buildSchedulePrompt, normalizeSchedule, runAnalysisModel, SCHEDULE_SYSTEM } =
      await import("./analysis.server");

    const outcome = await withRoutedRun<ReadSchedulesOutput["rows"]>(
      context,
      {
        projectId: data.projectId,
        taskCategory: data.images.length ? "vision_analysis" : "document_summarization",
        agentKey: "plan_schedule_reader",
        needsVision: data.images.length > 0,
        // Schedule rows are takeoff math — Claude Opus counts when configured.
        mathTask: true,
      },
      async (chain, maxTokens) => {
        const result = await runAnalysisModel({
          chain,
          system: SCHEDULE_SYSTEM,
          prompt: buildSchedulePrompt(data.sheets, data.images.length > 0),
          images: data.images,
          maxOutputTokens: Math.max(maxTokens ?? 4096, 4096),
        });
        return {
          value: result.error ? [] : normalizeSchedule(result.raw),
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          error: result.error,
        };
      },
    );

    return {
      rows: outcome.value,
      provider: outcome.provider,
      model: outcome.model,
      error: outcome.error,
    };
  });

export type ExtractTitleBlocksInput = {
  projectId: string;
  sheets: {
    pageNumber: number;
    text: string;
  }[];
};

export type ExtractTitleBlocksOutput = {
  sheets: {
    pageNumber: number;
    sheet_number: string | null;
    title: string | null;
    confidence: number;
  }[];
  provider?: string;
  model?: string;
  error?: string;
};

/** AI fallback for title block extraction when regex finds nothing. Batched. */
export const extractTitleBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractTitleBlocksInput) => {
    if (!input?.projectId) throw new Error("A project is required.");
    return {
      projectId: String(input.projectId),
      sheets: (input.sheets ?? []).slice(0, 20).map((s) => ({
        pageNumber: Number(s.pageNumber) || 0,
        text: String(s.text ?? "").slice(0, 1500),
      })),
    };
  })
  .handler(async ({ data, context }): Promise<ExtractTitleBlocksOutput> => {
    await assertProjectVisible(context.supabase, data.projectId);
    const { buildTitleBlockPrompt, normalizeTitleBlock, runAnalysisModel, TITLE_BLOCK_SYSTEM } =
      await import("./analysis.server");

    const outcome = await withRoutedRun<ExtractTitleBlocksOutput["sheets"]>(
      context,
      {
        projectId: data.projectId,
        taskCategory: "document_summarization",
        agentKey: "plan_title_block_reader",
      },
      async (chain, maxTokens) => {
        const result = await runAnalysisModel({
          chain,
          system: TITLE_BLOCK_SYSTEM,
          prompt: buildTitleBlockPrompt(data.sheets),
          images: [],
          maxOutputTokens: maxTokens,
        });
        return {
          value: result.error ? [] : normalizeTitleBlock(result.raw),
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          error: result.error,
        };
      },
    );

    return {
      sheets: outcome.value,
      provider: outcome.provider,
      model: outcome.model,
      error: outcome.error,
    };
  });
