import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ExportProject } from "@/lib/exports/excel-export";
import {
  METHODOLOGY_NOTES,
  visibleSheetIndex,
  type SheetIndexRow,
} from "@/lib/takeoff/takeoff-report";

type AnalysisRunMeta = {
  id: string;
  project_id: string;
  status: string | null;
  stage_message: string | null;
  created_at: string | null;
};

const SHEET_HEADERS = ["Sheet", "Title", "PDF Page", "Used For"];

export function TakeoffMethodologyView({
  project,
  projectId,
  pageCount,
  sheetIndex,
}: {
  project: ExportProject;
  projectId: string;
  pageCount: number | null;
  sheetIndex: SheetIndexRow[];
}) {
  const { data: run } = useQuery({
    queryKey: ["takeoff-report-latest-run", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_analysis_runs")
        .select("id,project_id,status,stage_message,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AnalysisRunMeta | null;
    },
  });

  const shown = useMemo(() => visibleSheetIndex(sheetIndex), [sheetIndex]);

  const address =
    [project.address, project.city, project.state, project.postal_code]
      .filter(Boolean)
      .join(", ") || "—";

  const info: [string, string][] = [
    ["Project", project.name],
    ["Architect", project.architect ?? "—"],
    ["Address", address],
    ["Total pages", pageCount === null ? "—" : String(pageCount)],
    [
      "Latest analysis run",
      run
        ? `${run.status ?? "unknown"}${run.stage_message ? ` — ${run.stage_message}` : ""}${
            run.created_at ? ` (${new Date(run.created_at).toLocaleString()})` : ""
          }`
        : "No analysis runs recorded.",
    ],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-navy">Source Document</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {info.map(([label, value]) => (
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
              {SHEET_HEADERS.map((h) => (
                <th key={h} scope="col" className="px-3 py-3 font-medium text-navy">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((s, i) => (
              <tr key={`${s.page_number}-${i}`}>
                <td className="px-3 py-2 font-medium text-navy">{s.sheet_number ?? "—"}</td>
                <td className="px-3 py-2">{s.title ?? "—"}</td>
                <td className="px-3 py-2">{s.page_number}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.category ?? "—"}</td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={SHEET_HEADERS.length} className="px-3 py-6 text-muted-foreground">
                  No sheet classifications recorded for this project.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-navy">Methodology Notes</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {METHODOLOGY_NOTES.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
