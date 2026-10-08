/**
 * Proposal line grouping - single source of truth for the Proposal tab.
 *
 * The on-screen table, the PDF export, and the Excel export all consume
 * groupProposalLines() output, so the document always mirrors the screen.
 *
 * Rules:
 *  - Rejected items are excluded entirely.
 *  - Identical mark + type_name + product_type + size combos collapse into
 *    one line with quantities summed.
 *  - Effective quantity = (quantity ?? 0) x (multiplier ?? 1).
 *  - A grouped line is verified only when every underlying item is approved.
 */
import type { TakeoffItemRow } from "@/lib/takeoff/data";

export interface GroupedProposalLine {
  key: string;
  mark: string;
  description: string;
  size: string;
  quantity: number;
  locations: string;
  category: string;
  allApproved: boolean;
  statuses: string[];
}

export function effectiveQty(item: TakeoffItemRow): number {
  return (Number(item.quantity ?? 0) || 0) * (Number(item.multiplier ?? 1) || 1);
}

export function describeItem(item: TakeoffItemRow): string {
  const parts = [item.type_name, item.product_type].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" - ") : "Unit";
}

export function sizeLabel(item: TakeoffItemRow): string {
  return item.width_in != null && item.height_in != null
    ? item.width_in + '" x ' + item.height_in + '"'
    : "-";
}

function locationLabel(item: TakeoffItemRow): string | null {
  const parts = [item.building, item.floor].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function groupProposalLines(items: TakeoffItemRow[]): GroupedProposalLine[] {
  const eligible = items.filter((i) => i.status !== "rejected");
  const map = new Map<
    string,
    {
      mark: string;
      description: string;
      size: string;
      quantity: number;
      category: string;
      allApproved: boolean;
      locations: Set<string>;
      statuses: Set<string>;
    }
  >();
  for (const item of eligible) {
    const key = [
      item.mark ?? "",
      item.type_name ?? "",
      item.product_type ?? "",
      item.width_in ?? "",
      item.height_in ?? "",
    ].join("|");
    let g = map.get(key);
    if (!g) {
      g = {
        mark: item.mark?.trim() || "-",
        description: describeItem(item),
        size: sizeLabel(item),
        quantity: 0,
        category: item.category?.trim() || "Uncategorized",
        allApproved: true,
        locations: new Set<string>(),
        statuses: new Set<string>(),
      };
      map.set(key, g);
    }
    g.quantity += effectiveQty(item);
    const loc = locationLabel(item);
    if (loc) g.locations.add(loc);
    const st = (item.status ?? "pending").trim() || "pending";
    g.statuses.add(st);
    if (st !== "approved") g.allApproved = false;
  }
  const out: GroupedProposalLine[] = [];
  for (const [key, g] of map) {
    const locs = [...g.locations].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    out.push({
      key,
      mark: g.mark,
      description: g.description,
      size: g.size,
      quantity: g.quantity,
      locations: locs.length > 0 ? locs.join(", ") : "-",
      category: g.category,
      allApproved: g.allApproved,
      statuses: [...g.statuses],
    });
  }
  out.sort((a, b) => {
    if (a.mark === "-" && b.mark !== "-") return 1;
    if (b.mark === "-" && a.mark !== "-") return -1;
    return a.mark.localeCompare(b.mark, undefined, { numeric: true });
  });
  return out;
}

export interface ProposalSummary {
  totalUnits: number;
  lineCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  byCategory: { category: string; units: number }[];
}

export function summarizeProposalLines(lines: GroupedProposalLine[]): ProposalSummary {
  const byCat = new Map<string, number>();
  let verified = 0;
  for (const l of lines) {
    if (l.allApproved) verified += 1;
    byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.quantity);
  }
  return {
    totalUnits: lines.reduce((s, l) => s + l.quantity, 0),
    lineCount: lines.length,
    verifiedCount: verified,
    unverifiedCount: lines.length - verified,
    byCategory: [...byCat.entries()]
      .map(([category, units]) => ({ category, units }))
      .sort((a, b) => b.units - a.units),
  };
}
