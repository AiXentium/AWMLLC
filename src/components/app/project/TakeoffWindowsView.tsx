import { useMemo } from "react";
import type { Row } from "./useTakeoffItems";
import { buildingsFromItems, formatFtIn, windowsByMark } from "@/lib/takeoff/takeoff-report";

export function TakeoffWindowsView({ items }: { items: Row[] }) {
  const buildings = useMemo(() => buildingsFromItems(items), [items]);
  const rows = useMemo(() => windowsByMark(items), [items]);
  const totals = useMemo(() => {
    const per: Record<string, number> = {};
    for (const b of buildings) per[b] = 0;
    let grand = 0;
    for (const r of rows) {
      for (const b of buildings) per[b] += r.perBuilding[b] ?? 0;
      grand += r.total;
    }
    return { per, grand };
  }, [rows, buildings]);

  const headers = [
    "Type",
    "Width",
    "Height",
    "Total Ht",
    "Style / Notes",
    ...buildings,
    "TOTAL",
    "Source",
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-3 font-medium text-navy">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.mark}>
              <td className="px-3 py-2 font-medium text-navy">{r.mark}</td>
              <td className="px-3 py-2">{formatFtIn(r.widthIn)}</td>
              <td className="px-3 py-2">{formatFtIn(r.heightIn)}</td>
              <td className="px-3 py-2">{formatFtIn(r.heightIn)}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.styleNotes}</td>
              {buildings.map((b) => (
                <td key={b} className="px-3 py-2">
                  {r.perBuilding[b] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2 font-semibold">{r.total}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.sources.join(", ")}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-muted-foreground">
                No windows in the takeoff.
              </td>
            </tr>
          ) : (
            <tr className="bg-secondary/40 font-semibold">
              <td className="px-3 py-2 text-navy">TOTALS</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              {buildings.map((b) => (
                <td key={b} className="px-3 py-2">
                  {totals.per[b] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2">{totals.grand}</td>
              <td className="px-3 py-2" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
