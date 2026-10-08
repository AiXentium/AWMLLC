import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MARKER_TYPES, markerType } from "@/lib/takeoff-types";
import { narrateAiAnswer } from "./provider.functions";
import { logAudit } from "@/lib/audit";
import { parseSizePair } from "@/lib/takeoff/dimensions";
import { toast } from "sonner";

export type DetectionBox =
  { x1: number; y1: number; x2: number; y2: number } | Record<string, never>;

export type DetectionRow = {
  id: string;
  project_id: string;
  page_id: string | null;
  product_type: string | null;
  category: string;
  label: string | null;
  quantity: number;
  width_in: number | null;
  height_in: number | null;
  confidence: number | null;
  reasoning: string | null;
  bbox: DetectionBox;
  status: "pending" | "approved" | "rejected";
  approved_item_id: string | null;
  created_at: string;
};

const COLUMNS =
  "id,project_id,page_id,product_type,category,label,quantity,width_in,height_in,confidence,reasoning,bbox,status,approved_item_id,created_at";

export function useDetections(pageId: string | null) {
  return useQuery({
    enabled: Boolean(pageId),
    queryKey: ["ai-detections", pageId],
    queryFn: async (): Promise<DetectionRow[]> => {
      const { data, error } = await supabase
        .from("ai_detections")
        .select(COLUMNS)
        .eq("page_id", pageId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as DetectionRow[];
    },
  });
}

const TYPE_KEYS = MARKER_TYPES.map((t) => t.key).join(", ");

/** Extracts the first JSON object/array found in a model response. */
function parseJsonBlock(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new Error("The model did not return structured detections.");
  const slice = candidate.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const lastArray = slice.lastIndexOf("]");
    const lastObj = slice.lastIndexOf("}");
    const end = Math.max(lastArray, lastObj);
    if (end <= 0) throw new Error("The model returned malformed JSON.");
    return JSON.parse(slice.slice(0, end + 1));
  }
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export type DetectionRunResult = {
  inserted: number;
  mode: "live" | "demo";
  error?: string;
  provider?: string;
  model?: string;
};

/**
 * Asks the vision model for structured opening detections and stores them as a
 * reviewable suggestion layer. Nothing enters the takeoff until a user approves.
 */
export async function runSheetDetection(opts: {
  projectId: string;
  pageId: string;
  imageDataUrl: string;
  /** Region of the full page the image covers, when only a crop was sent. */
  region?: { x1: number; y1: number; x2: number; y2: number } | null;
}): Promise<DetectionRunResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const facts = [
    "You are reviewing an image of a construction plan sheet region.",
    "Return ONLY a JSON array — no prose, no markdown fence.",
    "Each element must be:",
    `{"product_type": one of [${TYPE_KEYS}], "label": mark/tag shown on the plan or null, "quantity": integer, "width_text": dimension exactly as printed or null, "height_text": dimension exactly as printed or null, "confidence": 0-1, "reasoning": short string, "bbox": {"x1":0-1,"y1":0-1,"x2":0-1,"y2":0-1}}`,
    "bbox coordinates are normalized to the attached image (0,0 = top-left).",
    'Transcribe width_text/height_text EXACTLY as printed (3\'-0", 36", 3060) — do not convert units, conversion happens downstream.',
    "Only include openings you can actually read in the image. Never invent dimensions.",
    "Return [] when no openings are legible.",
  ].join("\n");

  const narration = await narrateAiAnswer({
    data: {
      prompt:
        "Detect every window, door, storefront, curtain wall and glazed opening visible in this plan image.",
      facts,
      agentLabel: "Plan Detection Analyst",
      taskCategory: "vision_analysis",
      projectId: opts.projectId,
      conversationId: null,
      images: [opts.imageDataUrl],
      // Opening counts are takeoff math — Claude Opus counts when configured.
      mathTask: true,
    },
  });

  if (!narration.text) {
    return {
      inserted: 0,
      mode: "demo",
      error: narration.error ?? "No AI provider is available for detection right now.",
    };
  }

  const parsed = parseJsonBlock(narration.text);
  const list = Array.isArray(parsed) ? parsed : [];
  const region = opts.region;

  const rows = list.slice(0, 60).map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const typeKey = markerType(String(entry.product_type ?? ""))
      ? String(entry.product_type)
      : "custom_window";
    const type = markerType(typeKey)!;
    // Dimensions: the model transcribes raw text; conversion to inches is
    // deterministic (never model arithmetic). Falls back to legacy numeric
    // fields for older cached detections.
    const parsedSize = parseSizePair(
      entry.width_text != null ? String(entry.width_text) : null,
      entry.height_text != null ? String(entry.height_text) : null,
    );
    const box = (entry.bbox ?? {}) as Record<string, unknown>;
    let bbox: DetectionBox = {};
    const x1 = num(box.x1);
    const y1 = num(box.y1);
    const x2 = num(box.x2);
    const y2 = num(box.y2);
    if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
      const map = (v: number, lo: number, hi: number) =>
        clamp01(region ? lo + clamp01(v) * (hi - lo) : clamp01(v));
      const rx1 = region ? Math.min(region.x1, region.x2) : 0;
      const rx2 = region ? Math.max(region.x1, region.x2) : 1;
      const ry1 = region ? Math.min(region.y1, region.y2) : 0;
      const ry2 = region ? Math.max(region.y1, region.y2) : 1;
      bbox = {
        x1: map(x1, rx1, rx2),
        y1: map(y1, ry1, ry2),
        x2: map(x2, rx1, rx2),
        y2: map(y2, ry1, ry2),
      };
    }
    return {
      project_id: opts.projectId,
      page_id: opts.pageId,
      product_type: typeKey,
      category: type.category,
      label: entry.label ? String(entry.label).slice(0, 60) : null,
      quantity: Math.max(1, Math.round(num(entry.quantity) ?? 1)),
      width_in: parsedSize?.widthIn ?? num(entry.width_in),
      height_in: parsedSize?.heightIn ?? num(entry.height_in),
      confidence: num(entry.confidence),
      reasoning: entry.reasoning ? String(entry.reasoning).slice(0, 600) : null,
      bbox: bbox as never,
      raw: entry as never,
      status: "pending",
      created_by: userId,
    };
  });

  if (!rows.length) {
    return { inserted: 0, mode: "live", provider: narration.provider, model: narration.model };
  }

  const { error } = await supabase.from("ai_detections").insert(rows);
  if (error) throw error;
  return {
    inserted: rows.length,
    mode: "live",
    provider: narration.provider,
    model: narration.model,
  };
}

