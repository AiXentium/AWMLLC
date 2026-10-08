/**
 * Preliminary quantities and cross-source discrepancy detection.
 *
 * Deterministic on purpose: every number the estimator sees can be traced back
 * to the schedule rows and plan callouts that produced it, which is what the
 * "Explain this count" action renders.
 */
import { bucketForRow, bucketLabel, type QuantityBucket } from "./shared";
import type { QuantityEstimate } from "@/lib/intelligence/store";

export type MarkEvidence = {
  mark: string | null;
  typeLabel: string | null;
  scheduleType: string;
  operation: string | null;
  material: string | null;
  notes: string | null;
  scheduleQuantity: number;
  confidence: number;
  pageId: string | null;
  sourceSheet: string | null;
  /** Callout hits keyed by the sheet category they were counted on. */
  calloutsByCategory: Record<string, number>;
  calloutSheets: string[];
};

export const SOURCE_LABELS: Record<string, string> = {
  schedule: "Schedule",
  floor_plan: "Floor plans",
  elevation: "Elevations",
  reflected_ceiling_plan: "Reflected ceiling plans",
  section_detail: "Details",
  general_notes: "General notes",
};

export type BucketBreakdown = {
  bucket: QuantityBucket;
  label: string;
  quantity: number;
  confidence: number;
  coverage: string;
  reasoning: string;
  sourceCounts: { source: string; count: number; detail?: string | null }[];
  marks: { mark: string; quantity: number; pageId?: string | null; sourceSheet?: string | null }[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Groups schedule evidence into the seven reportable opening buckets. */
export function buildQuantityBreakdowns(evidence: MarkEvidence[]): BucketBreakdown[] {
  const groups = new Map<QuantityBucket, MarkEvidence[]>();
  for (const row of evidence) {
    const bucket = bucketForRow({
      scheduleType: row.scheduleType,
      mark: row.mark,
      typeLabel: row.typeLabel,
      operation: row.operation,
      material: row.material,
      notes: row.notes,
    });
    groups.set(bucket, [...(groups.get(bucket) ?? []), row]);
  }

  const out: BucketBreakdown[] = [];
  for (const [bucket, rows] of groups) {
    const scheduleTotal = rows.reduce((sum, r) => sum + r.scheduleQuantity, 0);

    const categories = new Set<string>();
    for (const row of rows)
      for (const key of Object.keys(row.calloutsByCategory)) categories.add(key);

    const sourceCounts = [
      { source: "schedule", count: scheduleTotal, detail: `${rows.length} schedule row(s)` },
      ...[...categories].map((category) => {
        const count = rows.reduce((sum, r) => sum + (r.calloutsByCategory[category] ?? 0), 0);
        const marksSeen = rows.filter((r) => (r.calloutsByCategory[category] ?? 0) > 0).length;
        return { source: category, count, detail: `${marksSeen} of ${rows.length} mark(s) found` };
      }),
    ];

    const matchedMarks = rows.filter((r) =>
      Object.values(r.calloutsByCategory).some((n) => n > 0),
    ).length;
    const coverageRatio = rows.length ? matchedMarks / rows.length : 0;

    // Confidence blends how well the model read the rows with how much of the
    // schedule we could actually corroborate on the drawings.
    const readConfidence = rows.length
      ? rows.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / rows.length
      : 0;
    const confidence = round2(Math.min(1, readConfidence * 0.65 + coverageRatio * 0.35));

    const coverage = rows.length
      ? `${matchedMarks} of ${rows.length} scheduled mark(s) corroborated on plans or elevations`
      : "No schedule rows read for this category";

    const unmatched = rows.filter((r) => !Object.values(r.calloutsByCategory).some((n) => n > 0));
    const reasoning = [
      `${scheduleTotal} unit(s) totalled from ${rows.length} ${bucketLabel(bucket).toLowerCase()} schedule row(s).`,
      matchedMarks
        ? `${matchedMarks} mark(s) were also found as callouts on the drawings.`
        : "No matching callouts were found on the drawings.",
      unmatched.length
        ? `Unmatched mark(s): ${unmatched
            .map((r) => r.mark ?? "?")
            .slice(0, 10)
            .join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    out.push({
      bucket,
      label: bucketLabel(bucket),
      quantity: scheduleTotal,
      confidence,
      coverage,
      reasoning,
      sourceCounts,
      marks: rows.map((r) => ({
        mark: r.mark ?? "—",
        quantity: r.scheduleQuantity,
        pageId: r.pageId,
        sourceSheet: r.sourceSheet,
      })),
    });
  }

  return out.sort((a, b) => b.quantity - a.quantity);
}

export function toQuantityEstimates(
  projectId: string,
  runId: string | null,
  breakdowns: BucketBreakdown[],
): QuantityEstimate[] {
  return breakdowns.map((b) => ({
    projectId,
    runId,
    bucket: b.bucket,
    label: b.label,
    quantity: b.quantity,
    confidence: b.confidence,
    coverage: b.coverage,
    reasoning: b.reasoning,
    sourceCounts: b.sourceCounts,
    marks: b.marks,
  }));
}

/**
 * Cross-references schedule totals against floor-plan and elevation callouts.
 * When sources disagree we raise an explicit issue rather than picking one.
 */
export function buildQuantityDiscrepancies(breakdowns: BucketBreakdown[]) {
  const issues: { kind: string; severity: string; message: string }[] = [];

  for (const breakdown of breakdowns) {
    const schedule = breakdown.sourceCounts.find((s) => s.source === "schedule")?.count ?? 0;
    const others = breakdown.sourceCounts.filter((s) => s.source !== "schedule" && s.count > 0);
    if (!schedule || !others.length) continue;

    const disagreeing = others.filter((s) => s.count !== schedule);
    if (!disagreeing.length) continue;

    const parts = [
      `${SOURCE_LABELS.schedule}: ${schedule}`,
      ...others.map((s) => `${SOURCE_LABELS[s.source] ?? s.source}: ${s.count}`),
    ];
    const worst = Math.max(...disagreeing.map((s) => Math.abs(s.count - schedule)));
    const unmatchedNote = breakdown.coverage;

    issues.push({
      kind: "quantity_conflict",
      severity: worst / Math.max(schedule, 1) > 0.15 ? "warning" : "info",
      message:
        `${breakdown.label} counts disagree — ${parts.join(", ")}; ` +
        `AI preliminary count: ${breakdown.quantity}. Reason: ${unmatchedNote}.`,
    });
  }

  return issues;
}
