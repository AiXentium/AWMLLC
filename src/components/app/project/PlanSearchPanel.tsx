/**
 * PlanSearchPanel — Togal-style "search, don't trace" review UI.
 *
 * Two modes:
 *  - Auto-found marks: schedule marks the pipeline extracted, each with the
 *    callout matches found across sheets. Review, verify live, accept/reject,
 *    convert to takeoff.
 *  - Manual search: type any tag (e.g. "W6"), find every sheet containing
 *    it, review the snippets, accept/reject, convert to takeoff.
 *
 * Mounted as a section inside the Takeoff tab.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ScanSearch, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  convertAutoMarksToTakeoff,
  convertManualHitsToTakeoff,
  scheduleMarksForProject,
  searchSheetsForTag,
  verifyMarkAcrossSheets,
  type ScheduleMark,
  type SheetSearchHit,
} from "@/lib/takeoff/plan-search";
import { toast } from "sonner";

type Props = {
  projectId: string;
  canEdit: boolean;
  onOpenPage?: (pageId: string) => void;
};

function sheetLabel(h: {
  sheetNumber: string | null;
  pageNumber: number | null;
  title: string | null;
}): string {
  const sheet = h.sheetNumber ?? (h.pageNumber ? `Page ${h.pageNumber}` : "Sheet");
  return h.title ? `${sheet} — ${h.title}` : sheet;
}

export function PlanSearchPanel({ projectId, canEdit, onOpenPage }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [open, setOpen] = useState(true);

  // ---- Auto mode state ----
  const [acceptedMarks, setAcceptedMarks] = useState<Set<string>>(new Set());
  const [rejectedMarks, setRejectedMarks] = useState<Set<string>>(new Set());
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verified, setVerified] = useState<
    Record<string, { sheets: SheetSearchHit[]; totalMatches: number }>
  >({});
  const [converting, setConverting] = useState(false);

  // ---- Manual mode state ----
  const [tag, setTag] = useState("");
  const [searchedTag, setSearchedTag] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SheetSearchHit[]>([]);
  const [acceptedHits, setAcceptedHits] = useState<Set<string>>(new Set());
  const [rejectedHits, setRejectedHits] = useState<Set<string>>(new Set());

  const { data: marks = [], isLoading: marksLoading } = useQuery({
    queryKey: ["plan-search-marks", projectId],
    queryFn: () => scheduleMarksForProject(projectId),
  });

  const visibleMarks = useMemo(
    () => marks.filter((m) => !rejectedMarks.has(m.id)),
    [marks, rejectedMarks],
  );
  const visibleHits = useMemo(
    () => hits.filter((h) => !rejectedHits.has(h.sheetId)),
    [hits, rejectedHits],
  );

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  async function handleVerify(mark: ScheduleMark) {
    if (!mark.mark || verifying) return;
    setVerifying(mark.id);
    try {
      const result = await verifyMarkAcrossSheets(projectId, mark.mark);
      setVerified((v) => ({ ...v, [mark.id]: result }));
    } catch (e) {
      toast.error("Verification failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setVerifying(null);
    }
  }

  async function handleSearch() {
    const clean = tag.trim();
    if (!clean || searching) return;
    setSearching(true);
    try {
      const results = await searchSheetsForTag(projectId, clean);
      setHits(results);
      setSearchedTag(clean);
      setAcceptedHits(new Set());
      setRejectedHits(new Set());
      if (!results.length) toast.info(`No sheets contain "${clean}"`);
    } catch (e) {
      toast.error("Search failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSearching(false);
    }
  }

  async function handleConvertAuto() {
    const selected = marks.filter((m) => acceptedMarks.has(m.id));
    if (!selected.length || converting) return;
    setConverting(true);
    try {
      const result = await convertAutoMarksToTakeoff(projectId, selected);
      toast.success(`${result.promoted} mark${result.promoted === 1 ? "" : "s"} sent to takeoff`, {
        description: result.skipped ? `${result.skipped} already converted` : undefined,
      });
      setAcceptedMarks(new Set());
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
    } catch (e) {
      toast.error("Conversion failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setConverting(false);
    }
  }

  async function handleConvertManual() {
    const selected = hits.filter((h) => acceptedHits.has(h.sheetId));
    if (!selected.length || !searchedTag || converting) return;
    setConverting(true);
    try {
      const result = await convertManualHitsToTakeoff(projectId, searchedTag, selected);
      toast.success(`${result.promoted} sheet${result.promoted === 1 ? "" : "s"} sent to takeoff`, {
        description: result.skipped ? `${result.skipped} already converted` : undefined,
      });
      setAcceptedHits(new Set());
      qc.invalidateQueries({ queryKey: ["takeoff-items", projectId] });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
    } catch (e) {
      toast.error("Conversion failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ScanSearch className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-serif text-lg text-navy">Plan-wide search</span>
          <Badge variant="outline">search, don&apos;t trace</Badge>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "auto" ? "default" : "outline"}
              onClick={() => setMode("auto")}
            >
              Auto-found marks{marks.length ? ` (${marks.length})` : ""}
            </Button>
            <Button
              size="sm"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
            >
              Manual tag search
            </Button>
          </div>

          {mode === "auto" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Marks the pipeline pulled from schedule sheets, with every matching callout found
                across the plan set. Review them, verify against sheet text, then send the good ones
                to takeoff.
              </p>
              {marksLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading marks…
                </p>
              ) : !marks.length ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No schedule marks yet — run the pre-analysis scan first and they&apos;ll appear
                  here automatically.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {visibleMarks.map((m) => {
                      const v = verified[m.id];
                      const accepted = acceptedMarks.has(m.id);
                      return (
                        <li
                          key={m.id}
                          className={`rounded-md border p-3 ${accepted ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              {canEdit ? (
                                <Checkbox
                                  checked={accepted}
                                  onCheckedChange={() =>
                                    toggle(acceptedMarks, setAcceptedMarks, m.id)
                                  }
                                  aria-label={`Accept mark ${m.mark}`}
                                  className="mt-1"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-navy">
                                  {m.mark ?? "(no mark)"}{" "}
                                  {m.type_label ? (
                                    <span className="font-normal text-muted-foreground">
                                      {m.type_label}
                                    </span>
                                  ) : null}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline">{m.schedule_type ?? "schedule"}</Badge>
                                  {m.quantity != null ? <span>Sched qty {m.quantity}</span> : null}
                                  <span className="font-medium text-navy">
                                    {m.callout_matches ?? 0} callout
                                    {(m.callout_matches ?? 0) === 1 ? "" : "s"}
                                  </span>
                                  {m.callout_sheets?.length ? (
                                    <span>on {m.callout_sheets.join(", ")}</span>
                                  ) : null}
                                  {m.confidence != null ? (
                                    <span>{Math.round(m.confidence * 100)}% conf</span>
                                  ) : null}
                                </div>
                                {v ? (
                                  <div className="mt-2 space-y-1 rounded bg-muted/50 p-2 text-xs">
                                    <p className="font-medium">
                                      Verified live: {v.totalMatches} match
                                      {v.totalMatches === 1 ? "" : "es"} in {v.sheets.length} sheet
                                      {v.sheets.length === 1 ? "" : "s"}
                                    </p>
                                    {v.sheets.slice(0, 5).map((s) => (
                                      <p key={s.sheetId} className="text-muted-foreground">
                                        {sheetLabel(s)} — {s.matchCount}×
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={verifying === m.id || !m.mark}
                                onClick={() => handleVerify(m)}
                                title="Re-verify this mark against stored sheet text"
                              >
                                {verifying === m.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Search className="size-3.5" />
                                )}
                                <span className="ml-1">Verify</span>
                              </Button>
                              {canEdit ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRejectedMarks((s) => new Set(s).add(m.id))}
                                  title="Reject as false positive"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {rejectedMarks.size ? (
                    <Button size="sm" variant="link" onClick={() => setRejectedMarks(new Set())}>
                      Restore {rejectedMarks.size} rejected
                    </Button>
                  ) : null}
                  {canEdit && acceptedMarks.size ? (
                    <Button onClick={handleConvertAuto} disabled={converting}>
                      {converting ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Send {acceptedMarks.size} to takeoff
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Type a window or door tag — every sheet whose text contains it lights up, grouped by
                sheet with match counts and snippets.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. W6, D-12, SF3"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSearch();
                  }}
                  className="max-w-xs"
                />
                <Button onClick={handleSearch} disabled={searching || !tag.trim()}>
                  {searching ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 size-4" />
                  )}
                  Search sheets
                </Button>
              </div>
              {searchedTag ? (
                <p className="text-sm text-muted-foreground">
                  {visibleHits.length} sheet
                  {visibleHits.length === 1 ? "" : "s"} contain{" "}
                  <span className="font-mono font-medium text-navy">“{searchedTag}”</span>
                </p>
              ) : null}
              {visibleHits.length ? (
                <>
                  <ul className="space-y-2">
                    {visibleHits.map((h) => {
                      const accepted = acceptedHits.has(h.sheetId);
                      return (
                        <li
                          key={h.sheetId}
                          className={`rounded-md border p-3 ${accepted ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              {canEdit ? (
                                <Checkbox
                                  checked={accepted}
                                  onCheckedChange={() =>
                                    toggle(acceptedHits, setAcceptedHits, h.sheetId)
                                  }
                                  aria-label={`Accept ${sheetLabel(h)}`}
                                  className="mt-1"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-navy">
                                  {sheetLabel(h)}{" "}
                                  <Badge variant="secondary" className="ml-1">
                                    {h.matchCount} match
                                    {h.matchCount === 1 ? "" : "es"}
                                  </Badge>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">{h.snippet}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {h.pageId && onOpenPage ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onOpenPage(h.pageId as string)}
                                >
                                  Open sheet
                                </Button>
                              ) : null}
                              {canEdit ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRejectedHits((s) => new Set(s).add(h.sheetId))}
                                  title="Reject as false positive"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {canEdit && acceptedHits.size ? (
                    <Button onClick={handleConvertManual} disabled={converting}>
                      {converting ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Send {acceptedHits.size} to takeoff
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
