import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/lib/status-tone";

export function StatusBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className={`border font-medium ${statusTone(label)}`}>
      {label}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="surface-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-4xl font-semibold text-navy">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  statusColumn,
}: {
  headers: string[];
  rows: (string | number)[][];
  statusColumn?: number;
}) {
  return (
    <div className="surface-panel overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/60 text-left">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border last:border-0 hover:bg-secondary/40"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-middle text-foreground">
                  {statusColumn === cellIndex ? <StatusBadge label={String(cell)} /> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
