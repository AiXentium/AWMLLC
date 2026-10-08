/**
 * Washington-format takeoff report — shared grouping/summary logic.
 *
 * Pure functions over takeoff items. Used by the report views
 * (TakeoffSummaryView, TakeoffWindowsView, TakeoffDoorsView,
 * TakeoffItemizedView, TakeoffMethodologyView) and by the Excel export
 * (buildTakeoffReportWorkbook in @/lib/exports/takeoff-excel).
 *
 * Additive only — no changes to the existing takeoff item list,
 * proposal flow, or legacy Excel export.
 */
import { typeLabel } from "@/lib/takeoff-types";
import type { Row } from "@/components/app/project/useTakeoffItems";

const UNASSIGNED = "Unassigned";

export type SheetIndexRow = {
  sheet_number: string | null;
  title: string | null;
  page_number: number;
  category: string | null;
  selected: boolean | null;
};

/** Normalized building key for grouping — blank buildings collapse to "Unassigned". */
export function buildingKey(item: Row): string {
  const b = (item.building ?? "").trim();
  return b || UNASSIGNED;
}

/** Distinct non-empty building names, sorted. Falls back to ["Unassigned"] when none. */
export function buildingsFromItems(items: Row[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const b = (item.building ?? "").trim();
    if (b) set.add(b);
  }
  const list = [...set].sort((a, b) => a.localeCompare(b));
  return list.length > 0 ? list : [UNASSIGNED];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Format inches as feet-inches, e.g. 36 → 3'-0", 30 → 2'-6",
 * 36.5 → 3'-0 1/2". Null/undefined/NaN → "—".
 */
export function formatFtIn(inches: number | null | undefined): string {
  if (inches === null || inches === undefined || Number.isNaN(inches)) return "—";
  const sixteenths = Math.max(0, Math.round(inches * 16));
  const feet = Math.floor(sixteenths / 192);
  const rest = sixteenths - feet * 192;
  const whole = Math.floor(rest / 16);
  const frac = rest % 16;
  let inchPart = `${whole}"`;
  if (frac > 0) {
    const g = gcd(frac, 16);
    inchPart = `${whole} ${frac / g}/${16 / g}"`;
  }
  return `${feet}'-${inchPart}`;
}

export type WindowTypeRow = {
  mark: string;
  widthIn: number | null;
  heightIn: number | null;
  styleNotes: string;
  perBuilding: Record<string, number>;
  total: number;
  sources: string[];
};

/** Window items grouped by mark, quantities summed per building. Sorted by mark. */
export function windowsByMark(items: Row[]): WindowTypeRow[] {
  const map = new Map<string, WindowTypeRow>();
  for (const item of items) {
    if (item.category !== "window") continue;
    const mark = (item.mark ?? "").trim() || "Unmarked";
    let row = map.get(mark);
    if (!row) {
      row = {
        mark,
        widthIn: item.width_in ?? null,
        heightIn: item.height_in ?? null,
        styleNotes: item.description ?? typeLabel(item.product_type),
        perBuilding: {},
        total: 0,
        sources: [],
      };
      map.set(mark, row);
    }
    const qty = item.quantity ?? 1;
    const b = buildingKey(item);
    row.perBuilding[b] = (row.perBuilding[b] ?? 0) + qty;
    row.total += qty;
    if (row.widthIn === null && item.width_in !== null && item.width_in !== undefined) {
      row.widthIn = item.width_in;
    }
    if (row.heightIn === null && item.height_in !== null && item.height_in !== undefined) {
      row.heightIn = item.height_in;
    }
    const label =
      item.pages?.sheet_number ?? (item.pages ? `Page ${item.pages.page_number}` : null);
    if (label && !row.sources.includes(label)) row.sources.push(label);
  }
  return [...map.values()].sort((a, b) => a.mark.localeCompare(b.mark));
}

export type DoorTypeRow = {
  mark: string;
  description: string;
  perBuilding: Record<string, number>;
  total: number;
};

/** Door items grouped by mark, quantities summed per building. Sorted by mark. */
export function doorsByMark(items: Row[]): DoorTypeRow[] {
  const map = new Map<string, DoorTypeRow>();
  for (const item of items) {
    if (item.category !== "door") continue;
    const mark = (item.mark ?? "").trim() || "Unmarked";
    let row = map.get(mark);
    if (!row) {
      row = {
        mark,
        description: item.description ?? "",
        perBuilding: {},
        total: 0,
      };
      map.set(mark, row);
    }
    const qty = item.quantity ?? 1;
    const b = buildingKey(item);
    row.perBuilding[b] = (row.perBuilding[b] ?? 0) + qty;
    row.total += qty;
  }
  return [...map.values()].sort((a, b) => a.mark.localeCompare(b.mark));
}

/** Door items sorted by building, floor, mark (for the itemized report). */
export function sortDoorItems(items: Row[]): Row[] {
  return [...items]
    .filter((i) => i.category === "door")
    .sort(
      (a, b) =>
        (a.building ?? "").localeCompare(b.building ?? "") ||
        (a.floor ?? "").localeCompare(b.floor ?? "") ||
        (a.mark ?? "").localeCompare(b.mark ?? ""),
    );
}

/**
 * Leaf heuristic over a schedule operation string only:
 * "DBL" for double/pair, "PKT" for pocket/barn/slider/sliding, else "SGL".
 */
export function leafForOperation(operation: string | null | undefined): string {
  const op = (operation ?? "").toLowerCase();
  if (/double|pair/.test(op)) return "DBL";
  if (/pocket|barn|slider|sliding/.test(op)) return "PKT";
  return "SGL";
}

/**
 * Leaf heuristic over a takeoff item: "DBL" when operation, description or
 * product_type mentions double/pair; "PKT" for pocket/barn/slider/sliding;
 * otherwise "SGL".
 */
export function leafFor(item: Row): string {
  const hay =
    `${item.operation ?? ""} ${item.description ?? ""} ${item.product_type ?? ""}`.toLowerCase();
  if (/double|pair/.test(hay)) return "DBL";
  if (/pocket|barn|slider|sliding/.test(hay)) return "PKT";
  return "SGL";
}

export type SummaryCategory = {
  key: string;
  label: string;
  notes: string;
  matches: (item: Row) => boolean;
};

const STOREFRONT_DOOR_MARKS = /^D-(8|16|17)$/i;

export const SUMMARY_CATEGORIES: SummaryCategory[] = [
  {
    key: "windows",
    label: "Windows",
    notes: "Counted from takeoff items by mark and building.",
    matches: (item) => item.category === "window",
  },
  {
    key: "common_doors",
    label: "Common-Area Doors",
    notes: "Interior and common-area doors; excludes storefront and unit entry doors.",
    matches: (item) =>
      item.category === "door" &&
      item.product_type !== "storefront_door" &&
      !STOREFRONT_DOOR_MARKS.test(item.mark ?? ""),
  },
  {
    key: "storefront_doors",
    label: "Storefront Doors",
    notes: "Storefront entrance doors — storefront_door type or D-8 / D-16 / D-17 marks.",
    matches: (item) =>
      item.category === "door" &&
      (item.product_type === "storefront_door" || STOREFRONT_DOOR_MARKS.test(item.mark ?? "")),
  },
  {
    key: "storefront_types",
    label: "Storefront Types",
    notes: "Storefront and curtain wall glazing systems by type.",
    matches: (item) =>
      item.category === "glazing" ||
      item.product_type === "storefront" ||
      item.product_type === "curtain_wall",
  },
  {
    key: "unit_doors",
    label: "Unit Door Types",
    notes: "Unit entry doors (U-series marks) from the door schedule.",
    matches: (item) => /^U\d/i.test(item.mark ?? ""),
  },
  {
    key: "sliding_doors",
    label: "Sliding Doors",
    notes: "Sliding glass doors — verify count against the door schedule and elevations.",
    matches: (item) => item.product_type === "sliding_glass" || /slid/i.test(item.operation ?? ""),
  },
];

export type CategorySummary = {
  category: SummaryCategory;
  perBuilding: Record<string, number>;
  total: number;
};

/** Per-category per-building quantity matrix plus totals. */
export function summarizeByCategory(
  items: Row[],
  categories: SummaryCategory[],
  buildings: string[],
): CategorySummary[] {
  return categories.map((category) => {
    const perBuilding: Record<string, number> = {};
    for (const b of buildings) perBuilding[b] = 0;
    let total = 0;
    for (const item of items) {
      if (!category.matches(item)) continue;
      const qty = item.quantity ?? 1;
      const b = buildingKey(item);
      perBuilding[b] = (perBuilding[b] ?? 0) + qty;
      total += qty;
    }
    return { category, perBuilding, total };
  });
}

/** Sheet index display rule: selected-only when any sheet is marked selected, else all. */
export function visibleSheetIndex(rows: SheetIndexRow[]): SheetIndexRow[] {
  const anySelected = rows.some((r) => r.selected);
  return anySelected ? rows.filter((r) => r.selected) : rows;
}

export const BIDDING_NOTES: string[] = [
  "Verify all counts against the architectural elevations and the door/window schedules before finalizing pricing.",
  "Window and door types are schedule-defined: confirm operation, glazing, and frame material against the project specifications.",
  "Dimensions are transcribed from the contract documents; field-verify critical openings before ordering.",
  "Reconcile storefront, curtain wall, and sliding door quantities with the structural and architectural sheets.",
  "Impact-rated products are flagged per the jurisdiction requirements — confirm Florida Product Approval numbers with the manufacturer.",
  "Coordinate hardware, thresholds, and anchoring requirements with the door schedule notes and Division 08 specifications.",
];

export const METHODOLOGY_NOTES: string[] = [
  "Counts are derived from the contract document set listed in the sheet index.",
  "Window and door types come from the schedules; plan callouts and elevations were used to verify quantities.",
  "Dimensions are transcribed verbatim from the schedules — never estimated or rounded by the software.",
  "Items without a confirmed size are counted but flagged for verification before ordering.",
  "Re-run the takeoff after any addendum or revised drawing set and compare totals before bidding.",
];

export const SLIDING_FINDINGS: string[] = [
  "Confirm sliding door locations against the architectural floor plans and elevations.",
  "Verify panel counts, operation, and track configurations with the architect before pricing.",
  "Confirm impact-rating and Florida Product Approval requirements for each sliding door.",
  "Coordinate sill, track, and waterproofing details with the project specifications.",
];
