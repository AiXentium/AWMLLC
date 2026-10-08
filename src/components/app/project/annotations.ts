import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatInches, formatSize } from "@/lib/takeoff/dimensions";

/** Normalized (0–1) geometry so markup survives zoom, rotation and re-render. */
export type AnnotationGeometry =
  | { kind: "rect"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

export type AnnotationTool = "highlight" | "measure" | "note";

export type AnnotationRow = {
  id: string;
  page_id: string;
  project_id: string;
  tool: string;
  label: string | null;
  geometry: AnnotationGeometry;
  style: { color?: string };
  takeoff_item_id: string | null;
  created_at: string;
};

const COLUMNS = "id,page_id,project_id,tool,label,geometry,style,takeoff_item_id,created_at";

export const ANNOTATION_COLORS: Record<AnnotationTool, string> = {
  highlight: "#b45309",
  measure: "#0f766e",
  note: "#1e3a8a",
};

export function useAnnotations(pageId: string | null) {
  return useQuery({
    enabled: Boolean(pageId),
    queryKey: ["annotations", pageId],
    queryFn: async (): Promise<AnnotationRow[]> => {
      const { data, error } = await supabase
        .from("annotations")
        .select(COLUMNS)
        .eq("page_id", pageId!)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as AnnotationRow[];
    },
  });
}

export function useAnnotationMutations(projectId: string, pageId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["annotations", pageId] });

  const create = useMutation({
    mutationFn: async (input: {
      tool: AnnotationTool;
      geometry: AnnotationGeometry;
      label?: string | null;
      takeoffItemId?: string | null;
    }) => {
      if (!pageId) throw new Error("Select a page first.");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("annotations")
        .insert({
          page_id: pageId,
          project_id: projectId,
          tool: input.tool,
          geometry: input.geometry as never,
          style: { color: ANNOTATION_COLORS[input.tool] } as never,
          label: input.label ?? null,
          takeoff_item_id: input.takeoffItemId ?? null,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from("annotations").update({ label }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("annotations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/**
 * A page's calibrated scale, with the canvas pixel dimensions captured at
 * calibration time. Calibration pixels are only valid at the zoom used
 * during calibration — the stored canvas size lets measurements correct for
 * the current zoom instead of silently misreading.
 */
export type PageScale = {
  pixelsPerInch: number;
  calibratedCanvasWidth?: number | null;
  calibratedCanvasHeight?: number | null;
};

/**
 * Converts normalized geometry into a real-world measurement using the page's
 * calibrated scale. Returns null when the page has not been calibrated.
 *
 * Accuracy notes:
 * - Zoom-corrected: calibration pixels are scaled by the ratio of the
 *   current canvas size to the canvas size at calibration time.
 * - Fractional inches to 1/16 (e.g. 3'-0 1/2"), never whole-inch rounding.
 * - Rect geometry reports width × height; line geometry reports length.
 */
export function measureLabel(
  geometry: AnnotationGeometry,
  canvas: { width: number; height: number } | null,
  scale: PageScale | null | undefined,
) {
  if (!canvas || !scale?.pixelsPerInch || !(scale.pixelsPerInch > 0)) return null;
  const zoomX = scale.calibratedCanvasWidth ? canvas.width / scale.calibratedCanvasWidth : 1;
  const zoomY = scale.calibratedCanvasHeight ? canvas.height / scale.calibratedCanvasHeight : 1;
  if (!Number.isFinite(zoomX) || !Number.isFinite(zoomY) || zoomX <= 0 || zoomY <= 0) return null;
  const dxIn = ((geometry.x2 - geometry.x1) * canvas.width) / (scale.pixelsPerInch * zoomX);
  const dyIn = ((geometry.y2 - geometry.y1) * canvas.height) / (scale.pixelsPerInch * zoomY);
  if (!Number.isFinite(dxIn) || !Number.isFinite(dyIn)) return null;

  if (geometry.kind === "line") {
    const inches = Math.hypot(dxIn, dyIn);
    if (!(inches > 0)) return null;
    return formatInches(inches);
  }
  const w = Math.abs(dxIn);
  const h = Math.abs(dyIn);
  if (!(w > 0) || !(h > 0)) return null;
  return formatSize(w, h);
}
