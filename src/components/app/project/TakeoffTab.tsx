import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { UploadEmptyState } from "@/components/app/project/upload/ProjectUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  buildTakeoffWorkbook,
  type ExportItem,
  type ExportProject,
} from "@/lib/exports/excel-export";
import { buildTakeoffPdf } from "@/lib/exports/pdf-report";
import {
  promoteScheduleEntries,
  type ScheduleEntry,
  unpromotedScheduleEntries,
} from "@/lib/takeoff/promote";
import { buildTakeoffReportWorkbook } from "@/lib/exports/takeoff-excel";
import type { SheetIndexRow } from "@/lib/takeoff/takeoff-report";
import { TakeoffSummaryView } from "@/components/app/project/TakeoffSummaryView";
import { TakeoffWindowsView } from "@/components/app/project/TakeoffWindowsView";
import { TakeoffDoorsView } from "@/components/app/project/TakeoffDoorsView";
import { TakeoffItemizedView } from "@/components/app/project/TakeoffItemizedView";
import { TakeoffMethodologyView } from "@/components/app/project/TakeoffMethodologyView";
import { downloadBlob, signedUrl, signedUrls } from "@/lib/storage-client";
import { SaveToDriveButton } from "@/components/app/google/SaveToDriveDialog";
import { SaveToDropboxButton } from "@/components/app/dropbox/SaveToDropboxDialog";
import { MARKER_TYPES, markerType, typeLabel } from "@/lib/takeoff-types";
import { TakeoffShortcuts } from "@/components/app/project/TakeoffShortcuts";
import { PlanSearchPanel } from "@/components/app/project/PlanSearchPanel";
import { parseDimensionInput } from "@/lib/takeoff/dimensions";
import { buildBackupCsv, buildBackupJson } from "@/lib/exports/backup-export";
import { DEFAULT_COMPANY, useCompanySettings } from "@/lib/company-settings";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { useTakeoffItems, type Row } from "./useTakeoffItems";
import { formatBytes } from "@/lib/utils";

async function withImages(rows: Row[]): Promise<ExportItem[]> {
  return Promise.all(
    rows.map(async (row) => {
      let imageData: ArrayBuffer | null = null;
      if (row.primary_image_path) {
        try {
          const url = await signedUrl("plan-files", row.primary_image_path);
          imageData = await (await fetch(url)).arrayBuffer();
        } catch {
          imageData = null;
        }
      }
      return {
        ...row,
        page_label: row.pages?.sheet_number ?? (row.pages ? `Page ${row.pages.page_number}` : ""),
        imageData,
      };
    }),
  );
}

type SortKey =
  | "mark"
  | "category"
  | "product_type"
  | "building"
  | "floor"
  | "room"
  | "quantity"
  | "width_in"
  | "height_in"
  | "status";

const HEADERS: [string, SortKey | null][] = [
  ["Mark", "mark"],
  ["Category", "category"],
  ["Type", "product_type"],
  ["Building", "building"],
  ["Floor", "floor"],
  ["Room", "room"],
  ["Qty", "quantity"],
  ["W", "width_in"],
  ["H", "height_in"],
  ["Area sf", null],
  ["Image", null],
  ["Source", null],
  ["Review", "status"],
];

function sortValue(row: Row, key: SortKey): string | number | null {
  const value = row[key as keyof Row] as unknown;
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? value : String(value).toLowerCase();
}

