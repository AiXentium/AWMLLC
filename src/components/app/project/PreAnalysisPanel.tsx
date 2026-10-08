import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileSearch,
  Check,
  CheckCircle2,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  ScanSearch,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { approvePreAnalysis, usePlanPreAnalysis } from "@/lib/analysis/runner";
import { SOURCE_LABELS } from "@/lib/analysis/quantities";
import {
  ANALYSIS_STAGE_LABELS,
  CATEGORY_LABELS,
  COVERAGE_EXPECTATIONS,
  TRADE_FOCI,
  TRADE_FOCUS_ORDER,
  isAnalysisBusy,
  type AnalysisStage,
  type SheetCategory,
  type TradeFocus,
} from "@/lib/analysis/shared";

type QuantityRow = {
  id: string;
  bucket: string;
  label: string;
  quantity: number;
  user_quantity: number | null;
  confidence: number;
  coverage: string | null;
  reasoning: string | null;
  source_counts: { source: string; count: number; detail?: string | null }[] | null;
  marks:
    | { mark: string; quantity: number; pageId?: string | null; sourceSheet?: string | null }[]
    | null;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  stage_message: string | null;
  sheets_total: number;
  sheets_analyzed: number;
  sheets_selected: number;
  schedules_found: number;
  window_count: number;
  door_count: number;
  confidence: number | null;
  used_vision: boolean;
  working_set_id: string | null;
  error_message: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at?: string | null;
  trade_focus?: string | null;
};

type SheetRow = {
  id: string;
  page_id: string | null;
  page_number: number;
  sheet_number: string | null;
  title: string | null;
  category: string;
  confidence: number;
  reason: string | null;
  selected: boolean;
};

type EntryRow = {
  id: string;
  page_id: string | null;
  source_sheet: string | null;
  schedule_type: string;
  mark: string | null;
  type_label: string | null;
  width: string | null;
  height: string | null;
  quantity: number;
  material: string | null;
  glazing: string | null;
  callout_matches: number;
  callout_sheets: string[] | null;
  confidence: number;
};

type IssueRow = {
  id: string;
  kind: string;
  severity: string;
  message: string;
  page_id: string | null;
  source_sheet: string | null;
};

function confidenceTone(value: number) {
  if (value >= 0.8) return "border-emerald-600/40 text-emerald-700";
  if (value >= 0.55) return "border-amber-600/40 text-amber-700";
  return "border-destructive/40 text-destructive";
}

function SheetLink({
  label,
  pageId,
  onOpenPage,
}: {
  label: string;
  pageId: string | null;
  onOpenPage?: (pageId: string) => void;
}) {
  if (!pageId || !onOpenPage) return <span className="text-muted-foreground">{label}</span>;
  return (
    <button
      type="button"
      className="text-navy underline-offset-2 hover:underline"
      onClick={() => onOpenPage(pageId)}
    >
      {label}
    </button>
  );
}

/**
 * Preliminary takeoff review — the automatic AI pre-analysis dashboard.
 *
 * Starts itself in the background after intake and project-information
 * extraction, then reports what it selected, what it read from the schedules,
 * and what conflicts remain, for approval before the full takeoff continues.
 */
