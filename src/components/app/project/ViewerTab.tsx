import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BoxSelect,
  Copy,
  Crop,
  Hand,
  Highlighter,
  Loader2,
  MousePointer2,
  Redo2,
  Ruler,
  RotateCw,
  StickyNote,
  Undo2,
  ScanSearch,
  Sparkles,
  Spline,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { UploadEmptyState } from "@/components/app/project/upload/ProjectUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { loadPdfFromUrl, renderPageToCanvas } from "@/lib/pdf-client";
import { memoryManager } from "@/lib/memory-manager";
import { signedUrl } from "@/lib/storage-client";
import { MARKER_TYPES, markerType } from "@/lib/takeoff-types";
import { analyzeSheetImage, type SheetAnalysisResult } from "@/lib/ai/vision";
import { runSheetDetection, useDetections } from "@/lib/ai/detections";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { DetectionsPanel } from "./DetectionsPanel";

import { usePages, useThumbnails } from "./usePages";
import {
  ANNOTATION_COLORS,
  measureLabel,
  useAnnotationMutations,
  useAnnotations,
  type AnnotationGeometry,
  type PageScale,
} from "./annotations";

type Item = {
  id: string;
  mark: string | null;
  category: string;
  product_type: string | null;
  quantity: number;
  width_in: number | null;
  height_in: number | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  room: string | null;
  elevation: string | null;
  color: string | null;
  notes: string | null;
  status: "pending" | "review" | "approved" | "rejected";
  source_x: number | null;
  source_y: number | null;
  primary_image_path: string | null;
};

const ITEM_COLUMNS =
  "id,mark,category,product_type,quantity,width_in,height_in,building,floor,unit,room,elevation,color,notes,status,source_x,source_y,primary_image_path";

function rotatePoint(x: number, y: number, rotation: number) {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: 1 - y, y: x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: y, y: 1 - x };
    default:
      return { x, y };
  }
}

function unrotatePoint(x: number, y: number, rotation: number) {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: 1 - y, y: x };
    default:
      return { x, y };
  }
}

/**
 * Zoom-corrected rectangle dimensions in inches. Mirrors the rect branch of
 * measureLabel (annotations.ts): normalized geometry × current canvas pixels,
 * corrected by the canvas size captured at calibration time.
 */