/** Click-to-edit cell that commits on blur or Enter and reverts on Escape. */
function EditableCell({
  value,
  canEdit,
  numeric,
  ariaLabel,
  onCommit,
}: {
  value: string;
  canEdit: boolean;
  numeric?: boolean;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!canEdit) return <>{value || "—"}</>;
  if (!editing) {
    return (
      <button
        type="button"
        className="min-w-10 rounded px-1 text-left hover:bg-secondary"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || "—"}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      aria-label={ariaLabel}
      inputMode={numeric ? "decimal" : undefined}
      className="h-8 w-20"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

type ReportView = "summary" | "windows" | "doors" | "itemized" | "items" | "methodology";

const REPORT_VIEWS: { key: ReportView; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "windows", label: "Windows" },
  { key: "doors", label: "Doors" },
  { key: "itemized", label: "Itemized" },
  { key: "items", label: "Line Items" },
  { key: "methodology", label: "Methodology" },
];

export function TakeoffTab({
  projectId,
  project,
  canEdit,
  onOpenPage,
}: {
  projectId: string;
  project: ExportProject;
  canEdit: boolean;
  onOpenPage: (pageId: string, itemId?: string) => void;
}) {
  const qc = useQueryClient();
  const { data: company = DEFAULT_COMPANY } = useCompanySettings();
  const { data: rows = [], isLoading } = useTakeoffItems(projectId);

  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "mark",
    dir: "asc",
  });
  const [bulk, setBulk] = useState({ building: "", floor: "", product_type: "" });
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [view, setView] = useState<ReportView>("summary");

  // Washington-format report data — fetched once, shared by the report views and export.
  const { data: pageCount } = useQuery<number | null>({
    queryKey: ["takeoff-report-page-count", projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) throw error;
      return count;
    },
  });
  const { data: scheduleEntries = [] } = useQuery<ScheduleEntry[]>({
    queryKey: ["takeoff-report-schedule-entries", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_schedule_entries")
        .select(
          "id,project_id,page_id,schedule_type,mark,type_label,width,height,quantity,material,glazing,operation,confidence",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as ScheduleEntry[];
    },
  });
  const { data: sheetIndex = [] } = useQuery<SheetIndexRow[]>({
    queryKey: ["takeoff-report-sheet-index", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_sheet_classifications")
        .select("sheet_number,title,page_number,category,selected")
        .eq("project_id", projectId)
        .order("page_number");
      if (error) throw error;
      return (data ?? []) as SheetIndexRow[];
    },
  });

  const imagePaths = rows.map((r) => r.primary_image_path).filter((p): p is string => Boolean(p));
  const imageKey = imagePaths.join("|");
  useEffect(() => {
    if (!imagePaths.length) return;
    let cancelled = false;
    signedUrls("plan-files", imagePaths)
      .then((map) => !cancelled && setThumbs(map))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!q) return true;
      return [r.mark, r.product_type, r.building, r.floor, r.room, r.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, category, query]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av > bv ? dir : -dir;
    });
  }, [visible, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; sample: Row; qty: number; count: number }>();
    sorted.forEach((r) => {
      const key = [r.product_type, r.width_in, r.height_in, r.building, r.floor, r.impact].join(
        "|",
      );
      const hit = map.get(key);
      if (hit) {
        hit.qty += r.quantity ?? 1;
        hit.count += 1;
      } else {
        map.set(key, { key, sample: r, qty: r.quantity ?? 1, count: 1 });
      }
    });
    return [...map.values()];
  }, [sorted]);

  const batch = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const ids = [...selected];
      if (!ids.length) throw new Error("Select at least one row.");
      const { error } = await supabase
        .from("takeoff_items")
        .update(patch as never)
        .in("id", ids);
      if (error) throw error;
      return { count: ids.length, patch };
    },
    onSuccess: (result) => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
      toast.success(`${result.count} item${result.count === 1 ? "" : "s"} updated`);
      logAudit({
        projectId,
        action: "takeoff.item_bulk_edited",
        entityType: "takeoff_item",
        detail: { items: result.count, ...(result.patch as Record<string, unknown>) },
      }).then(() => qc.invalidateQueries({ queryKey: ["activity", projectId] }));
    },
    onError: (e: Error) => {
      setMessage(e.message);
      toast.error("Bulk update failed", { description: e.message });
    },
  });

  const inlineUpdate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("takeoff_items")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      return { id, patch };
    },
    onSuccess: (result) => {
      setMessage("Saved");
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
      logAudit({
        projectId,
        action: "takeoff.item_edited",
        entityType: "takeoff_item",
        entityId: result.id,
        detail: result.patch as Record<string, unknown>,
      });
    },
    onError: (e: Error) => {
      setMessage(e.message);
      toast.error("Could not save that change", { description: e.message });
    },
  });

  async function recordExport(type: string, filename: string, blob: Blob) {
    const path = `${projectId}/exports/${Date.now()}-${filename}`;
    const { data: userData } = await supabase.auth.getUser();
    const upload = await supabase.storage.from("project-exports").upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });
    const { error } = await supabase.from("exports").insert({
      project_id: projectId,
      export_type: type,
      status: upload.error ? "failed" : "ready",
      storage_path: upload.error ? null : path,
      filename,
      size_bytes: blob.size,
      error_message: upload.error?.message ?? null,
      created_by: userData.user?.id ?? null,
    });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["exports", projectId] });
  }

  async function sourceSheetSummary() {
    const map = new Map<string, { sheet: string; title: string; itemCount: number }>();
    rows.forEach((r) => {
      const sheet =
        r.pages?.sheet_number ?? (r.pages ? `Page ${r.pages.page_number}` : "Unassigned");
      const hit = map.get(sheet);
      if (hit) hit.itemCount += 1;
      else map.set(sheet, { sheet, title: r.pages?.title ?? "", itemCount: 1 });
    });
    return [...map.values()];
  }

  async function exportExcel() {
    setBusy("xlsx");
    setMessage(null);
    try {
      const items = await withImages(sorted);
      const blob = await buildTakeoffWorkbook({
        project,
        items,
        sourceSheets: await sourceSheetSummary(),
        company,
      });
      const filename = `${(project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-")}-Takeoff.xlsx`;
      await downloadBlob(blob, filename);
      await recordExport("xlsx", filename, blob);
      await logAudit({
        projectId,
        action: "export.generated",
        detail: { type: "xlsx", filename, items: items.length },
      });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setMessage(`Excel export ready: ${filename}`);
      toast.success("Excel takeoff downloaded", { description: filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Excel export failed.";
      setMessage(msg);
      toast.error("Excel export failed", { description: msg });
      await logAudit({ projectId, action: "export.failed", detail: { type: "xlsx", reason: msg } });
    } finally {
      setBusy(null);
    }
  }

  async function exportReportExcel() {
    setBusy("report");
    setMessage(null);
    try {
      const blob = await buildTakeoffReportWorkbook({
        project,
        items: rows,
        scheduleEntries,
        sheetIndex,
        pageCount: pageCount ?? null,
      });
      const filename = `${(project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-")}-Takeoff-Report.xlsx`;
      await downloadBlob(blob, filename);
      await recordExport("takeoff_report_xlsx", filename, blob);
      await logAudit({
        projectId,
        action: "export.generated",
        detail: { type: "takeoff_report_xlsx", filename, items: rows.length },
      });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setMessage(`Takeoff report ready: ${filename}`);
      toast.success("Takeoff report downloaded", { description: filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Takeoff report export failed.";
      setMessage(msg);
      toast.error("Takeoff report failed", { description: msg });
      await logAudit({
        projectId,
        action: "export.failed",
        detail: { type: "takeoff_report_xlsx", reason: msg },
      });
    } finally {
      setBusy(null);
    }
  }

  async function promoteSchedule() {
    if (!canEdit) return;
    setBusy("promote");
    setMessage(null);
    try {
      const pending = await unpromotedScheduleEntries(projectId);
      if (!pending.length) {
        setMessage("No unpromoted schedule rows — everything is already in the takeoff.");
        toast.info("Nothing to promote");
        return;
      }
      const result = await promoteScheduleEntries(projectId);
      qc.invalidateQueries({ queryKey: ["takeoff", projectId] });
      const msg = `Promoted ${result.promoted} schedule row(s) to takeoff${result.unsized ? ` — ${result.unsized} need size verification` : ""}.`;
      setMessage(msg);
      toast.success("Schedule promoted", { description: msg });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Promotion failed.";
      setMessage(msg);
      toast.error("Promotion failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    setMessage(null);
    try {
      const items = await withImages(sorted);
      const blob = await buildTakeoffPdf({
        project,
        items,
        sourceSheets: await sourceSheetSummary(),
        company,
      });
      const filename = `${(project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-")}-Report.pdf`;
      await downloadBlob(blob, filename);
      await recordExport("pdf", filename, blob);
      await logAudit({
        projectId,
        action: "export.generated",
        detail: { type: "pdf", filename, items: items.length },
      });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setMessage(`PDF report ready: ${filename}`);
      toast.success("PDF report downloaded", { description: filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF export failed.";
      setMessage(msg);
      toast.error("PDF export failed", { description: msg });
      await logAudit({ projectId, action: "export.failed", detail: { type: "pdf", reason: msg } });
    } finally {
      setBusy(null);
    }
  }

  async function exportBackup(format: "json" | "csv") {
    setBusy(format);
    setMessage(null);
    try {
      const items = await withImages(sorted);
      const base = (project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-");
      const filename = `${base}-Backup.${format}`;
      const blob =
        format === "json"
          ? buildBackupJson({ project, items, sourceSheets: await sourceSheetSummary(), company })
          : buildBackupCsv(items);
      await downloadBlob(blob, filename);
      await recordExport(`backup_${format}`, filename, blob);
      await logAudit({
        projectId,
        action: "export.generated",
        detail: { type: format, filename, items: items.length },
      });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setMessage(`Backup ready: ${filename}`);
      toast.success("Backup downloaded", { description: filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backup export failed.";
      setMessage(msg);
      toast.error("Backup failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  const totalQty = visible.reduce((sum, r) => sum + (r.quantity ?? 1), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Takeoff report views">
        {REPORT_VIEWS.map((v) => (
          <Button
            key={v.key}
            type="button"
            size="sm"
            variant={view === v.key ? "default" : "outline"}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      {view === "summary" ? (
        <TakeoffSummaryView project={project} items={rows} pageCount={pageCount ?? null} />
      ) : view === "windows" ? (
        <TakeoffWindowsView items={rows} />
      ) : view === "doors" ? (
        <TakeoffDoorsView items={rows} />
      ) : view === "itemized" ? (
        <TakeoffItemizedView items={rows} />
      ) : view === "methodology" ? (
        <TakeoffMethodologyView
          project={project}
          projectId={projectId}
          pageCount={pageCount ?? null}
          sheetIndex={sheetIndex}
        />
      ) : (
        <>
          <TakeoffShortcuts projectId={projectId} />
          <PlanSearchPanel projectId={projectId} canEdit={canEdit} onOpenPage={onOpenPage} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["all", "window", "door", "glazing"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[14rem] flex-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Mark, type, location, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant={grouped ? "default" : "outline"} onClick={() => setGrouped((g) => !g)}>
              {grouped ? "Ungroup" : "Group similar"}
            </Button>
            <Button onClick={exportExcel} disabled={busy !== null}>
              {busy === "xlsx" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 size-4" />
              )}
              Export Excel
            </Button>
            <Button variant="outline" onClick={exportReportExcel} disabled={busy !== null}>
              {busy === "report" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 size-4" />
              )}
              Export Report Excel
            </Button>
            {canEdit && (
              <Button variant="secondary" onClick={promoteSchedule} disabled={busy !== null}>
                {busy === "promote" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Promote schedule → takeoff
              </Button>
            )}
            <Button variant="outline" onClick={exportPdf} disabled={busy !== null}>
              {busy === "pdf" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileText className="mr-2 size-4" />
              )}
              Export PDF
            </Button>
            <Button variant="outline" onClick={() => exportBackup("json")} disabled={busy !== null}>
              {busy === "json" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Backup JSON
            </Button>
            <Button variant="outline" onClick={() => exportBackup("csv")} disabled={busy !== null}>
              {busy === "csv" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Backup CSV
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <span className="font-medium text-navy">
              {visible.length} line items · {totalQty} counted units
            </span>
            {canEdit ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => batch.mutate({ status: "approved" })}
                >
                  Approve selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => batch.mutate({ status: "rejected" })}
                >
                  Reject selected
                </Button>
                <Input
                  className="h-8 w-28"
                  placeholder="Building"
                  value={bulk.building}
                  onChange={(e) => setBulk((b) => ({ ...b, building: e.target.value }))}
                />
                <Input
                  className="h-8 w-24"
                  placeholder="Floor"
                  value={bulk.floor}
                  onChange={(e) => setBulk((b) => ({ ...b, floor: e.target.value }))}
                />
                <Select
                  value={bulk.product_type || "keep"}
                  onValueChange={(v) =>
                    setBulk((b) => ({ ...b, product_type: v === "keep" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep type</SelectItem>
                    {MARKER_TYPES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => {
                    const patch: Record<string, unknown> = {};
                    if (bulk.building) patch.building = bulk.building;
                    if (bulk.floor) patch.floor = bulk.floor;
                    if (bulk.product_type) {
                      const t = markerType(bulk.product_type);
                      patch.product_type = bulk.product_type;
                      if (t) {
                        patch.category = t.category;
                        patch.color = t.color;
                        patch.type_name = t.label;
                      }
                    }
                    if (!Object.keys(patch).length) {
                      setMessage("Enter a building, floor or type to bulk apply.");
                      return;
                    }
                    batch.mutate(patch);
                  }}
                >
                  Apply to selected
                </Button>
              </>
            ) : null}
            {message ? <span className="ml-auto text-navy">{message}</span> : null}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading takeoff items…</p>
            ) : grouped ? (
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left">
                  <tr>
                    {["Type", "Width", "Height", "Building", "Floor", "Markers", "Quantity"].map(
                      (h) => (
                        <th key={h} scope="col" className="px-3 py-3 font-medium text-navy">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {groups.map((g) => (
                    <tr key={g.key}>
                      <td className="px-3 py-2 font-medium text-navy">
                        {typeLabel(g.sample.product_type)}
                      </td>
                      <td className="px-3 py-2">{g.sample.width_in ?? "—"}</td>
                      <td className="px-3 py-2">{g.sample.height_in ?? "—"}</td>
                      <td className="px-3 py-2">{g.sample.building ?? "—"}</td>
                      <td className="px-3 py-2">{g.sample.floor ?? "—"}</td>
                      <td className="px-3 py-2">{g.count}</td>
                      <td className="px-3 py-2 font-semibold">{g.qty}</td>
                    </tr>
                  ))}
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                        No takeoff items yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[70rem] text-sm">
                <thead className="bg-secondary/60 text-left">
                  <tr>
                    <th scope="col" className="w-8 px-2 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    {HEADERS.map(([label, key]) => (
                      <th key={label} scope="col" className="px-3 py-3 font-medium text-navy">
                        {key ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:underline"
                            onClick={() =>
                              setSort((s) => ({
                                key,
                                dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
                              }))
                            }
                          >
                            {label}
                            {sort.key === key ? (
                              <span aria-hidden>{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        ) : (
                          label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/40">
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${r.mark ?? "item"}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-navy">
                        <EditableCell
                          value={r.mark ?? ""}
                          canEdit={canEdit}
                          ariaLabel="Mark"
                          onCommit={(v) =>
                            inlineUpdate.mutate({ id: r.id, patch: { mark: v || null } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{r.category}</td>
                      <td className="px-3 py-2">{typeLabel(r.product_type)}</td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={r.building ?? ""}
                          canEdit={canEdit}
                          ariaLabel="Building"
                          onCommit={(v) =>
                            inlineUpdate.mutate({ id: r.id, patch: { building: v || null } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={r.floor ?? ""}
                          canEdit={canEdit}
                          ariaLabel="Floor"
                          onCommit={(v) =>
                            inlineUpdate.mutate({ id: r.id, patch: { floor: v || null } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={r.room ?? ""}
                          canEdit={canEdit}
                          ariaLabel="Room"
                          onCommit={(v) =>
                            inlineUpdate.mutate({ id: r.id, patch: { room: v || null } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={String(r.quantity ?? 1)}
                          canEdit={canEdit}
                          numeric
                          ariaLabel="Quantity"
                          onCommit={(v) =>
                            inlineUpdate.mutate({
                              id: r.id,
                              patch: { quantity: Math.max(1, Number(v) || 1) },
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={r.width_in != null ? String(r.width_in) : ""}
                          canEdit={canEdit}
                          numeric
                          ariaLabel="Width"
                          onCommit={(v) => {
                            const { inches, error } = parseDimensionInput(v);
                            if (error) {
                              toast.error("Invalid width", { description: error });
                              return;
                            }
                            inlineUpdate.mutate({ id: r.id, patch: { width_in: inches } });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell
                          value={r.height_in != null ? String(r.height_in) : ""}
                          canEdit={canEdit}
                          numeric
                          ariaLabel="Height"
                          onCommit={(v) => {
                            const { inches, error } = parseDimensionInput(v);
                            if (error) {
                              toast.error("Invalid height", { description: error });
                              return;
                            }
                            inlineUpdate.mutate({ id: r.id, patch: { height_in: inches } });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {r.width_in && r.height_in
                          ? ((r.width_in * r.height_in) / 144).toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.primary_image_path && thumbs.get(r.primary_image_path) ? (
                          <img
                            src={thumbs.get(r.primary_image_path)}
                            alt={`Representative crop for ${r.mark ?? "takeoff item"}`}
                            className="h-10 w-14 rounded border border-border object-cover"
                            loading="lazy"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.page_id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenPage(r.page_id!, r.id)}
                          >
                            {r.pages?.sheet_number ?? "Open"}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-3 py-6">
                        <UploadEmptyState
                          title="No takeoff items yet"
                          description="Upload plan documents, then place markers in the Viewer to build the takeoff."
                        />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ExportsTab({
  projectId,
  projectName = "Project",
}: {
  projectId: string;
  projectName?: string;
}) {
  const { data: exports = [], isLoading } = useQuery({
    queryKey: ["exports", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exports")
        .select(
          "id,export_type,status,storage_path,filename,size_bytes,error_message,created_at,created_by",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [
        ...new Set((data ?? []).map((row) => row.created_by).filter(Boolean)),
      ] as string[];
      let names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids);
        names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]));
      }
      return (data ?? []).map((row) => ({
        ...row,
        generated_by: row.created_by ? (names.get(row.created_by) ?? "Unknown") : "—",
      }));
    },
  });

  async function download(path: string, filename: string) {
    const url = await signedUrl("project-exports", path);
    const blob = await (await fetch(url)).blob();
    await downloadBlob(blob, filename);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left">
          <tr>
            {["File", "Type", "Size", "Created", "Generated by", "Status", ""].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium text-navy">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                Loading…
              </td>
            </tr>
          ) : exports.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                No exports generated yet.
              </td>
            </tr>
          ) : (
            exports.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-medium text-navy">{e.filename ?? "—"}</td>
                <td className="px-4 py-3 uppercase text-muted-foreground">{e.export_type}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.size_bytes ? formatBytes(Number(e.size_bytes)) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.generated_by}</td>
                <td className="px-4 py-3">
                  <Badge variant={e.status === "ready" ? "secondary" : "outline"}>{e.status}</Badge>
                  {e.error_message ? (
                    <p className="mt-1 text-xs text-destructive">{e.error_message}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {e.storage_path ? (
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => download(e.storage_path!, e.filename ?? "export")}
                      >
                        <Download className="mr-2 size-4" /> Download
                      </Button>
                      <SaveToDriveButton
                        target={{
                          projectId,
                          projectName,
                          exportId: e.id,
                          storagePath: e.storage_path,
                          filename: e.filename ?? "export",
                        }}
                      />
                      <SaveToDropboxButton
                        target={{
                          projectId,
                          projectName,
                          exportId: e.id,
                          storagePath: e.storage_path,
                          filename: e.filename ?? "export",
                        }}
                      />
                    </span>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
