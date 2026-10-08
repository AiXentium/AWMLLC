/**
 * Continuous Project Intelligence Model.
 *
 * One persistent, versioned fact store per project. Intake, project-information
 * extraction, sheet classification, schedule reading, callout correlation and
 * takeoff all write into the same tables instead of running disconnected jobs,
 * so approving a preliminary review continues from what is already known rather
 * than restarting the analysis.
 *
 * Every fact keeps its provenance (sources), confidence, version and
 * user-confirmed status. Facts a person has confirmed, corrected or rejected
 * are never silently overwritten by a later AI pass.
 */
import { supabase } from "@/integrations/supabase/client";

export type FactStatus = "ai_suggested" | "user_confirmed" | "user_corrected" | "rejected";

export type FactSource = {
  label: string;
  pageId?: string | null;
  pageNumber?: number | null;
  detail?: string | null;
};

export type FactType =
  | "sheet_classification"
  | "working_set_selection"
  | "schedule_row"
  | "plan_callout"
  | "coverage"
  | "conflict"
  | "quantity_note";

export type IntelligenceFact = {
  projectId: string;
  runId?: string | null;
  documentId?: string | null;
  pageId?: string | null;
  factType: FactType;
  factKey: string;
  label?: string | null;
  value: Record<string, unknown>;
  sources?: FactSource[];
  reasoning?: string | null;
  confidence?: number;
};

export type QuantityEstimate = {
  projectId: string;
  runId?: string | null;
  bucket: string;
  label: string;
  quantity: number;
  confidence: number;
  coverage?: string | null;
  reasoning?: string | null;
  sourceCounts: { source: string; count: number; detail?: string | null }[];
  marks?: { mark: string; quantity: number; pageId?: string | null; sourceSheet?: string | null }[];
};

/** Facts a person has ruled on stay authoritative; AI passes only refine the rest. */
const USER_DECIDED: FactStatus[] = ["user_confirmed", "user_corrected", "rejected"];

/**
 * Merges a batch of facts into the project model. Existing AI-suggested facts
 * are refined in place with an incremented version; user-decided facts are left
 * untouched.
 */
export async function recordFacts(projectId: string, facts: IntelligenceFact[]) {
  if (!facts.length) return;

  const keys = facts.map((f) => f.factKey);
  const existing = new Map<
    string,
    { id: string; status: string; version: number; fact_type: string }
  >();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase
      .from("project_intelligence_facts")
      .select("id,fact_key,fact_type,status,version")
      .eq("project_id", projectId)
      .in("fact_key", keys.slice(i, i + 200));
    for (const row of data ?? []) existing.set(`${row.fact_type}:${row.fact_key}`, row);
  }

  const inserts: Record<string, unknown>[] = [];
  for (const fact of facts) {
    const prior = existing.get(`${fact.factType}:${fact.factKey}`);
    const payload = {
      project_id: projectId,
      run_id: fact.runId ?? null,
      document_id: fact.documentId ?? null,
      page_id: fact.pageId ?? null,
      fact_type: fact.factType,
      fact_key: fact.factKey,
      label: fact.label ?? null,
      value: fact.value as never,
      sources: (fact.sources ?? []) as never,
      reasoning: fact.reasoning ?? null,
      confidence: fact.confidence ?? 0,
    };

    if (!prior) {
      inserts.push(payload);
      continue;
    }
    if (USER_DECIDED.includes(prior.status as FactStatus)) continue;
    await supabase
      .from("project_intelligence_facts")
      .update({ ...payload, version: prior.version + 1, superseded: false })
      .eq("id", prior.id);
  }

  for (let i = 0; i < inserts.length; i += 200) {
    await supabase.from("project_intelligence_facts").insert(inserts.slice(i, i + 200) as never);
  }
}

/** Upserts preliminary quantities, preserving any estimator override. */
export async function recordQuantities(projectId: string, estimates: QuantityEstimate[]) {
  if (!estimates.length) return;
  const { data: existing } = await supabase
    .from("project_quantity_estimates")
    .select("id,bucket,status,version")
    .eq("project_id", projectId);
  const byBucket = new Map((existing ?? []).map((r) => [r.bucket, r]));

  for (const estimate of estimates) {
    const payload = {
      project_id: projectId,
      run_id: estimate.runId ?? null,
      bucket: estimate.bucket,
      label: estimate.label,
      quantity: estimate.quantity,
      confidence: estimate.confidence,
      coverage: estimate.coverage ?? null,
      reasoning: estimate.reasoning ?? null,
      source_counts: estimate.sourceCounts as never,
      marks: (estimate.marks ?? []) as never,
    };
    const prior = byBucket.get(estimate.bucket);
    if (!prior) {
      await supabase.from("project_quantity_estimates").insert(payload as never);
      continue;
    }
    // A corrected quantity keeps the estimator's number; only the AI evidence refreshes.
    const keepUserNumber = prior.status === "user_corrected";
    await supabase
      .from("project_quantity_estimates")
      .update({
        ...payload,
        quantity: keepUserNumber ? undefined : estimate.quantity,
        version: prior.version + 1,
      } as never)
      .eq("id", prior.id);
  }
}

/**
 * Approval marks the current model as estimator-confirmed. Nothing is deleted,
 * so downstream takeoff, pricing and proposal modules continue from these facts.
 */
export async function confirmProjectIntelligence(
  projectId: string,
  runId: string,
  userId: string | null,
) {
  const stamp = new Date().toISOString();
  await supabase
    .from("project_intelligence_facts")
    .update({ status: "user_confirmed", decided_by: userId, decided_at: stamp })
    .eq("project_id", projectId)
    .eq("run_id", runId)
    .eq("status", "ai_suggested");
  await supabase
    .from("project_quantity_estimates")
    .update({ status: "user_confirmed", decided_by: userId, decided_at: stamp })
    .eq("project_id", projectId)
    .eq("status", "ai_suggested");
}

/** Reads the current model for a project — the entry point for future modules. */
export async function readProjectIntelligence(projectId: string, factType?: FactType) {
  let query = supabase
    .from("project_intelligence_facts")
    .select(
      "id,fact_type,fact_key,label,value,sources,reasoning,confidence,version,status,page_id,updated_at",
    )
    .eq("project_id", projectId)
    .eq("superseded", false);
  if (factType) query = query.eq("fact_type", factType);
  const { data } = await query.order("fact_type").order("fact_key");
  return data ?? [];
}
