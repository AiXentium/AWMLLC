/**
 * Groups scoped takeoff openings into the estimator reporting hierarchy:
 *
 *   project > building > floor > area (unit / room / elevation) > type > opening
 *
 * The shape adapts to whatever the plan set actually recorded: a single-family
 * house with no building or unit values collapses to one implicit group, while
 * a multi-building multifamily set expands to the full depth. Nothing is
 * invented — a level with no recorded value is labelled as unrecorded rather
 * than given a fabricated name.
 */
import type { TakeoffItemRow } from "./data";
import { typeLabel } from "@/lib/takeoff-types";

export const UNRECORDED = "__unrecorded__";

export type HierarchyNode = {
  key: string;
  /** Display label, or null when the source value was never recorded. */
  label: string | null;
  level: "building" | "floor" | "area" | "type";
  openings: number;
  units: number;
  children: HierarchyNode[];
  /** Only present on leaf ("type") nodes. */
  items: TakeoffItemRow[];
};

export type HierarchyShape = {
  hasBuildings: boolean;
  hasFloors: boolean;
  hasAreas: boolean;
  /** Human description of the report shape, derived from recorded data only. */
  description: string;
};

function value(v: string | null | undefined) {
  const trimmed = (v ?? "").trim();
  return trimmed ? trimmed : null;
}

/** Area is the most specific location recorded on the opening. */
export function areaOf(item: TakeoffItemRow) {
  return value(item.unit) ?? value(item.room) ?? value(item.elevation);
}

export function typeOf(item: TakeoffItemRow) {
  return value(item.type_name) ?? value(item.product_type) ?? value(item.category);
}

export function qtyOf(item: TakeoffItemRow) {
  return Number(item.quantity ?? 0) || 0;
}

function group(items: TakeoffItemRow[], pick: (i: TakeoffItemRow) => string | null) {
  const map = new Map<string, { label: string | null; items: TakeoffItemRow[] }>();
  for (const item of items) {
    const label = pick(item);
    const key = label ?? UNRECORDED;
    const bucket = map.get(key) ?? { label, items: [] };
    bucket.items.push(item);
    map.set(key, bucket);
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === UNRECORDED) return 1;
    if (b === UNRECORDED) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function node(
  keyPrefix: string,
  key: string,
  label: string | null,
  level: HierarchyNode["level"],
  items: TakeoffItemRow[],
  children: HierarchyNode[],
): HierarchyNode {
  return {
    key: `${keyPrefix}/${key}`,
    label,
    level,
    openings: items.length,
    units: items.reduce((sum, i) => sum + qtyOf(i), 0),
    children,
    items: level === "type" ? items : [],
  };
}

/**
 * Builds the nested report. Levels that carry no recorded value anywhere in the
 * scope are skipped entirely so a house report does not show empty
 * "building" and "unit" wrappers.
 */
export function buildHierarchy(items: TakeoffItemRow[]): {
  nodes: HierarchyNode[];
  shape: HierarchyShape;
  openings: number;
  units: number;
} {
  const hasBuildings = items.some((i) => value(i.building));
  const hasFloors = items.some((i) => value(i.floor));
  const hasAreas = items.some((i) => areaOf(i));

  const buildTypes = (prefix: string, rows: TakeoffItemRow[]) =>
    group(rows, (i) => typeOf(i)).map(([key, g]) =>
      node(prefix, key, g.label ? typeLabel(g.label) : null, "type", g.items, []),
    );

  const buildAreas = (prefix: string, rows: TakeoffItemRow[]): HierarchyNode[] => {
    if (!hasAreas) return buildTypes(prefix, rows);
    return group(rows, areaOf).map(([key, g]) =>
      node(prefix, key, g.label, "area", g.items, buildTypes(`${prefix}/${key}`, g.items)),
    );
  };

  const buildFloors = (prefix: string, rows: TakeoffItemRow[]): HierarchyNode[] => {
    if (!hasFloors) return buildAreas(prefix, rows);
    return group(rows, (i) => value(i.floor)).map(([key, g]) =>
      node(prefix, key, g.label, "floor", g.items, buildAreas(`${prefix}/${key}`, g.items)),
    );
  };

  const nodes = hasBuildings
    ? group(items, (i) => value(i.building)).map(([key, g]) =>
        node("b", key, g.label, "building", g.items, buildFloors(`b/${key}`, g.items)),
      )
    : buildFloors("r", items);

  const levels = [
    hasBuildings ? "building" : null,
    hasFloors ? "floor" : null,
    hasAreas ? "area" : null,
    "type",
  ].filter(Boolean) as string[];

  return {
    nodes,
    shape: {
      hasBuildings,
      hasFloors,
      hasAreas,
      description: `Grouped by ${levels.join(" › ")} from values recorded on this plan set.`,
    },
    openings: items.length,
    units: items.reduce((sum, i) => sum + qtyOf(i), 0),
  };
}

export const LEVEL_LABEL: Record<HierarchyNode["level"], string> = {
  building: "Building",
  floor: "Floor",
  area: "Area",
  type: "Type",
};

export function unrecordedLabel(level: HierarchyNode["level"]) {
  return `${LEVEL_LABEL[level]} not recorded`;
}

/** Formats a width × height in inches, or null when either dimension is missing. */
export function sizeLabel(item: TakeoffItemRow) {
  if (item.width_in === null || item.height_in === null) return null;
  return `${item.width_in}" × ${item.height_in}"`;
}
