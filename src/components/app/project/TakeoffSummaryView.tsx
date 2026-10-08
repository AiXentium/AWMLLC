import { useMemo } from "react";
import type { ExportProject } from "@/lib/exports/excel-export";
import type { Row } from "./useTakeoffItems";
import {
  BIDDING_NOTES,
  buildingsFromItems,
  SUMMARY_CATEGORIES,
  summarizeByCategory,
} from "@/lib/takeoff/takeoff-report";

export function TakeoffSummaryView({
  project,
  items,
  pageCount,
}: {
  project: ExportProject;
  items: Row[];
  pageCount: number | null;
}) {
  const buildings = useMemo(() => buildingsFromItems(items), [items]);
  const summaries = useMemo(
    () => summarizeByCategory(items, SUMMARY_CATEGORIES, buildings),
    [items, buildings],
  );
  const totalUnits = useMemo(() => items.reduce((sum, i) => sum + (i.quantity ?? 1), 0), [items]);
  const address =
    [project.address, project.city, project.state, project.postal_code]
      .filter(Boolean)
      .join(", ") || "—";

  const facts: [string, string][] = [
    ["Project", project.name],
    ["Address", address],
    ["Architect", project.architect ?? "—"],
    ["Set Stage", "—"],
    ["Drawing Set Pages", pageCount === null ? "—" : String(pageCount)],
    ["Total Line Items", String(items.length)],
    ["Total Counted Units", String(totalUnits)],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-navy">Project Facts</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex gap-2 text-sm">
              <dt className="w-36 shrink-0 font-medium text-muted-foreground">{label}</dt>
              <dd className="text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              {["Category", ...buildings, "Total", "Notes"].map((h) => (
                <th key={h} scope="col" className="px-3 py-3 font-medium text-navy">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summaries.map((s) => (
              <tr key={s.category.key}>
                <td className="px-3 py-2 font-medium text-navy">{s.category.label}</td>
                {buildings.map((b) => (
                  <td key={b} className="px-3 py-2">
                    {s.perBuilding[b] ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 font-semibold">{s.total}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.category.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-navy">Important Notes for Bidding</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {BIDDING_NOTES.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