function rectInches(
  g: { x1: number; y1: number; x2: number; y2: number },
  canvas: { width: number; height: number } | null,
  scale: PageScale | null,
): { w: number; h: number } | null {
  if (!canvas || !scale?.pixelsPerInch || !(scale.pixelsPerInch > 0)) return null;
  const zoomX = scale.calibratedCanvasWidth ? canvas.width / scale.calibratedCanvasWidth : 1;
  const zoomY = scale.calibratedCanvasHeight ? canvas.height / scale.calibratedCanvasHeight : 1;
  if (!Number.isFinite(zoomX) || !Number.isFinite(zoomY) || zoomX <= 0 || zoomY <= 0) return null;
  const w = Math.abs(((g.x2 - g.x1) * canvas.width) / (scale.pixelsPerInch * zoomX));
  const h = Math.abs(((g.y2 - g.y1) * canvas.height) / (scale.pixelsPerInch * zoomY));
  if (!Number.isFinite(w) || !Number.isFinite(h) || !(w > 0) || !(h > 0)) return null;
  return { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
}

export function ViewerTab({
  projectId,
  canEdit,
  pageId,
  focusItemId,
  onSelectPage,
}: {
  projectId: string;
  canEdit: boolean;
  pageId: string | null;
  focusItemId?: string | null;
  onSelectPage: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: pages = [] } = usePages(projectId);
  const thumbs = useThumbnails(pages);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<{ path: string; pdf: PDFDocumentProxy } | null>(null);

  const [tool, setTool] = useState<
    | "select"
    | "pan"
    | "marker"
    | "crop"
    | "calibrate"
    | "highlight"
    | "measure"
    | "measure_rect"
    | "note"
    | "ai"
    | "detect"
  >("marker");
  const [activeType, setActiveType] = useState("single_hung");
  const [zoom, setZoom] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragRect, setDragRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [calibration, setCalibration] = useState<{ x: number; y: number }[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<SheetAnalysisResult | null>(null);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);
  const [highlightedDetection, setHighlightedDetection] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [pendingCalibration, setPendingCalibration] = useState<number | null>(null);
  const [calibrationInches, setCalibrationInches] = useState("120");
  // Pages sidebar filter: show every sheet, or only the pre-analysis working set.
  const [sheetFilter, setSheetFilter] = useState<"all" | "working">("all");

  type HistoryEntry = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const activePageId = pageId ?? pages[0]?.id ?? null;

  // Page ids in the latest pre-analysis run's working set (selected = true).
  const { data: workingSetIds = [] } = useQuery({
    queryKey: ["working-set-pages", projectId],
    queryFn: async () => {
      const { data: run } = await supabase
        .from("plan_analysis_runs")
        .select("id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!run?.id) return [] as string[];
      const { data, error } = await supabase
        .from("plan_sheet_classifications")
        .select("page_id")
        .eq("run_id", run.id)
        .eq("selected", true);
      if (error) throw error;
      return (data ?? []).map((r) => r.page_id as string).filter(Boolean);
    },
  });

  const visiblePages = useMemo(() => {
    if (sheetFilter !== "working") return pages;
    if (workingSetIds.length === 0) return [];
    const ids = new Set(workingSetIds);
    return pages.filter((p) => ids.has(p.id));
  }, [pages, sheetFilter, workingSetIds]);

  // If the filter hides the currently active sheet, jump to the first visible one.
  useEffect(() => {
    if (sheetFilter !== "working") return;
    if (visiblePages.length === 0) return;
    if (activePageId && visiblePages.some((p) => p.id === activePageId)) return;
    onSelectPage(visiblePages[0].id);
  }, [sheetFilter, visiblePages, activePageId, onSelectPage]);

  const refreshAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
    qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    qc.invalidateQueries({ queryKey: ["annotations", activePageId] });
  }, [qc, activePageId, projectId]);

  function pushHistory(entry: HistoryEntry) {
    setUndoStack((stack) => [...stack.slice(-24), entry]);
    setRedoStack([]);
  }

  async function softDelete(table: "takeoff_items" | "annotations", id: string, deleted: boolean) {
    await supabase
      .from(table)
      .update({ deleted_at: deleted ? new Date().toISOString() : null })
      .eq("id", id);
  }

  async function undoLast() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((stack) => stack.slice(0, -1));
    await entry.undo();
    setRedoStack((stack) => [...stack, entry]);
    refreshAll();
    setStatusText(`Undid ${entry.label}`);
  }

  async function redoLast() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack((stack) => stack.slice(0, -1));
    await entry.redo();
    setUndoStack((stack) => [...stack, entry]);
    refreshAll();
    setStatusText(`Redid ${entry.label}`);
  }

  const { data: page } = useQuery({
    queryKey: ["page-detail", activePageId],
    enabled: Boolean(activePageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("id,page_number,sheet_number,title,rotation,documents(storage_path)")
        .eq("id", activePageId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["page-items", activePageId],
    enabled: Boolean(activePageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takeoff_items")
        .select(ITEM_COLUMNS)
        .eq("page_id", activePageId!)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: scale } = useQuery({
    queryKey: ["page-scale", activePageId],
    enabled: Boolean(activePageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_scales")
        .select(
          "id,scale_label,units,pixels_per_unit,calibrated_canvas_width,calibrated_canvas_height",
        )
        .eq("page_id", activePageId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const storagePath =
    (page?.documents as { storage_path: string | null } | null)?.storage_path ?? null;

  const { data: annotations = [] } = useAnnotations(activePageId);
  const annotationMutations = useAnnotationMutations(projectId, activePageId);
  const pageScale: PageScale | null = scale?.pixels_per_unit
    ? {
        pixelsPerInch: Number(scale.pixels_per_unit),
        calibratedCanvasWidth:
          (scale as { calibrated_canvas_width?: number | null }).calibrated_canvas_width ?? null,
        calibratedCanvasHeight:
          (scale as { calibrated_canvas_height?: number | null }).calibrated_canvas_height ?? null,
      }
    : null;
  const renderRunRef = useRef(0);

  const renderPage = useCallback(async () => {
    if (!page || !storagePath || !canvasRef.current) return;
    const run = ++renderRunRef.current;
    setRendering(true);
    setRenderError(null);
    try {
      if (pdfRef.current?.path !== storagePath) {
        // Destroy the previous PDF before loading a new one — otherwise every
        // document switch leaks the parsed document, fonts and page cache.
        await pdfRef.current?.pdf.destroy().catch(() => undefined);
        const url = await signedUrl("plan-files", storagePath);
        pdfRef.current = { path: storagePath, pdf: await loadPdfFromUrl(url) };
      }
      const pdf = pdfRef.current.pdf;
      const result = await renderPageToCanvas(pdf, page.page_number, zoom, canvasRef.current);
      if (result.cancelled) return; // superseded by a newer zoom/page render
    } catch (err) {
      if (run === renderRunRef.current) {
        setRenderError(err instanceof Error ? err.message : "Could not render this page.");
      }
    } finally {
      if (run === renderRunRef.current) setRendering(false);
    }
  }, [page, storagePath, zoom]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  // Belt-and-suspenders: destroy the cached PDF when the viewer unmounts so
  // navigating away never leaves a parsed document in memory. Also sweep the
  // memory manager's PDF registry (covers PDFs leaked by other code paths).
  useEffect(() => {
    return () => {
      pdfRef.current?.pdf.destroy().catch(() => undefined);
      pdfRef.current = null;
      void memoryManager.disposeAll("pdf:");
    };
  }, []);

  useEffect(() => {
    if (focusItemId) setSelectedId(focusItemId);
  }, [focusItemId]);

  const addItem = useMutation({
    mutationFn: async ({ x, y }: { x: number; y: number }) => {
      const type = markerType(activeType);
      if (!type || !activePageId) throw new Error("Choose a marker type first.");
      const { data: userData } = await supabase.auth.getUser();
      const sameType = items.filter((i) => i.product_type === activeType).length + 1;
      const { data, error } = await supabase
        .from("takeoff_items")
        .insert({
          project_id: projectId,
          page_id: activePageId,
          category: type.category,
          product_type: activeType,
          type_name: type.label,
          mark: `${type.markPrefix}${sameType}`,
          quantity: 1,
          color: type.color,
          source_x: x,
          source_y: y,
          status: "pending",
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setSelectedId(id);
      pushHistory({
        label: "count marker",
        undo: () => softDelete("takeoff_items", id, true),
        redo: () => softDelete("takeoff_items", id, false),
      });
      qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    },
    onError: (e: Error) => setStatusText(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase.from("takeoff_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusText("Saved");
      qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    },
    onError: (e: Error) => setStatusText(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("takeoff_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      setSelectedId(null);
      pushHistory({
        label: "marker delete",
        undo: () => softDelete("takeoff_items", id, false),
        redo: () => softDelete("takeoff_items", id, true),
      });
      qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    },
  });

  const duplicateItem = useMutation({
    mutationFn: async (id: string) => {
      const source = items.find((i) => i.id === id);
      if (!source || !activePageId) return;
      const type = markerType(source.product_type);
      const { error } = await supabase.from("takeoff_items").insert({
        project_id: projectId,
        page_id: activePageId,
        category: source.category,
        product_type: source.product_type,
        type_name: type?.label ?? source.product_type,
        mark: source.mark,
        quantity: 1,
        color: source.color,
        width_in: source.width_in,
        height_in: source.height_in,
        building: source.building,
        floor: source.floor,
        unit: source.unit,
        room: source.room,
        elevation: source.elevation,
        notes: source.notes,
        status: "pending",
        source_x: Math.min(0.98, (source.source_x ?? 0.5) + 0.02),
        source_y: Math.min(0.98, (source.source_y ?? 0.5) + 0.02),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    },
  });

  const saveCrop = useMutation({
    mutationFn: async (rect: { x1: number; y1: number; x2: number; y2: number }) => {
      if (!selectedId) throw new Error("Select an item before cropping an image for it.");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Page is not rendered yet.");
      const x = Math.min(rect.x1, rect.x2) * canvas.width;
      const y = Math.min(rect.y1, rect.y2) * canvas.height;
      const w = Math.abs(rect.x2 - rect.x1) * canvas.width;
      const h = Math.abs(rect.y2 - rect.y1) * canvas.height;
      if (w < 8 || h < 8) throw new Error("Crop area is too small.");
      const out = document.createElement("canvas");
      out.width = Math.round(w);
      out.height = Math.round(h);
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Could not encode crop.");
      const path = `${projectId}/crops/${selectedId}-${Date.now()}.jpg`;
      const uploaded = await supabase.storage.from("plan-files").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploaded.error) throw uploaded.error;
      const { error: imgErr } = await supabase
        .from("takeoff_item_images")
        .insert({ takeoff_item_id: selectedId, storage_path: path, caption: "Plan crop" });
      if (imgErr) throw imgErr;
      const { error: updErr } = await supabase
        .from("takeoff_items")
        .update({ primary_image_path: path })
        .eq("id", selectedId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      setStatusText("Representative image saved");
      qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
    },
    onError: (e: Error) => setStatusText(e.message),
  });

  /** Saves a representative crop for an approved AI detection when its bbox is usable. */
  async function attachCrops(approved: { itemId: string; bbox: unknown }[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    for (const entry of approved) {
      const b = entry.bbox as { x1?: number; y1?: number; x2?: number; y2?: number };
      if (b?.x1 === undefined || b?.y1 === undefined || b?.x2 === undefined || b?.y2 === undefined)
        continue;
      const pad = 0.01;
      const x = Math.max(0, Math.min(b.x1, b.x2) - pad) * canvas.width;
      const y = Math.max(0, Math.min(b.y1, b.y2) - pad) * canvas.height;
      const w = Math.min(1, Math.abs(b.x2 - b.x1) + pad * 2) * canvas.width;
      const h = Math.min(1, Math.abs(b.y2 - b.y1) + pad * 2) * canvas.height;
      if (w < 8 || h < 8) continue;
      try {
        const out = document.createElement("canvas");
        out.width = Math.round(w);
        out.height = Math.round(h);
        const ctx = out.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          out.toBlob(resolve, "image/jpeg", 0.85),
        );
        if (!blob) continue;
        const path = `${projectId}/crops/${entry.itemId}-${Date.now()}.jpg`;
        const uploaded = await supabase.storage
          .from("plan-files")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (uploaded.error) continue;
        await supabase.from("takeoff_item_images").insert({
          takeoff_item_id: entry.itemId,
          storage_path: path,
          caption: "AI detection crop",
        });
        await supabase
          .from("takeoff_items")
          .update({ primary_image_path: path })
          .eq("id", entry.itemId);
      } catch {
        /* representative image is best-effort */
      }
    }
    qc.invalidateQueries({ queryKey: ["page-items", activePageId] });
    qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
  }

  /** Encodes the rendered sheet (or a region of it) as a downscaled JPEG data URL. */
  function captureImage(rect?: { x1: number; y1: number; x2: number; y2: number }) {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Page is not rendered yet.");
    const sx = rect ? Math.min(rect.x1, rect.x2) * canvas.width : 0;
    const sy = rect ? Math.min(rect.y1, rect.y2) * canvas.height : 0;
    const sw = rect ? Math.abs(rect.x2 - rect.x1) * canvas.width : canvas.width;
    const sh = rect ? Math.abs(rect.y2 - rect.y1) * canvas.height : canvas.height;
    if (sw < 16 || sh < 16) throw new Error("Selected region is too small to analyze.");
    const maxEdge = 1600;
    const factor = Math.min(1, maxEdge / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * factor));
    out.height = Math.max(1, Math.round(sh * factor));
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.82);
  }

  const analyzeWithAi = useMutation({
    mutationFn: async (rect?: { x1: number; y1: number; x2: number; y2: number }) => {
      if (!activePageId) throw new Error("Open a sheet first.");
      const imageDataUrl = captureImage(rect);
      return analyzeSheetImage({
        projectId,
        pageId: activePageId,
        imageDataUrl,
        scope: rect ? "crop" : "sheet",
        prompt: rect
          ? "Analyze this cropped region of the plan sheet. List every window, door and storefront opening you can read, with tags/marks and any dimensions shown, and flag what the estimator should verify."
          : "Analyze this full plan sheet. Identify the sheet type, any window/door schedules or tags visible, and list openings you can read with their marks. Flag anything that needs estimator verification.",
      });
    },
    onMutate: () => {
      setAiResult(null);
      setStatusText("Sending sheet to the AI engine…");
    },
    onSuccess: (result) => {
      setAiResult(result);
      setStatusText(
        result.error ? "AI analysis unavailable" : "AI analysis saved to project conversations",
      );
      if (result.error) {
        toast.error("AI analysis unavailable", { description: result.error });
      } else {
        qc.invalidateQueries({ queryKey: ["ai-conversations"] });
        toast.success("AI analysis saved to this project");
        logAudit({
          projectId,
          action: "ai.analysis_run",
          entityType: "page",
          entityId: activePageId,
          detail: { mode: result.mode },
        }).then(() => qc.invalidateQueries({ queryKey: ["activity", projectId] }));
      }
    },
    onError: (e: Error) => {
      setAiResult({ conversationId: "", text: "", mode: "demo", error: e.message });
      setStatusText(e.message);
      toast.error("AI analysis failed", { description: e.message });
    },
  });

  const { data: detections = [] } = useDetections(activePageId);

  const detectItems = useMutation({
    mutationFn: async (rect?: { x1: number; y1: number; x2: number; y2: number }) => {
      if (!activePageId) throw new Error("Open a sheet first.");
      const region = rect
        ? {
            x1: unrotatePoint(rect.x1, rect.y1, rotation).x,
            y1: unrotatePoint(rect.x1, rect.y1, rotation).y,
            x2: unrotatePoint(rect.x2, rect.y2, rotation).x,
            y2: unrotatePoint(rect.x2, rect.y2, rotation).y,
          }
        : null;
      return runSheetDetection({
        projectId,
        pageId: activePageId,
        imageDataUrl: captureImage(rect),
        region,
      });
    },
    onMutate: () => setDetectMessage("Running AI detection on this sheet…"),
    onSuccess: (result) => {
      setDetectMessage(
        result.error
          ? result.error
          : result.inserted
            ? `${result.inserted} suggestion${result.inserted === 1 ? "" : "s"} ready for review.`
            : "The model found no legible openings in that image.",
      );
      qc.invalidateQueries({ queryKey: ["ai-detections", activePageId] });
    },
    onError: (e: Error) => setDetectMessage(e.message),
  });

  const saveScale = useMutation({
    mutationFn: async ({ pixels, label }: { pixels: number; label: string }) => {
      if (!activePageId) return;
      const canvas = canvasRef.current;
      const { error } = await supabase.from("page_scales").upsert(
        {
          id: scale?.id,
          page_id: activePageId,
          project_id: projectId,
          scale_label: label,
          units: "in",
          pixels_per_unit: pixels,
          calibrated_canvas_width: canvas?.width ?? null,
          calibrated_canvas_height: canvas?.height ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      setStatusText("Scale calibration saved");
      qc.invalidateQueries({ queryKey: ["page-scale", activePageId] });
      toast.success("Sheet scale saved", {
        description: `${variables.pixels.toFixed(3)} px/in — ${variables.label}`,
      });
      logAudit({
        projectId,
        action: "page.scale_calibrated",
        entityType: "page",
        entityId: activePageId,
        detail: {
          pixels_per_inch: Number(variables.pixels.toFixed(3)),
          reference: variables.label,
        },
      }).then(() => qc.invalidateQueries({ queryKey: ["activity", projectId] }));
    },
    onError: (e: Error) => {
      setStatusText(e.message);
      toast.error("Could not save the scale", { description: e.message });
    },
  });

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const isDragTool =
    tool === "crop" ||
    tool === "highlight" ||
    tool === "measure" ||
    tool === "measure_rect" ||
    tool === "note" ||
    tool === "ai" ||
    tool === "detect";

  /** Persists a drawn shape as an annotation with normalized page coordinates. */
  function saveAnnotation(rect: { x1: number; y1: number; x2: number; y2: number }) {
    if (!canEdit) return;
    if (Math.abs(rect.x2 - rect.x1) < 0.004 && Math.abs(rect.y2 - rect.y1) < 0.004) return;
    const a = unrotatePoint(rect.x1, rect.y1, rotation);
    const b = unrotatePoint(rect.x2, rect.y2, rotation);
    const geometry: AnnotationGeometry =
      tool === "measure"
        ? { kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y }
        : { kind: "rect", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    const annotationTool =
      tool === "measure" || tool === "measure_rect"
        ? "measure"
        : tool === "note"
          ? "note"
          : "highlight";
    const label =
      annotationTool === "measure"
        ? (measureLabel(geometry, canvasRef.current, pageScale) ?? "Uncalibrated measurement")
        : annotationTool === "note"
          ? noteText.trim() || "Note"
          : null;
    annotationMutations.create.mutate(
      { tool: annotationTool, geometry, label, takeoffItemId: selectedId },
      {
        onSuccess: (id) => {
          setStatusText(
            annotationTool === "measure"
              ? "Measurement saved"
              : annotationTool === "note"
                ? "Dimension note saved"
                : "Markup saved",
          );
          pushHistory({
            label: "markup",
            undo: () => softDelete("annotations", id, true),
            redo: () => softDelete("annotations", id, false),
          });
        },
        onError: (e: Error) => setStatusText(e.message),
      },
    );
  }

  /** Turns a saved rectangle/line markup into a linked takeoff row. */
  const itemFromAnnotation = useMutation({
    mutationFn: async (annotationId: string) => {
      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation || !activePageId) throw new Error("Markup not found.");
      const type = markerType(activeType);
      if (!type) throw new Error("Choose a marker type first.");
      const g = annotation.geometry;
      const cx = (g.x1 + g.x2) / 2;
      const cy = (g.y1 + g.y2) / 2;
      // Rect markups carry real dimensions: convert zoom-corrected rect pixels to inches.
      const rectDims = g.kind === "rect" ? rectInches(g, canvasRef.current, pageScale) : null;
      const { data: userData } = await supabase.auth.getUser();
      const sameType = items.filter((i) => i.product_type === activeType).length + 1;
      const { data, error } = await supabase
        .from("takeoff_items")
        .insert({
          project_id: projectId,
          page_id: activePageId,
          category: type.category,
          product_type: activeType,
          type_name: type.label,
          mark: `${type.markPrefix}${sameType}`,
          quantity: 1,
          color: type.color,
          source_x: cx,
          source_y: cy,
          width_in: rectDims?.w ?? null,
          height_in: rectDims?.h ?? null,
          notes: annotation.label,
          status: "pending",
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("annotations")
        .update({ takeoff_item_id: data.id })
        .eq("id", annotationId);
      return data.id as string;
    },
    onSuccess: (id) => {
      setSelectedId(id);
      setStatusText("Takeoff row created from markup");
      pushHistory({
        label: "markup item",
        undo: () => softDelete("takeoff_items", id, true),
        redo: () => softDelete("takeoff_items", id, false),
      });
      refreshAll();
    },
    onError: (e: Error) => setStatusText(e.message),
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.product_type ?? "unclassified";
      map.set(key, (map.get(key) ?? 0) + (item.quantity ?? 1));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  function pointFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canEdit) return;
    const point = pointFromEvent(e);
    if (tool === "marker") {
      const stored = unrotatePoint(point.x, point.y, rotation);
      addItem.mutate(stored);
    } else if (tool === "calibrate") {
      const next = [...calibration, point];
      if (next.length === 2) {
        const canvas = canvasRef.current;
        const dx = (next[1].x - next[0].x) * (canvas?.width ?? 1);
        const dy = (next[1].y - next[0].y) * (canvas?.height ?? 1);
        setCalibration([]);
        setPendingCalibration(Math.hypot(dx, dy));
      } else {
        setCalibration(next);
      }
    } else if (tool === "select") {
      setSelectedId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[14rem_1fr_20rem]">
      <aside className="surface-panel max-h-[46rem] overflow-y-auto p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pages
        </p>
        <div
          role="group"
          aria-label="Sheet filter"
          className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          <button
            type="button"
            onClick={() => setSheetFilter("all")}
            aria-pressed={sheetFilter === "all"}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              sheetFilter === "all"
                ? "bg-navy text-white shadow-sm"
                : "text-muted-foreground hover:text-navy"
            }`}
          >
            All sheets
          </button>
          <button
            type="button"
            onClick={() => setSheetFilter("working")}
            aria-pressed={sheetFilter === "working"}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              sheetFilter === "working"
                ? "bg-navy text-white shadow-sm"
                : "text-muted-foreground hover:text-navy"
            }`}
          >
            Working set{workingSetIds.length > 0 ? ` (${workingSetIds.length})` : ""}
          </button>
        </div>
        {sheetFilter === "working" && visiblePages.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            No working set yet — run a scan first and the window-relevant sheets will appear here.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {visiblePages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectPage(p.id)}
                className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${
                  activePageId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {p.thumbnail_path && thumbs.get(p.thumbnail_path) ? (
                  <img
                    src={thumbs.get(p.thumbnail_path)}
                    alt={`Page ${p.page_number}`}
                    className="mb-2 h-24 w-full bg-white object-contain"
                    loading="lazy"
                  />
                ) : null}
                <span className="font-semibold text-navy">
                  {p.sheet_number ?? `Page ${p.page_number}`}
                </span>
              </button>
            </li>
          ))}
          {visiblePages.length === 0 && sheetFilter === "all" ? (
            <li>
              <UploadEmptyState
                title="No sheets yet"
                description="Upload a PDF plan set or a ZIP of the full set to start marking."
              />
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="surface-panel flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary/50 p-2">
          <Button
            size="sm"
            variant={tool === "select" ? "default" : "ghost"}
            onClick={() => setTool("select")}
          >
            <MousePointer2 className="size-4" /> <span className="hidden lg:inline">Select</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "pan" ? "default" : "ghost"}
            onClick={() => setTool("pan")}
          >
            <Hand className="size-4" /> <span className="hidden lg:inline">Pan</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "marker" ? "default" : "ghost"}
            onClick={() => setTool("marker")}
          >
            <span className="hidden lg:inline">Count marker</span>
            <span className="lg:hidden">Mark</span>
          </Button>
          <Select value={activeType} onValueChange={setActiveType}>
            <SelectTrigger className="h-8 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKER_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={tool === "crop" ? "default" : "ghost"}
            onClick={() => setTool("crop")}
          >
            <Crop className="size-4" /> <span className="hidden lg:inline">Crop image</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "calibrate" ? "default" : "ghost"}
            onClick={() => setTool("calibrate")}
          >
            <Ruler className="size-4" /> <span className="hidden lg:inline">Calibrate</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "highlight" ? "default" : "ghost"}
            onClick={() => setTool("highlight")}
          >
            <Highlighter className="size-4" /> <span className="hidden lg:inline">Markup area</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "measure" ? "default" : "ghost"}
            onClick={() => setTool("measure")}
          >
            <Spline className="size-4" /> <span className="hidden lg:inline">Measure</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "measure_rect" ? "default" : "ghost"}
            onClick={() => setTool("measure_rect")}
          >
            <BoxSelect className="size-4" /> <span className="hidden lg:inline">Measure area</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "note" ? "default" : "ghost"}
            onClick={() => setTool("note")}
          >
            <StickyNote className="size-4" />{" "}
            <span className="hidden lg:inline">Dimension note</span>
          </Button>
          {tool === "note" ? (
            <Input
              aria-label="Note or dimension label"
              className="h-8 w-44"
              placeholder="Label for the note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          ) : null}
          <Button
            size="sm"
            variant={tool === "ai" ? "default" : "ghost"}
            onClick={() => setTool("ai")}
          >
            <Sparkles className="size-4" /> <span className="hidden lg:inline">AI region</span>
          </Button>
          <Button
            size="sm"
            variant={tool === "detect" ? "default" : "ghost"}
            onClick={() => setTool("detect")}
          >
            <ScanSearch className="size-4" />{" "}
            <span className="hidden lg:inline">Detect region</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!activePageId || analyzeWithAi.isPending}
            onClick={() => analyzeWithAi.mutate(undefined)}
          >
            {analyzeWithAi.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            <span className="hidden lg:inline">Analyze sheet</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || !activePageId || detectItems.isPending}
            onClick={() => detectItems.mutate(undefined)}
            title="Detect window and door openings across the full sheet"
          >
            {detectItems.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ScanSearch className="size-4" />
            )}
            <span className="hidden lg:inline">
              {detectItems.isPending ? "Detecting…" : "Detect openings"}
            </span>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Undo"
              disabled={!canEdit || undoStack.length === 0}
              onClick={() => void undoLast()}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Redo"
              disabled={!canEdit || redoStack.length === 0}
              onClick={() => void redoLast()}
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
            >
              <ZoomIn className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Rotate page"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="size-4" />
            </Button>
          </div>
        </div>

        {pendingCalibration !== null ? (
          <form
            className="flex flex-wrap items-end gap-3 border-b border-border bg-secondary/40 p-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const inches = Number(calibrationInches);
              if (!(inches > 0)) {
                setStatusText("Enter a positive length in inches.");
                return;
              }
              saveScale.mutate({
                pixels: pendingCalibration / inches,
                label: `${inches}" reference`,
              });
              setPendingCalibration(null);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="cal-in" className="text-xs text-muted-foreground">
                Real-world length between the two picked points (inches)
              </Label>
              <Input
                id="cal-in"
                type="number"
                min="1"
                className="h-8 w-40"
                value={calibrationInches}
                onChange={(e) => setCalibrationInches(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm">
              Save scale
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingCalibration(null)}
            >
              Cancel
            </Button>
          </form>
        ) : null}
        {tool === "calibrate" && pendingCalibration === null ? (
          <p className="border-b border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Click two points a known distance apart ({calibration.length}/2 picked).
          </p>
        ) : null}

        <div className="min-h-[30rem] flex-1 overflow-auto bg-muted/40 p-4">
          {!activePageId ? (
            pages.length === 0 ? (
              <UploadEmptyState
                title="No sheets to view"
                description="Upload plans or a ZIP archive and sheets appear here as they finish processing."
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a page to begin marking.</p>
            )
          ) : (
            <div className="relative mx-auto w-max">
              <div
                className="relative"
                style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
                onClick={handleCanvasClick}
                onMouseDown={(e) => {
                  if (!isDragTool) return;
                  const p = pointFromEvent(e);
                  setDragRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
                }}
                onMouseMove={(e) => {
                  if (!isDragTool || !dragRect) return;
                  const p = pointFromEvent(e);
                  setDragRect({ ...dragRect, x2: p.x, y2: p.y });
                }}
                onMouseUp={() => {
                  if (!dragRect) return;
                  if (tool === "crop") saveCrop.mutate(dragRect);
                  else if (tool === "ai") analyzeWithAi.mutate(dragRect);
                  else if (tool === "detect") detectItems.mutate(dragRect);
                  else if (tool === "highlight" || tool === "measure" || tool === "measure_rect")
                    saveAnnotation(dragRect);
                  setDragRect(null);
                }}
              >
                <canvas ref={canvasRef} className="block bg-white shadow-sm" />
                <svg
                  className="pointer-events-none absolute inset-0 size-full"
                  aria-hidden="true"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  {annotations.map((a) => {
                    const g = a.geometry;
                    const p1 = rotatePoint(g.x1, g.y1, rotation);
                    const p2 = rotatePoint(g.x2, g.y2, rotation);
                    const color = a.style?.color ?? ANNOTATION_COLORS.highlight;
                    if (g.kind === "rect") {
                      return (
                        <rect
                          key={a.id}
                          x={Math.min(p1.x, p2.x) * 100}
                          y={Math.min(p1.y, p2.y) * 100}
                          width={Math.abs(p2.x - p1.x) * 100}
                          height={Math.abs(p2.y - p1.y) * 100}
                          fill={color}
                          fillOpacity={selectedAnnotationId === a.id ? 0.3 : 0.15}
                          stroke={color}
                          strokeWidth={0.3}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    return (
                      <line
                        key={a.id}
                        x1={p1.x * 100}
                        y1={p1.y * 100}
                        x2={p2.x * 100}
                        y2={p2.y * 100}
                        stroke={color}
                        strokeWidth={selectedAnnotationId === a.id ? 0.6 : 0.35}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {detections
                    .filter((d) => d.status === "pending")
                    .map((d) => {
                      const b = d.bbox as { x1?: number; y1?: number; x2?: number; y2?: number };
                      if (
                        b.x1 === undefined ||
                        b.y1 === undefined ||
                        b.x2 === undefined ||
                        b.y2 === undefined
                      ) {
                        return null;
                      }
                      const p1 = rotatePoint(b.x1, b.y1, rotation);
                      const p2 = rotatePoint(b.x2, b.y2, rotation);
                      return (
                        <rect
                          key={d.id}
                          x={Math.min(p1.x, p2.x) * 100}
                          y={Math.min(p1.y, p2.y) * 100}
                          width={Math.abs(p2.x - p1.x) * 100}
                          height={Math.abs(p2.y - p1.y) * 100}
                          fill="#a855f7"
                          fillOpacity={highlightedDetection === d.id ? 0.28 : 0.08}
                          stroke="#a855f7"
                          strokeDasharray="3 2"
                          strokeWidth={highlightedDetection === d.id ? 0.6 : 0.35}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                </svg>
                {annotations
                  .filter((a) => a.geometry.kind === "rect" && a.tool === "measure" && a.label)
                  .map((a) => {
                    const g = a.geometry;
                    if (g.kind !== "rect") return null;
                    const p1 = rotatePoint(g.x1, g.y1, rotation);
                    const p2 = rotatePoint(g.x2, g.y2, rotation);
                    return (
                      <span
                        key={`rect-label-${a.id}`}
                        className="pointer-events-none absolute z-10 -translate-y-full rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow"
                        style={{
                          left: `${Math.min(p1.x, p2.x) * 100}%`,
                          top: `${Math.min(p1.y, p2.y) * 100}%`,
                          backgroundColor: a.style?.color ?? ANNOTATION_COLORS.measure,
                        }}
                      >
                        {a.label}
                      </span>
                    );
                  })}

                {items.map((item) => {
                  const pos = rotatePoint(item.source_x ?? 0.5, item.source_y ?? 0.5, rotation);
                  const type = markerType(item.product_type);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={`${item.mark ?? ""} ${type?.label ?? ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (canEdit) duplicateItem.mutate(item.id);
                      }}
                      draggable={canEdit && tool === "select"}
                      onDragEnd={(e) => {
                        const host = e.currentTarget.parentElement;
                        if (!host) return;
                        const rect = host.getBoundingClientRect();
                        const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                        const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                        const stored = unrotatePoint(nx, ny, rotation);
                        const prevX = item.source_x;
                        const prevY = item.source_y;
                        updateItem.mutate(
                          { id: item.id, patch: { source_x: stored.x, source_y: stored.y } },
                          {
                            onSuccess: () =>
                              pushHistory({
                                label: "marker move",
                                undo: async () => {
                                  await supabase
                                    .from("takeoff_items")
                                    .update({ source_x: prevX, source_y: prevY })
                                    .eq("id", item.id);
                                },
                                redo: async () => {
                                  await supabase
                                    .from("takeoff_items")
                                    .update({ source_x: stored.x, source_y: stored.y })
                                    .eq("id", item.id);
                                },
                              }),
                          },
                        );
                      }}
                      className={`absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[0.6rem] font-bold text-white shadow ${
                        selectedId === item.id ? "ring-2 ring-offset-1 ring-navy" : ""
                      } ${focusItemId === item.id ? "animate-pulse ring-4 ring-amber-400" : ""}`}
                      style={{
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        backgroundColor: item.color ?? type?.color ?? "#1d4ed8",
                        borderColor: "white",
                      }}
                    >
                      {item.mark ?? "•"}
                    </button>
                  );
                })}
                {dragRect ? (
                  <div
                    className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                    style={{
                      left: `${Math.min(dragRect.x1, dragRect.x2) * 100}%`,
                      top: `${Math.min(dragRect.y1, dragRect.y2) * 100}%`,
                      width: `${Math.abs(dragRect.x2 - dragRect.x1) * 100}%`,
                      height: `${Math.abs(dragRect.y2 - dragRect.y1) * 100}%`,
                    }}
                  >
                    {tool === "measure" || tool === "measure_rect" ? (
                      <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                        {measureLabel(
                          { kind: tool === "measure_rect" ? "rect" : "line", ...dragRect },
                          canvasRef.current,
                          pageScale,
                        ) ?? "Uncalibrated"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {rendering ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Rendering page…
                </p>
              ) : null}
              {renderError ? <p className="mt-3 text-sm text-destructive">{renderError}</p> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Scale:{" "}
            {scale?.pixels_per_unit
              ? `${Number(scale.pixels_per_unit).toFixed(3)} px/in — ${scale.scale_label}`
              : "Not calibrated (counting still works)"}
          </span>
          {counts.map(([key, count]) => (
            <Badge key={key} variant="outline" className="gap-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: markerType(key)?.color ?? "#64748b" }}
              />
              {markerType(key)?.label ?? key}: {count}
            </Badge>
          ))}
          {statusText ? <span className="ml-auto text-navy">{statusText}</span> : null}
        </div>
      </section>

      <aside className="surface-panel max-h-[46rem] space-y-3 overflow-y-auto p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Selected item
        </p>
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Click a marker to edit it. With the Count marker tool active, click the plan to place a
            new count.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <Field label="Mark">
              <Input
                defaultValue={selected.mark ?? ""}
                disabled={!canEdit}
                onBlur={(e) =>
                  updateItem.mutate({ id: selected.id, patch: { mark: e.target.value } })
                }
              />
            </Field>
            <Field label="Type">
              <Select
                value={selected.product_type ?? ""}
                disabled={!canEdit}
                onValueChange={(value) => {
                  const type = markerType(value);
                  updateItem.mutate({
                    id: selected.id,
                    patch: {
                      product_type: value,
                      category: type?.category ?? selected.category,
                      color: type?.color ?? selected.color,
                    },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKER_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Width (in)">
                <Input
                  type="number"
                  defaultValue={selected.width_in ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({
                      id: selected.id,
                      patch: { width_in: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                />
              </Field>
              <Field label="Height (in)">
                <Input
                  type="number"
                  defaultValue={selected.height_in ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({
                      id: selected.id,
                      patch: { height_in: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                />
              </Field>
              <Field label="Building">
                <Input
                  defaultValue={selected.building ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({ id: selected.id, patch: { building: e.target.value } })
                  }
                />
              </Field>
              <Field label="Floor">
                <Input
                  defaultValue={selected.floor ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({ id: selected.id, patch: { floor: e.target.value } })
                  }
                />
              </Field>
              <Field label="Unit">
                <Input
                  defaultValue={selected.unit ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({ id: selected.id, patch: { unit: e.target.value } })
                  }
                />
              </Field>
              <Field label="Room">
                <Input
                  defaultValue={selected.room ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    updateItem.mutate({ id: selected.id, patch: { room: e.target.value } })
                  }
                />
              </Field>
            </div>
            <Field label="Color">
              <Input
                type="color"
                className="h-9 w-20 p-1"
                defaultValue={selected.color ?? "#1d4ed8"}
                disabled={!canEdit}
                onBlur={(e) =>
                  updateItem.mutate({ id: selected.id, patch: { color: e.target.value } })
                }
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={3}
                defaultValue={selected.notes ?? ""}
                disabled={!canEdit}
                onBlur={(e) =>
                  updateItem.mutate({ id: selected.id, patch: { notes: e.target.value } })
                }
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() => duplicateItem.mutate(selected.id)}
              >
                <Copy className="mr-2 size-4" /> Duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() =>
                  updateItem.mutate({ id: selected.id, patch: { status: "approved" } })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() =>
                  updateItem.mutate({ id: selected.id, patch: { status: "rejected" } })
                }
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!canEdit}
                onClick={() => removeItem.mutate(selected.id)}
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Status: {selected.status} · Image: {selected.primary_image_path ? "saved" : "none"} ·
              Use the Crop image tool to capture a representative image for this item.
            </p>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            AI sheet analysis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use <strong>Analyze sheet</strong> for the whole page, or drag with{" "}
            <strong>AI region</strong> to send just a detail. Findings from the image are
            AI-suggested and never change saved takeoff counts.
          </p>
          {analyzeWithAi.isPending ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Analyzing sheet image…
            </p>
          ) : null}
          {aiResult?.error ? (
            <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {aiResult.error}
            </p>
          ) : null}
          {aiResult && !aiResult.error ? (
            <div className="mt-2 space-y-2">
              <Badge variant="outline" className="text-[0.65rem]">
                {aiResult.provider} · {aiResult.model}
              </Badge>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-xs leading-relaxed text-navy">
                {aiResult.text}
              </p>
              <p className="text-[0.65rem] text-muted-foreground">
                Saved to project AI conversations with this sheet as its source.
              </p>
            </div>
          ) : null}
        </div>

        <DetectionsPanel
          projectId={projectId}
          pageId={activePageId}
          canEdit={canEdit}
          running={detectItems.isPending}
          message={detectMessage}
          onDetect={() => detectItems.mutate(undefined)}
          onHighlight={setHighlightedDetection}
          highlightedId={highlightedDetection}
          onApproved={(approved) => void attachCrops(approved)}
        />

        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Markup on this sheet ({annotations.length})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag with <strong>Markup area</strong> to box a detail, <strong>Measure</strong> for a
            line dimension, or <strong>Measure area</strong> for a width × height. Coordinates are
            saved to the project database and reload with the sheet.
          </p>
          <ul className="mt-2 space-y-1">
            {annotations.map((a) => (
              <li
                key={a.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                  selectedAnnotationId === a.id ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: a.style?.color ?? ANNOTATION_COLORS.highlight }}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-navy"
                  onClick={() =>
                    setSelectedAnnotationId(selectedAnnotationId === a.id ? null : a.id)
                  }
                >
                  {a.tool === "measure" ? (a.label ?? "Measurement") : (a.label ?? "Marked area")}
                </button>
                {canEdit && !a.takeoff_item_id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[0.65rem]"
                    onClick={() => itemFromAnnotation.mutate(a.id)}
                  >
                    Create item
                  </Button>
                ) : null}
                {a.takeoff_item_id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[0.65rem]"
                    onClick={() => setSelectedId(a.takeoff_item_id)}
                  >
                    Linked
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label="Delete markup"
                  disabled={!canEdit}
                  onClick={() =>
                    annotationMutations.remove.mutate(a.id, {
                      onSuccess: () =>
                        pushHistory({
                          label: "markup delete",
                          undo: () => softDelete("annotations", a.id, false),
                          redo: () => softDelete("annotations", a.id, true),
                        }),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
            {annotations.length === 0 ? (
              <li className="py-2 text-xs text-muted-foreground">
                No markup saved on this sheet yet.
              </li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
