import { supabase } from "@/integrations/supabase/client";
import { agentLabel } from "./agents";
import { narrateAiAnswer } from "./provider.functions";
import { routeIntent } from "./router";
import { TOOL_MAP } from "./tools";
import { TRADE_AGENT_MAP, type TradeId } from "@/lib/trades/registry";
import type { AiAnswer, AiContext, AiSource, ToolRunLog } from "./types";

function dedupeSources(sources: AiSource[]) {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.type}:${s.entityId ?? s.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Maps a specialist agent to a row in ai_model_routes. */
const TASK_CATEGORY: Partial<Record<AiAnswer["agent"], string>> = {
  document: "document_summarization",
  takeoff: "takeoff_review",
  window_glazing: "window_door_classification",
  door_hardware: "window_door_classification",
  schedule: "pdf_schedule_analysis",
  combination_mull: "construction_reasoning",
  jurisdiction_code: "jurisdiction_research",
  safety_egress: "safety_review",
  ykk_product: "ykk_product_reasoning",
  quote_readiness: "construction_reasoning",
  quality_control: "takeoff_review",
  file_manager: "fast_low_cost",
  export_report: "report_rfi_writing",
  portal_automation: "tool_planning",
  installation: "construction_reasoning",
  legal_contract: "report_rfi_writing",
  general: "general_chat",
  // Trade specialists answer with construction reasoning.
  trade_glazing: "window_door_classification",
  trade_roofing: "construction_reasoning",
  trade_concrete: "construction_reasoning",
  trade_masonry: "construction_reasoning",
  trade_steel: "construction_reasoning",
  trade_framing: "construction_reasoning",
  trade_drywall: "construction_reasoning",
  trade_fire: "construction_reasoning",
  trade_plumbing: "construction_reasoning",
  trade_hvac: "construction_reasoning",
  trade_electrical: "construction_reasoning",
  trade_earthwork: "construction_reasoning",
  trade_exterior: "construction_reasoning",
};

/** Approved project + company memory, injected as context only. */
async function loadApprovedMemory(projectId: string | null) {
  const { data } = await supabase
    .from("ai_memory")
    .select("scope,title,content,project_id")
    .eq("approved", true)
    .eq("disabled", false)
    .in("scope", ["project", "company"])
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? [])
    .filter((m) => m.scope === "company" || !m.project_id || m.project_id === projectId)
    .map((m) => `- [${m.scope}] ${m.title ? `${m.title}: ` : ""}${m.content}`)
    .join("\n");
}

function confidenceFor(runs: ToolRunLog[], sourceCount: number) {
  const failed = runs.filter((r) => r.status === "failed").length;
  if (!runs.length) return 0.3;
  if (failed === runs.length) return 0.2;
  const base = 0.72 + Math.min(0.2, sourceCount * 0.02);
  return Math.max(0.25, base - failed * 0.25);
}

export function confidenceLabel(v: number) {
  if (v >= 0.8) return "High — deterministic database result";
  if (v >= 0.55) return "Moderate — database result with partial evidence";
  return "Low — evidence incomplete";
}

export async function runSuperAgent(opts: {
  prompt: string;
  context: AiContext;
  conversationId: string | null;
  userId: string;
  liveMode: boolean;
}): Promise<AiAnswer> {
  const { prompt, context, conversationId, userId, liveMode } = opts;
  const intent = routeIntent(prompt);
  const toolRuns: ToolRunLog[] = [];
  const sources: AiSource[] = [];
  const sections: string[] = [];
  let approval: AiAnswer["approval"] = null;

  for (const call of intent.tools) {
    const def = TOOL_MAP.get(call.name);
    if (!def) continue;
    const started = performance.now();
    try {
      const result = await def.run(context, call.args);
      const durationMs = Math.round(performance.now() - started);
      const status: ToolRunLog["status"] = result.approval ? "awaiting_approval" : "completed";
      toolRuns.push({
        toolName: def.name,
        toolLabel: def.label,
        agent: def.agent,
        status,
        durationMs,
        input: call.args ?? {},
      });
      sections.push(result.summary);
      sources.push(...result.sources);
      if (result.approval && !approval) approval = result.approval;

      void supabase.from("ai_tool_runs").insert({
        conversation_id: conversationId,
        project_id: context.projectId,
        user_id: userId,
        tool_name: def.name,
        agent_key: def.agent,
        input: (call.args ?? {}) as never,
        output: { summaryLength: result.summary.length, ...result.data } as never,
        status,
        requires_approval: !def.readOnly,
        duration_ms: durationMs,
      });
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const message = error instanceof Error ? error.message : "Tool failed.";
      toolRuns.push({
        toolName: def.name,
        toolLabel: def.label,
        agent: def.agent,
        status: "failed",
        durationMs,
        input: call.args ?? {},
        error: message,
      });
      sections.push(`⚠️ **${def.label}** could not run: ${message}`);
      void supabase.from("ai_tool_runs").insert({
        conversation_id: conversationId,
        project_id: context.projectId,
        user_id: userId,
        tool_name: def.name,
        agent_key: def.agent,
        input: (call.args ?? {}) as never,
        status: "failed",
        requires_approval: !def.readOnly,
        error_message: message,
        duration_ms: durationMs,
      });
    }
  }

  const facts = sections.join("\n\n---\n\n");
  const label = agentLabel(intent.agent);
  let text = facts || "I could not find any project data for that request.";
  let mode: "demo" | "live" = "demo";
  let providerInfo: { provider: string; model: string; usedFallback: boolean } | null = null;

  if (liveMode && facts) {
    try {
      const memory = await loadApprovedMemory(context.projectId);
      // Trade specialists answer in persona, with their codes and expertise.
      const tradePersona = intent.agent.startsWith("trade_")
        ? (TRADE_AGENT_MAP[intent.agent as TradeId]?.systemPrompt ?? "")
        : "";
      const narration = await narrateAiAnswer({
        data: {
          prompt,
          facts,
          agentLabel: label,
          agentPersona: tradePersona || undefined,
          taskCategory: TASK_CATEGORY[intent.agent] ?? "general_chat",
          memory,
          projectId: context.projectId,
          conversationId,
        },
      });
      if (narration.text) {
        text = narration.text;
        mode = "live";
        providerInfo = {
          provider: narration.provider ?? "unknown",
          model: narration.model ?? "unknown",
          usedFallback: Boolean(narration.usedFallback),
        };
      }
    } catch {
      /* fall back to deterministic text */
    }
  }

  if (mode === "demo") {
    text = [
      `_Demo AI Mode — deterministic database answer, no language model used._`,
      "",
      text,
    ].join("\n");
  }

  const unique = dedupeSources(sources);
  const confidence = confidenceFor(toolRuns, unique.length);

  return {
    text,
    agent: intent.agent,
    agentLabel: label,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    sources: unique,
    toolRuns,
    mode,
    approval,
    proposedMemory: null,
    providerInfo,
  };
}
