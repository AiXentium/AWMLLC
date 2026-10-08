/**
 * Quantity calculation engine — deterministic math on verified takeoff items.
 *
 * Every quantity comes from the stored width_in / height_in / quantity on
 * takeoff_items. No AI arithmetic: the model transcribes dimensions, this
 * module does the math. Items without a recorded size contribute their unit
 * count but are excluded from area/length totals and flagged.
 *
 * Measures:
 *   EA — unit count (manufactured units: windows, doors, skylights)
 *   SF — area in square feet (glass area, face area)
 *   LF — linear feet (frame perimeter for storefront/curtain wall)
 *
 * Waste factors apply to field-cut materials (storefront glass/framing), never
 * to manufactured unit counts.
 */
import type { TakeoffItemRow } from "./data";
import type { ShortcutCategory } from "./orchestrator";
import { areaSqFt } from "./dimensions";

export type QuantityUnit = "EA" | "SF" | "LF";

export interface QuantityRow {
  label: string;
  value: number;
  unit: QuantityUnit;
  /** Value including the waste factor, when one applies. */
  orderValue: number;
  note?: string;
}

export interface CategoryQuantities {
  category: ShortcutCategory;
  /** Sum of quantities × typical multipliers (EA). */
  units: number;
  /** Units with no recorded size — excluded from area/length totals. */
  unsizedUnits: number;
  /** True when any item uses a typical multiplier > 1. */
  hasTypical: boolean;
  rows: QuantityRow[];
}

/** Waste factor per category, applied to area/length — never to unit counts. */
const WASTE_PCT: Record<ShortcutCategory, number> = {
  windows: 0,
  doors: 0,
  sliding_doors: 0,
  // Field-glazed storefront: 5% glass, 7% framing — use 7% on perimeter.
  storefront_curtainwall: 0.05,
  louvers: 0,
  skylights: 0,
};

const FRAME_WASTE_PCT: Record<ShortcutCategory, number> = {
  windows: 0,
  doors: 0,
  sliding_doors: 0,
  storefront_curtainwall: 0.07,
  louvers: 0,
  skylights: 0,
};

/** Which area/length measures each category reports. */
const CATEGORY_MEASURES: Record<
  ShortcutCategory,
  { area: string | null; perimeter: string | null }
> = {
  windows: { area: "Glass area", perimeter: null },
  doors: { area: null, perimeter: null },
  sliding_doors: { area: "Glass area", perimeter: null },
  storefront_curtainwall: { area: "Glass area", perimeter: "Frame perimeter" },
  louvers: { area: "Face area", perimeter: null },
  skylights: { area: "Skylight area", perimeter: null },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Perimeter of one unit in linear feet. */
export function perimeterLf(widthIn: number, heightIn: number): number {
  return round2((2 * (widthIn + heightIn)) / 12);
}

function validSize(item: TakeoffItemRow): { w: number; h: number } | null {
  const w = Number(item.width_in);
  const h = Number(item.height_in);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

const qtyOf = (i: TakeoffItemRow) =>
  (Number(i.quantity ?? 0) || 0) * (Number(i.multiplier ?? 1) || 1);

/**
 * Computes quantities for one category's items. `categorize` assigns each
 * item to a category — pass categorizeItem from the orchestrator.
 */
export function categoryQuantities(
  items: TakeoffItemRow[],
  category: ShortcutCategory,
  categorize: (item: TakeoffItemRow) => ShortcutCategory | null,
): CategoryQuantities {
  const scoped = items.filter((i) => categorize(i) === category);
  const measures = CATEGORY_MEASURES[category];
  const waste = WASTE_PCT[category];
  const frameWaste = FRAME_WASTE_PCT[category];

  let units = 0;
  let unsizedUnits = 0;
  let totalAreaSf = 0;
  let totalPerimeterLf = 0;
  let hasTypical = false;

  for (const item of scoped) {
    const q = qtyOf(item);
    units += q;
    if ((Number(item.multiplier ?? 1) || 1) > 1) hasTypical = true;
    const size = validSize(item);
    if (!size) {
      unsizedUnits += q;
      continue;
    }
    if (measures.area) totalAreaSf += areaSqFt(size.w, size.h) * q;
    if (measures.perimeter) totalPerimeterLf += perimeterLf(size.w, size.h) * q;
  }

  totalAreaSf = round2(totalAreaSf);
  totalPerimeterLf = round2(totalPerimeterLf);

  const rows: QuantityRow[] = [{ label: "Units", value: units, unit: "EA", orderValue: units }];
  if (measures.area) {
    rows.push({
      label: measures.area,
      value: totalAreaSf,
      unit: "SF",
      orderValue: round2(totalAreaSf * (1 + waste)),
      note: waste > 0 ? `includes ${Math.round(waste * 100)}% waste` : undefined,
    });
  }
  if (measures.perimeter) {
    rows.push({
      label: measures.perimeter,
      value: totalPerimeterLf,
      unit: "LF",
      orderValue: round2(totalPerimeterLf * (1 + frameWaste)),
      note: frameWaste > 0 ? `includes ${Math.round(frameWaste * 100)}% waste` : undefined,
    });
  }

  return { category, units, unsizedUnits: Math.round(unsizedUnits), hasTypical, rows };
}

/** Formats a quantity for display: 1,234.56 SF / 48 EA. */
export function formatQty(value: number, unit: QuantityUnit): string {
  const formatted =
    unit === "EA"
      ? Math.round(value).toLocaleString("en-US")
      : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}