export function PreAnalysisPanel({
  projectId,
  canEdit,
  onOpenPage,
  onOpenWorkingSets,
}: {
  projectId: string;
  canEdit: boolean;
  onOpenPage?: (pageId: string) => void;
  onOpenWorkingSets?: () => void;
}) {
  const qc = useQueryClient();
  const [sortByConfidence, setSortByConfidence] = useState(false);
  const [explain, setExplain] = useState<QuantityRow | null>(null);
  // The background watcher lives at the workspace level so it keeps running on
  // every tab; here we only need the manual re-run entry point.
  const { progress, run, forceReset, stop } = usePlanPreAnalysis(projectId, false);
  const [stopping, setStopping] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [approving, setApproving] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ promoted: number; skipped: number } | null>(
    null,
  );
  // Trade focus: scan only this trade's sheets to save AI time and tokens.
  const [tradeFocus, setTradeFocus] = useState<TradeFocus>("all");

  /** Runs pre-analysis on every readable document in sequence (all split parts). */
  async function scanAllDocuments() {
    if (scanningAll) return;
    // Break through a hung in-tab run so the restart actually starts fresh.
    forceReset();
    setScanningAll(true);
    try {
      const { data: docs, error } = await supabase
        .from("documents")
        .select("id,name")
        .eq("project_id", projectId)
        .not("storage_path", "is", null)
        .in("status", ["ready", "partially_failed"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      for (const d of docs ?? []) {
        await run({ documentId: d.id as string, tradeFocus });
      }
    } finally {
      setScanningAll(false);
    }
  }

  const { data: runRow } = useQuery({
    queryKey: ["plan-analysis-run", projectId],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_analysis_runs")
        .select(
          "id,status,stage_message,sheets_total,sheets_analyzed,sheets_selected,schedules_found,window_count,door_count,confidence,used_vision,working_set_id,error_message,approved_at,created_at,updated_at,trade_focus",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data?.[0] ?? null) as RunRow | null;
    },
  });

  const runId = runRow?.id ?? null;
  const busy = isAnalysisBusy(runRow?.status);
  // A run stuck in a busy stage with no DB update for 5+ minutes is abandoned
  // (tab closed mid-call, hung AI request) — without this the UI spins forever.
  const STALLED_MS = 5 * 60 * 1000;
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [busy]);
  const stalled =
    busy &&
    Boolean(runRow?.updated_at) &&
    nowTick - new Date(runRow.updated_at as string).getTime() > STALLED_MS;

  const { data: sheets = [] } = useQuery({
    queryKey: ["plan-analysis-sheets", projectId, runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_sheet_classifications")
        .select("id,page_id,page_number,sheet_number,title,category,confidence,reason,selected")
        .eq("run_id", runId as string)
        .order("page_number");
      return (data ?? []) as SheetRow[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["plan-analysis-entries", projectId, runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_schedule_entries")
        .select(
          "id,page_id,source_sheet,schedule_type,mark,type_label,width,height,quantity,material,glazing,callout_matches,callout_sheets,confidence",
        )
        .eq("run_id", runId as string)
        .order("schedule_type")
        .order("mark");
      return (data ?? []) as EntryRow[];
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["plan-analysis-issues", projectId, runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_analysis_issues")
        .select("id,kind,severity,message,page_id,source_sheet")
        .eq("run_id", runId as string)
        .order("severity");
      return (data ?? []) as IssueRow[];
    },
  });

  const { data: quantities = [] } = useQuery({
    queryKey: ["plan-analysis-quantities", projectId],
    enabled: Boolean(runId),
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_quantity_estimates")
        .select(
          "id,bucket,label,quantity,user_quantity,confidence,coverage,reasoning,source_counts,marks,status",
        )
        .eq("project_id", projectId)
        .order("quantity", { ascending: false });
      return (data ?? []) as unknown as QuantityRow[];
    },
  });

  const scheduleTypes = useMemo(() => {
    const found = new Set<SheetCategory>();
    for (const sheet of sheets) {
      if (sheet.category.endsWith("_schedule")) found.add(sheet.category as SheetCategory);
    }
    return [...found];
  }, [sheets]);

  /** Coverage: which expected sheet categories the set does and does not contain. */
  const coverage = useMemo(
    () =>
      COVERAGE_EXPECTATIONS.map((expectation) => {
        const found = sheets.filter((s) => s.category === expectation.category);
        return {
          ...expectation,
          label: CATEGORY_LABELS[expectation.category],
          sheets: found,
        };
      }),
    [sheets],
  );

  const selectedSheets = useMemo(() => {
    const rows = sheets.filter((s) => s.selected);
    return sortByConfidence ? [...rows].sort((a, b) => a.confidence - b.confidence) : rows;
  }, [sheets, sortByConfidence]);

  if (!runRow) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="flex items-center gap-2 font-serif text-lg text-navy">
          <ScanSearch className="size-5 text-muted-foreground" aria-hidden="true" /> Preliminary
          takeoff review
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {progress
            ? progress.message || ANALYSIS_STAGE_LABELS[progress.stage]
            : "Runs automatically once a plan set has been uploaded and its project information has been read. No manual step needed."}
        </p>
        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Focus:</span>
            {TRADE_FOCUS_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => setTradeFocus(t)}
                title={TRADE_FOCI[t].blurb}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  tradeFocus === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {TRADE_FOCI[t].label}
              </button>
            ))}
          </div>
        ) : null}
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void run({ tradeFocus })}
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Run pre-analysis now
          </Button>
        ) : null}
      </div>
    );
  }

  const stage = runRow.status as AnalysisStage;
  const confidence = Math.round((runRow.confidence ?? 0) * 100);
  const conflicts = issues.filter((i) => i.kind === "conflict");
  const missing = issues.filter((i) => i.kind === "missing_schedule");

  const cards: [string, string | number][] = [
    ["Windows & glazing", runRow.window_count],
    ["Doors", runRow.door_count],
    ["Schedule types found", scheduleTypes.length],
    ["AI confidence", `${confidence}%`],
    [
      "Sheets analyzed",
      `${runRow.sheets_analyzed}${runRow.sheets_total ? ` / ${runRow.sheets_total}` : ""}`,
    ],
    ["Sheets in working set", runRow.sheets_selected],
    ["Missing schedules", missing.length],
    ["Conflicts", conflicts.length],
  ];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-serif text-lg text-navy">
            <ScanSearch className="size-5 text-muted-foreground" aria-hidden="true" /> Preliminary
            takeoff review
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
              {ANALYSIS_STAGE_LABELS[stage] ?? stage}
            </Badge>
            <span>{progress?.message || runRow.stage_message || ""}</span>
            {runRow.trade_focus && runRow.trade_focus !== "all" ? (
              <Badge variant="secondary" className="gap-1">
                Focus: {TRADE_FOCI[runRow.trade_focus as TradeFocus]?.label ?? runRow.trade_focus}
              </Badge>
            ) : null}
            {stalled ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" /> Stalled — no progress for 5+
                min
              </Badge>
            ) : null}
            {runRow.used_vision ? (
              <Badge variant="outline">Scanned set — read by vision</Badge>
            ) : null}
          </div>
          {busy || scanningAll ? (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{runRow?.stage_message || progress?.message || "Working…"}</span>
                <span className="tabular-nums">
                  {runRow?.sheets_total
                    ? `${runRow.sheets_analyzed ?? 0} / ${runRow.sheets_total} sheets · ${Math.min(100, Math.round(((runRow.sheets_analyzed ?? 0) / runRow.sheets_total) * 100))}%`
                    : "Starting…"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-navy transition-all duration-500"
                  style={{
                    width: `${runRow?.sheets_total ? Math.min(100, Math.round(((runRow.sheets_analyzed ?? 0) / runRow.sheets_total) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canEdit && !busy && !scanningAll ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Focus:</span>
              {TRADE_FOCUS_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => setTradeFocus(t)}
                  title={TRADE_FOCI[t].blurb}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    tradeFocus === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {TRADE_FOCI[t].label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!canEdit || busy || scanningAll}
              onClick={() => void scanAllDocuments()}
              title="Run pre-analysis on every document in this project, in order — use after splitting a large set into parts"
            >
              <RefreshCw
                className={`mr-2 size-4 ${busy || scanningAll ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {busy || scanningAll
                ? "Scanning…"
                : tradeFocus === "all"
                  ? "Scan all parts"
                  : `Scan: ${TRADE_FOCI[tradeFocus].label}`}
            </Button>
            {(busy || scanningAll) && canEdit ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={stopping}
                onClick={async () => {
                  setStopping(true);
                  try {
                    await stop();
                  } finally {
                    setStopping(false);
                  }
                }}
                title="Stop the current scan"
              >
                <Square className="mr-2 size-4" aria-hidden="true" />
                {stopping ? "Stopping…" : "Stop scan"}
              </Button>
            ) : null}
            {canEdit && !busy && !scanningAll ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void scanAllDocuments()}
                title="Re-run the scan from scratch"
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                Re-run all
              </Button>
            ) : null}
            {stalled && canEdit ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={scanningAll}
                onClick={() => void scanAllDocuments()}
                title="The current scan stopped making progress — start a fresh scan of all parts"
              >
                <RefreshCw
                  className={`mr-2 size-4 ${scanningAll ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {scanningAll ? "Restarting…" : "Restart stalled scan"}
              </Button>
            ) : null}
            {runRow.working_set_id && onOpenWorkingSets ? (
              <Button variant="outline" size="sm" onClick={onOpenWorkingSets}>
                <Layers className="mr-2 size-4" aria-hidden="true" /> Open working set
              </Button>
            ) : null}
            {canEdit && !busy && !scanningAll ? (
              <Button variant="outline" size="sm" onClick={() => void run({ tradeFocus })}>
                <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Re-run
              </Button>
            ) : null}
            {canEdit && stage === "needs_approval" ? (
              <Button
                size="sm"
                disabled={approving}
                onClick={async () => {
                  setApproving(true);
                  try {
                    await approvePreAnalysis(projectId, runRow.id);
                    // Push the scanned schedule rows straight into takeoff items
                    // so the Takeoff tab is populated immediately after approval.
                    const { promoteScheduleEntries } = await import("@/lib/takeoff/promote");
                    const result = await promoteScheduleEntries(projectId);
                    setPromoteResult(result);
                    qc.invalidateQueries({ queryKey: ["plan-analysis-run", projectId] });
                    qc.invalidateQueries({ queryKey: ["activity", projectId] });
                    qc.invalidateQueries({ queryKey: ["takeoff-cc", projectId] });
                  } finally {
                    setApproving(false);
                  }
                }}
              >
                {approving ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="mr-2 size-4" aria-hidden="true" />
                )}
                {approving ? "Approving…" : "Approve & continue takeoff"}
              </Button>
            ) : null}
            {stage === "approved" ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3" aria-hidden="true" /> Approved
              </Badge>
            ) : null}
            {promoteResult && promoteResult.promoted > 0 ? (
              <span className="text-sm text-muted-foreground">
                {promoteResult.promoted} item{promoteResult.promoted === 1 ? "" : "s"} sent to the
                Takeoff tab
                {promoteResult.skipped > 0 ? ` (${promoteResult.skipped} already there)` : ""}.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {runRow.error_message ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {runRow.error_message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
          </div>
        ))}
      </div>

      {scheduleTypes.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Schedules identified:
          {scheduleTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {CATEGORY_LABELS[type]}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* ---- Preliminary quantities ---- */}
      {quantities.length ? (
        <div className="rounded-md border border-border">
          <p className="border-b border-border px-4 py-2 text-sm font-medium text-navy">
            Preliminary quantities by opening type
          </p>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {quantities.map((row) => (
              <div key={row.id} className="rounded-md border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-navy">
                    {row.user_quantity ?? row.quantity}
                  </span>
                  <Badge variant="outline" className={confidenceTone(row.confidence)}>
                    {Math.round(row.confidence * 100)}% confidence
                  </Badge>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{row.coverage ?? "—"}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 px-0"
                  onClick={() => setExplain(row)}
                >
                  <Info className="mr-2 size-4" aria-hidden="true" /> Explain this count
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- Coverage analysis ---- */}
      {sheets.length ? (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-navy">
            Coverage analysis ({coverage.filter((c) => c.sheets.length).length} of {coverage.length}{" "}
            expected categories detected)
          </summary>
          <ul className="divide-y divide-border border-t border-border text-sm">
            {coverage.map((item) => (
              <li key={item.category} className="flex flex-wrap items-center gap-2 px-4 py-2">
                {item.sheets.length ? (
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle
                    className={
                      item.required ? "size-4 text-amber-600" : "size-4 text-muted-foreground"
                    }
                    aria-hidden="true"
                  />
                )}
                <span className="font-medium text-navy">{item.label}</span>
                {item.sheets.length ? (
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.sheets.length} sheet{item.sheets.length === 1 ? "" : "s"}:
                    {item.sheets.slice(0, 6).map((sheet) => (
                      <SheetLink
                        key={sheet.id}
                        label={sheet.sheet_number ?? `Page ${sheet.page_number}`}
                        pageId={sheet.page_id}
                        onOpenPage={onOpenPage}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{item.missingExplanation}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {issues.length ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-navy">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" /> Missing schedules
            &amp; conflicts
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    issue.severity === "warning" ? "border-amber-600/40 text-amber-700" : ""
                  }
                >
                  {issue.kind.replace(/_/g, " ")}
                </Badge>
                <span>{issue.message}</span>
                {issue.source_sheet ? (
                  <SheetLink
                    label={issue.source_sheet}
                    pageId={issue.page_id}
                    onOpenPage={onOpenPage}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Working set contents ---- */}
      <details className="rounded-md border border-border" open>
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-navy">
          Sheets selected for the working set ({selectedSheets.length})
        </summary>
        <div className="flex items-center justify-end border-t border-border px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => setSortByConfidence((v) => !v)}>
            {sortByConfidence ? "Sort by sheet order" : "Sort by lowest confidence first"}
          </Button>
        </div>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Sheet
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Classified as
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Confidence
                </th>
                <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">
                  Why
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {selectedSheets.map((sheet) => (
                <tr key={sheet.id}>
                  <td className="px-4 py-2">
                    <SheetLink
                      label={sheet.sheet_number ?? `Page ${sheet.page_number}`}
                      pageId={sheet.page_id}
                      onOpenPage={onOpenPage}
                    />
                    {sheet.title ? (
                      <span className="ml-2 text-xs text-muted-foreground">{sheet.title}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {CATEGORY_LABELS[sheet.category as SheetCategory] ?? sheet.category}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={confidenceTone(sheet.confidence)}>
                      {Math.round(sheet.confidence * 100)}%
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-2 text-xs text-muted-foreground md:table-cell">
                    {sheet.reason ?? "—"}
                  </td>
                </tr>
              ))}
              {selectedSheets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-sm text-muted-foreground">
                    No takeoff-relevant sheets were selected yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>

      {/* ---- Schedule rows ---- */}
      <details className="rounded-md border border-border" open={entries.length > 0}>
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-navy">
          Preliminary schedule read ({entries.length} row{entries.length === 1 ? "" : "s"})
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Mark
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Size
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Qty
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Plan callouts
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Source sheet
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 font-medium text-navy">{entry.mark ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.type_label ?? entry.schedule_type}
                    <span className="ml-2 text-xs uppercase tracking-wide">
                      {entry.schedule_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[entry.width, entry.height].filter(Boolean).join(" × ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.quantity}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.callout_matches > 0 ? (
                      <span>
                        {entry.callout_matches} on{" "}
                        {(entry.callout_sheets ?? []).slice(0, 3).join(", ")}
                      </span>
                    ) : (
                      <span className="text-amber-700">none found</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <SheetLink
                      label={entry.source_sheet ?? "—"}
                      pageId={entry.page_id}
                      onOpenPage={onOpenPage}
                    />
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-sm text-muted-foreground">
                    No schedule rows were read. Open the selected sheets to verify manually.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>

      {/* ---- Explain this count ---- */}
      <Dialog open={Boolean(explain)} onOpenChange={(open) => !open && setExplain(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{explain?.label} — how this count was reached</DialogTitle>
            <DialogDescription>
              AI preliminary count: {explain?.user_quantity ?? explain?.quantity} ·{" "}
              {Math.round((explain?.confidence ?? 0) * 100)}% confidence
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Counts by source
              </p>
              <ul className="mt-1 space-y-1">
                {(explain?.source_counts ?? []).map((source) => (
                  <li key={source.source} className="flex items-center justify-between gap-3">
                    <span>{SOURCE_LABELS[source.source] ?? source.source}</span>
                    <span className="text-muted-foreground">
                      {source.count}
                      {source.detail ? ` — ${source.detail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Reasoning</p>
              <p className="mt-1 text-muted-foreground">{explain?.reasoning ?? "—"}</p>
              <p className="mt-1 text-muted-foreground">{explain?.coverage ?? ""}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Schedule rows &amp; originating sheets
              </p>
              <ul className="mt-1 space-y-1">
                {(explain?.marks ?? []).map((mark, index) => (
                  <li key={`${mark.mark}-${index}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-navy">{mark.mark}</span>
                    <span className="text-muted-foreground">qty {mark.quantity}</span>
                    {mark.sourceSheet ? (
                      <SheetLink
                        label={mark.sourceSheet}
                        pageId={mark.pageId ?? null}
                        onOpenPage={(pageId) => {
                          setExplain(null);
                          onOpenPage?.(pageId);
                        }}
                      />
                    ) : null}
                  </li>
                ))}
                {(explain?.marks ?? []).length === 0 ? (
                  <li className="text-muted-foreground">
                    No schedule rows recorded for this category.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Compact live status used inside the Plans intake queue. */
export function PreAnalysisStatusChip({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ["plan-analysis-chip", projectId],
    refetchInterval: 6000,
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_analysis_runs")
        .select("status,stage_message,sheets_analyzed,sheets_total,sheets_selected")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
  if (!data) return null;
  const stage = data.status as AnalysisStage;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="gap-1">
        {isAnalysisBusy(stage) ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <FileSearch className="size-3" aria-hidden="true" />
        )}
        Pre-analysis: {ANALYSIS_STAGE_LABELS[stage] ?? stage}
      </Badge>
      {data.sheets_total ? (
        <span>
          {data.sheets_analyzed}/{data.sheets_total} sheets
        </span>
      ) : null}
      {data.sheets_selected ? <span>{data.sheets_selected} selected</span> : null}
      {data.stage_message ? <span>{data.stage_message}</span> : null}
    </div>
  );
}
