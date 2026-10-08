/**
 * Proposal tab - bid proposal auto-populated from AI takeoff results.
 *
 * Data flow: useTakeoffItems(projectId) -> groupProposalLines() ->
 * on-screen table + PDF (buildProposalPdf) + Excel (buildProposalWorkbook).
 * All three views consume the same grouped lines: single source of truth.
 */
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTakeoffItems } from "@/lib/takeoff/data";
import { buildProposalPdf, type ProposalLine } from "@/lib/exports/proposal-pdf";
import { buildProposalWorkbook } from "@/lib/exports/proposal-excel";
import { groupProposalLines, summarizeProposalLines } from "./proposal-lines";
import { ProposalDocument } from "./ProposalDocument";

export interface ProposalProjectInfo {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  general_contractor?: string | null;
}

interface ProposalTabProps {
  projectId: string;
  project: ProposalProjectInfo;
  onGoToTakeoff: () => void;
}

const COMPANY = {
  name: "AWM LLC",
  phone: "(352) 887-5667",
  email: "info@awm.llc",
  address: "9997 S Orange Blossom Trl, Orlando, FL 32837",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "project";
}

export function ProposalTab({ projectId, project, onGoToTakeoff }: ProposalTabProps) {
  const { data: items = [], isLoading, isError } = useTakeoffItems(projectId);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"document" | "table">("document");

  const groups = useMemo(() => groupProposalLines(items), [items]);
  const visibleGroups = useMemo(
    () => groups.filter((g) => !hiddenCategories.has(g.category)),
    [groups, hiddenCategories],
  );
  const summary = useMemo(() => summarizeProposalLines(visibleGroups), [visibleGroups]);
  const allCategories = useMemo(() => summarizeProposalLines(groups).byCategory, [groups]);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );
  const projectAddress = useMemo(
    () => [project.address, project.city, project.state].filter(Boolean).join(", ") || null,
    [project],
  );
  const preparedFor = project.general_contractor?.trim() || "To be confirmed";
  const fileStamp = new Date().toISOString().slice(0, 10);

  async function handlePdf() {
    setBusy("pdf");
    try {
      const lines: ProposalLine[] = visibleGroups.map((g) => ({
        mark: g.mark,
        description: g.locations !== "-" ? g.description + " - " + g.locations : g.description,
        size: g.size === "-" ? null : g.size,
        quantity: g.quantity,
        unitPrice: 0,
        total: 0,
      }));
      const blob = await buildProposalPdf({
        company: COMPANY,
        project: { name: project.name, address: projectAddress, date: dateStr },
        customer: { name: preparedFor },
        lines,
        subtotal: 0,
        tax: 0,
        total: 0,
        assumptions:
          summary.unverifiedCount > 0
            ? [
                summary.unverifiedCount +
                  " of " +
                  summary.lineCount +
                  " proposal lines are not yet verified - review them in the Takeoff tab before sending.",
              ]
            : [],
        validityDays: 30,
        notes: "Unit pricing to be confirmed (TBD). Quantities auto-populated from AI takeoff.",
      });
      downloadBlob(blob, "AWM-Proposal-" + slug(project.name) + "-" + fileStamp + ".pdf");
    } finally {
      setBusy(null);
    }
  }

  async function handleExcel() {
    setBusy("excel");
    try {
      const blob = await buildProposalWorkbook({
        company: COMPANY,
        project: {
          name: project.name,
          address: projectAddress,
          date: dateStr,
          preparedFor,
        },
        lines: visibleGroups,
        totalUnits: summary.totalUnits,
        verifiedCount: summary.verifiedCount,
        unverifiedCount: summary.unverifiedCount,
        byCategory: summary.byCategory,
        validityDays: 30,
        notes: "Unit pricing to be confirmed (TBD). Quantities auto-populated from AI takeoff.",
      });
      downloadBlob(blob, "AWM-Proposal-" + slug(project.name) + "-" + fileStamp + ".xlsx");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading takeoff items...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="font-medium text-navy">Could not load takeoff items.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your connection and try the Takeoff tab.
        </p>
        <Button className="mt-4" variant="outline" onClick={onGoToTakeoff}>
          Go to Takeoff tab
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-4 font-serif text-xl text-navy">No proposal lines yet</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {items.length === 0
            ? "Run takeoff first - the AI needs to count windows and doors before a proposal can be built."
            : "Every takeoff item on this project is rejected, so there is nothing to propose."}
        </p>
        <Button className="mt-6" onClick={onGoToTakeoff}>
          Go to Takeoff tab
        </Button>
      </div>
    );
  }

  function toggleCategory(category: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function showAllCategories() {
    setHiddenCategories(new Set());
  }

  const cards: [string, number][] = [
    ["Total units", summary.totalUnits],
    ["Line items", summary.lineCount],
    ["Verified", summary.verifiedCount],
    ["Needs review", summary.unverifiedCount],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-navy">Proposal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-populated from AI takeoff
            {projectAddress ? " - " + projectAddress : ""} - {dateStr}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Proposal view"
            className="flex rounded-md border border-border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              onClick={() => setView("document")}
              aria-pressed={view === "document"}
              className={
                "rounded px-3 py-1.5 text-xs font-semibold transition-colors " +
                (view === "document"
                  ? "bg-navy text-white shadow-sm"
                  : "text-muted-foreground hover:text-navy")
              }
            >
              Document
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={
                "rounded px-3 py-1.5 text-xs font-semibold transition-colors " +
                (view === "table"
                  ? "bg-navy text-white shadow-sm"
                  : "text-muted-foreground hover:text-navy")
              }
            >
              Table
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExcel} disabled={busy !== null}>
            {busy === "excel" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
            )}
            Export Excel
          </Button>
          <Button size="sm" onClick={handlePdf} disabled={busy !== null}>
            {busy === "pdf" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-2 size-4" aria-hidden="true" />
            )}
            Generate PDF
          </Button>
        </div>
      </div>

      {summary.unverifiedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-50 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-amber-900">
            {summary.unverifiedCount} of {summary.lineCount} lines are not yet verified. Review them
            in the Takeoff tab before sending this proposal.
          </p>
        </div>
      )}

      {allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Show:
          </span>
          {allCategories.map((c) => {
            const hidden = hiddenCategories.has(c.category);
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => toggleCategory(c.category)}
                aria-pressed={!hidden}
                title={hidden ? "Show " + c.category : "Hide " + c.category}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (hidden
                    ? "border-border bg-muted text-muted-foreground line-through opacity-60 hover:opacity-100"
                    : "border-navy/30 bg-navy/5 text-navy hover:bg-navy/10")
                }
              >
                {c.category} - {c.units}
              </button>
            );
          })}
          {hiddenCategories.size > 0 && (
            <button
              type="button"
              onClick={showAllCategories}
              className="rounded-full px-3 py-1 text-xs font-semibold text-bronze underline underline-offset-2 hover:text-bronze/80"
            >
              Show all
            </button>
          )}
        </div>
      )}

      {view === "document" ? (
        <ProposalDocument
          company={COMPANY}
          project={{
            name: project.name,
            address: projectAddress,
            date: dateStr,
            preparedFor,
          }}
          lines={visibleGroups}
          totalUnits={summary.totalUnits}
          verifiedCount={summary.verifiedCount}
          unverifiedCount={summary.unverifiedCount}
          byCategory={summary.byCategory}
          validityDays={30}
          notes="Unit pricing to be confirmed (TBD). Quantities auto-populated from AI takeoff."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-navy">{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Mark</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Floor/Building</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleGroups.map((g) => (
                  <tr key={g.key} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{g.mark}</td>
                    <td className="px-4 py-3">{g.description}</td>
                    <td className="whitespace-nowrap px-4 py-3">{g.size}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{g.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.locations}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {g.allApproved ? (
                        <Badge variant="secondary">Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-600/40 text-amber-700">
                          Needs review
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">TBD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Quantities include typical-floor multipliers. Unit pricing to be confirmed - this
            proposal reflects AI takeoff counts, {summary.verifiedCount} of {summary.lineCount}{" "}
            lines verified.
          </p>
        </>
      )}
    </div>
  );
}
