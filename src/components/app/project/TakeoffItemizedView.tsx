import { useMemo } from "react";
import type { Row } from "./useTakeoffItems";
import { formatFtIn, leafFor, sortDoorItems } from "@/lib/takeoff/takeoff-report";

const HEADERS = [
  "Building",
  "Level",
  "Door No.",
  "Room Name",
  "Leaf",
  "Width",
  "Height",
  "Door Type",
];

export function TakeoffItemizedView({ items }: { items: Row[] }) {
  const doors = useMemo(() => sortDoorItems(items), [items]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-navy">{doors.length} doors</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              {HEADERS.map((h) => (
                <th key={h} scope="col" className="px-3 py-3 font-medium text-navy">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doors.map((d) => (
              <tr key={d.id} className="hover:bg-secondary/40">
                <td className="px-3 py-2">{d.building ?? "—"}</td>
                <td className="px-3 py-2">{d.floor ?? "—"}</td>
                <td className="px-3 py-2 font-medium text-navy">{d.mark ?? "—"}</td>
                <td className="px-3 py-2">{d.room ?? "—"}</td>
                <td className="px-3 py-2">{leafFor(d)}</td>
                <td className="px-3 py-2">{formatFtIn(d.width_in)}</td>
                <td className="px-3 py-2">{formatFtIn(d.height_in)}</td>
                <td className="px-3 py-2">{d.mark ?? "—"}</td>
              </tr>
            ))}
            {doors.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-3 py-6 text-muted-foreground">
                  No doors in the takeoff.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