export function useDetectionReview(projectId: string, pageId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ai-detections", pageId] });
    qc.invalidateQueries({ queryKey: ["page-items", pageId] });
    qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
  };

  const approve = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch?: Partial<DetectionRow> }) => {
      if (!ids.length) throw new Error("Select at least one suggestion.");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const { data: rows, error } = await supabase
        .from("ai_detections")
        .select(COLUMNS)
        .in("id", ids);
      if (error) throw error;

      const approved: { itemId: string; bbox: DetectionBox }[] = [];
      for (const row of (rows ?? []) as unknown as DetectionRow[]) {
        if (row.status === "approved") continue;
        const merged = { ...row, ...(ids.length === 1 ? (patch ?? {}) : {}) };
        const type = markerType(merged.product_type) ?? markerType("custom_window")!;
        const box = merged.bbox as { x1?: number; y1?: number; x2?: number; y2?: number };
        const cx = box.x1 !== undefined && box.x2 !== undefined ? (box.x1 + box.x2) / 2 : 0.5;
        const cy = box.y1 !== undefined && box.y2 !== undefined ? (box.y1 + box.y2) / 2 : 0.5;

        const { data: created, error: insertError } = await supabase
          .from("takeoff_items")
          .insert({
            project_id: row.project_id,
            page_id: row.page_id,
            category: type.category,
            product_type: merged.product_type,
            type_name: type.label,
            mark: merged.label ?? `${type.markPrefix}?`,
            quantity: merged.quantity ?? 1,
            width_in: merged.width_in,
            height_in: merged.height_in,
            color: type.color,
            source_x: cx,
            source_y: cy,
            ai_confidence: merged.confidence,
            notes: merged.reasoning ? `AI suggestion: ${merged.reasoning}` : null,
            status: "review",
            created_by: userId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from("ai_detections")
          .update({
            status: "approved",
            approved_item_id: created.id,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            product_type: merged.product_type,
            label: merged.label,
            quantity: merged.quantity,
            width_in: merged.width_in,
            height_in: merged.height_in,
          })
          .eq("id", row.id);
        if (updateError) throw updateError;
        approved.push({ itemId: created.id, bbox: merged.bbox });
      }
      return approved;
    },
    onSuccess: (approved) => {
      invalidate();
      toast.success(`${approved.length} detection${approved.length === 1 ? "" : "s"} approved`, {
        description: "Approved suggestions were added to the takeoff in review status.",
      });
      logAudit({
        projectId,
        action: "ai.detection_approved",
        entityType: "ai_detection",
        detail: { approved: approved.length, page_id: pageId },
      }).then(() => qc.invalidateQueries({ queryKey: ["activity", projectId] }));
    },
    onError: (e: Error) => toast.error("Could not approve detections", { description: e.message }),
  });

  const reject = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) throw new Error("Select at least one suggestion.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_detections")
        .update({
          status: "rejected",
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast.info(`${count} detection${count === 1 ? "" : "s"} rejected`);
      logAudit({
        projectId,
        action: "ai.detection_rejected",
        entityType: "ai_detection",
        detail: { rejected: count, page_id: pageId },
      }).then(() => qc.invalidateQueries({ queryKey: ["activity", projectId] }));
    },
    onError: (e: Error) => toast.error("Could not reject detections", { description: e.message }),
  });

  return { approve, reject };
}
