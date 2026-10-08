/**
 * Takeoff Orchestrator — the deterministic pipeline behind the takeoff shortcut
 * cards. When Washington clicks "Windows" (or asks about windows), the
 * orchestrator runs the specialist agents in order and returns one structured
 * result per category:
 *
 *   1. Schedule Agent   → schedule rows for the category (when imported)
 *   2. Takeoff Agent    → counts + groupings per type, per floor  (this module)
 *   3. Window/Door specialists → type enrichment (operation, size)
 *   4. Safety & Egress Agent    → child-lock / WOCD flags per floor, using the
 *      project state's code (from geocoding) — never a hardcoded Florida rule
 *   5. Combination & Mull Agent → mulled-assembly flags (hook)
 *   6. YKK Product Agent        → product mapping (hook)
 *   7. Quote Readiness Agent    → blockers before quoting (hook)
 *
 * Stages 2–4 run locally on verified takeoff_items. Stages 5–7 are hook points
 * where the AI agents enrich the structured result; the counts never depend
 * on a model guessing.
 */
import type { TakeoffItemRow } from "./data";
import { typeLabel } from "@/lib/takeoff-types";
import { formatSize, validateSize } from "./dimensions";
import {
  getJurisdictionRequirements,
  type JurisdictionInput,
  type JurisdictionRequirements,
} from "@/lib/jurisdiction/requirements";

export type ShortcutCategory =
  "windows" | "doors" | "sliding_doors" | "storefront_curtainwall" | "louvers" | "skylights";

export const SHORTCUT_CATEGORIES: { key: ShortcutCategory; label: string; plural: string }[] = [
  { key: "windows", label: "Windows", plural: "windows" },
  { key: "doors", label: "Doors", plural: "doors" },
  { key: "sliding_doors", label: "Sliding Doors", plural: "sliding doors" },
  {
    key: "storefront_curtainwall",
    label: "Storefront / Curtain Wall",
    plural: "storefront / curtain wall units",
  },
  { key: "louvers", label: "Louvers & Vents", plural: "louvers & vents" },
  { key: "skylights", label: "Skylights", plural: "skylights" },
];

/** Washington's working proxy: windows above the 2nd floor need a child lock (WOCD). */
export const WOCD_FLOOR_THRESHOLD = 2;

/**
 * Safety & Egress stage — state-driven WOCD (window opening control device)
 * rules. The project state comes from geocoding; the rule applied is that
 * state's residential code, not a hardcoded Florida rule.
 *
 * The model provision is IRC R312.2: a WOCD complying with ASTM F2090 is
 * required on operable windows where the lowest part of the clear opening is
 * less than 24 in. above the finished floor AND the opening is more than
 * 72 in. above the exterior grade below. Most state residential codes adopt
 * this section (sometimes renumbered) — always verify local amendments.
 */
export type WocdRule = {
  /** Two-letter state code from geocoding, or null when unknown. */
  state: string | null;
  /** Human code name, e.g. "Florida Building Code, 8th Edition (2023)". */
  codeName: string;
  /** Section citation within that code. */
  citation: string;
  /** Plain-language criteria. */
  summary: string;
  /** "state-table" = we know this state's code; "irc-model" = model-rule fallback. */
  source: "state-table" | "irc-model";
};

const IRC_WOCD_SUMMARY =
  "WOCD (ASTM F2090) required on operable windows where the lowest part of the clear opening is < 24 in. above the finished floor and the opening is > 72 in. above the exterior grade below. Verify local AHJ amendments.";

/** State residential codes AWM commonly works under. Others fall back to the IRC model. */
const STATE_CODES: Record<string, { codeName: string; citation: string }> = {
  FL: { codeName: "Florida Building Code, 8th Edition (2023)", citation: "R312.2" },
  GA: {
    codeName: "Georgia State Minimum Standard Residential Code (IRC-based)",
    citation: "R312.2",
  },
  AL: { codeName: "Alabama Residential Code (IRC-based)", citation: "R312.2" },
  SC: { codeName: "South Carolina Residential Code (IRC-based)", citation: "R312.2" },
  NC: { codeName: "North Carolina Residential Code", citation: "R312.2" },
  LA: { codeName: "Louisiana State Uniform Construction Code (IRC-based)", citation: "R312.2" },
  MS: { codeName: "Mississippi — locally adopted IRC", citation: "R312.2" },
  TN: { codeName: "Tennessee — locally adopted IRC", citation: "R312.2" },
  TX: { codeName: "Texas — locally adopted IRC (no statewide code)", citation: "R312.2" },
};

export function getWocdRule(state: string | null | undefined): WocdRule {
  const st = (state ?? "").trim().toUpperCase() || null;
  const known = st ? STATE_CODES[st] : undefined;
  if (known) {
    return {
      state: st,
      codeName: known.codeName,
      citation: known.citation,
      summary: IRC_WOCD_SUMMARY,
      source: "state-table",
    };
  }
  return {
    state: st,
    codeName: st
      ? `${st} residential code (IRC R312.2 model — confirm AHJ adoption)`
      : "IRC R312.2 model (project state unknown — confirm AHJ)",
    citation: "R312.2",
    summary: IRC_WOCD_SUMMARY,
    source: "irc-model",
  };
}

export type ChildLockAssessment = {
  required: boolean;
  /**
   * "floor-proxy": Washington's above-2nd-floor rule, used because sill and
   * grade heights are not recorded on takeoff items. "code-exact" is
   * reserved for when those measurements exist.
   */
  basis: "floor-proxy" | "code-exact";
  rule: WocdRule;
};

/** Safety & Egress stage: does this opening need a child lock (WOCD)? */
export function assessChildLock(
  item: TakeoffItemRow,
  category: ShortcutCategory,
  rule: WocdRule,
): ChildLockAssessment {
  if (category !== "windows" && category !== "sliding_doors") {
    return { required: false, basis: "floor-proxy", rule };
  }
  const n = floorNumber(item.floor);
  return { required: n !== null && n > WOCD_FLOOR_THRESHOLD, basis: "floor-proxy", rule };
}

/** Boolean convenience wrapper used by the counting stages. */
export function needsChildLock(
  item: TakeoffItemRow,
  category: ShortcutCategory,
  rule: WocdRule,
): boolean {
  return assessChildLock(item, category, rule).required;
}

type Matcher = { key: ShortcutCategory; test: RegExp };

/** Ordered — first match wins, so specific types come before general ones. */
const MATCHERS: Matcher[] = [
  {
    key: "sliding_doors",
    test: /sliding\s*(glass\s*)?door|sgd\b|patio\s*door|multi[-\s]*slide|lift\s*and\s*slide/i,
  },
  { key: "storefront_curtainwall", test: /storefront|curtain\s*wall|window\s*wall|cw\b|sf\b/i },
  { key: "louvers", test: /louver|vent|grille/i },
  { key: "skylights", test: /skylight|skylite|roof\s*window/i },
  {
    key: "windows",
    test: /\bwin\b|window|single[-\s]*hung|double[-\s]*hung|casement|awning|picture|transom|hopper|fixed\s*glass|geometric|\bsh\b|\bdh\b/i,
  },
  { key: "doors", test: /\bdoor\b|french|entrance|hollow\s*metal|wood\s*door|\bhm\b/i },
];

function haystack(item: TakeoffItemRow): string {
  return [item.type_name, item.product_type, item.category, item.mark].filter(Boolean).join(" ");
}

/** Assigns one verified takeoff item to exactly one shortcut category. */
export function categorizeItem(item: TakeoffItemRow): ShortcutCategory | null {
  const hay = haystack(item);
  for (const m of MATCHERS) {
    if (m.test.test(hay)) return m.key;
  }
  // Fall back to the marker category recorded on the item.
  const cat = (item.category ?? "").toLowerCase();
  if (cat === "window") return "windows";
  if (cat === "door") return "doors";
  if (cat === "glazing") return "storefront_curtainwall";
  return null;
}

/** Extracts a floor number from "1st", "Level 2", "Second Floor", "3", ... */
export function floorNumber(floor: string | null | undefined): number | null {
  if (!floor) return null;
  const digit = floor.match(/(\d+)/);
  if (digit) return parseInt(digit[1], 10);
  const words: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
  };
  const w = floor
    .toLowerCase()
    .match(/first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth/);
  return w ? words[w[0]] : null;
}

export type TypeBreakdown = {
  key: string;
  label: string;
  openings: number;
  units: number;
  sizes: string[];
  floors: string[];
  wocdUnits: number;
  sampleMark: string | null;
  /** Deterministic measurement flags — never silently corrected. */
  sizeWarnings: string[];
  /** Impact glazing required for this type at this jurisdiction. */
  impactRequired: boolean;
  impactNote: string | null;
};

export type FloorBreakdown = {
  floor: string | null;
  label: string;
  floorNo: number | null;
  units: number;
  wocdUnits: number;
};

export type CategoryTakeoff = {
  category: ShortcutCategory;
  label: string;
  /** Sum of quantities. */
  totalUnits: number;
  /** Number of takeoff rows. */
  totalOpenings: number;
  types: TypeBreakdown[];
  floors: FloorBreakdown[];
  wocdUnits: number;
  wocdRule: WocdRule;
  /** Jurisdiction intelligence for the project location (whole-project rules). */
  jurisdiction: JurisdictionRequirements;
  /** Product implications for this category at this jurisdiction. */
  productNotes: string[];
  /** Units whose floor was never recorded — need estimator attention. */
  unassignedFloorUnits: number;
  /** Units with no recorded size. */
  unsizedUnits: number;
};

function sizeKey(item: TakeoffItemRow): string | null {
  if (item.width_in == null || item.height_in == null) return null;
  return formatSize(item.width_in, item.height_in);
}

/** Canonical parse of one item's stored inches, with validation. */
function validatedSize(
  item: TakeoffItemRow,
  category: ShortcutCategory,
): { display: string | null; warnings: string[] } {
  if (item.width_in == null || item.height_in == null) return { display: null, warnings: [] };
  const w = Number(item.width_in);
  const h = Number(item.height_in);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return {
      display: null,
      warnings: [
        `Mark ${item.mark ?? "?"}: stored size ${item.width_in} × ${item.height_in} is not a positive number — verify.`,
      ],
    };
  }
  const validation = validateSize(w, h, category);
  return { display: formatSize(w, h), warnings: validation.warnings };
}

function typeKeyOf(item: TakeoffItemRow): string {
  return item.type_name ?? item.product_type ?? item.category ?? "unclassified";
}

/**
 * Stage 2–4 of the pipeline: counts, floor grouping, safety flags.
 * projectState is the two-letter state from geocoding — it selects the
 * WOCD rule; pass null when the project was never geocoded.
 */
export function runCategoryTakeoff(
  items: TakeoffItemRow[],
  category: ShortcutCategory,
  jurisdictionInput: JurisdictionInput | null = null,
): CategoryTakeoff {
  const meta = SHORTCUT_CATEGORIES.find((c) => c.key === category)!;
  const rule = getWocdRule(jurisdictionInput?.state ?? null);
  const jurisdiction = getJurisdictionRequirements({
    state: jurisdictionInput?.state ?? null,
    county: jurisdictionInput?.county ?? null,
    city: jurisdictionInput?.city ?? null,
    zip: jurisdictionInput?.zip ?? null,
    lat: jurisdictionInput?.lat ?? null,
    lon: jurisdictionInput?.lon ?? null,
  });
  const scoped = items.filter((i) => categorizeItem(i) === category);

  const qty = (i: TakeoffItemRow) => Number(i.quantity ?? 0) || 0;
  const totalUnits = scoped.reduce((s, i) => s + qty(i), 0);
  const wocd = (i: TakeoffItemRow) => needsChildLock(i, category, rule);

  // --- Types ---
  const typeMap = new Map<string, { items: TakeoffItemRow[] }>();
  for (const item of scoped) {
    const k = typeKeyOf(item);
    const bucket = typeMap.get(k) ?? { items: [] };
    bucket.items.push(item);
    typeMap.set(k, bucket);
  }
  const types: TypeBreakdown[] = [...typeMap.entries()]
    .map(([key, b]) => {
      const sizes = [...new Set(b.items.map(sizeKey).filter((s): s is string => Boolean(s)))];
      const floors = [...new Set(b.items.map((i) => (i.floor ?? "").trim()).filter(Boolean))];
      const sizeWarnings = [
        ...new Set(b.items.flatMap((i) => validatedSize(i, category).warnings)),
      ];
      const impactNotes = jurisdiction.productImplications[category] ?? [];
      return {
        key,
        label: typeLabel(key),
        openings: b.items.length,
        units: b.items.reduce((s, i) => s + qty(i), 0),
        sizes: sizes.slice(0, 6),
        floors: floors.slice(0, 8),
        wocdUnits: b.items.filter(wocd).reduce((s, i) => s + qty(i), 0),
        sampleMark: b.items.find((i) => i.mark)?.mark ?? null,
        sizeWarnings: sizeWarnings.slice(0, 4),
        impactRequired: jurisdiction.impactRequired,
        impactNote: impactNotes[0] ?? null,
      };
    })
    .sort((a, b) => b.units - a.units);

  // --- Floors ---
  const floorMap = new Map<string, TakeoffItemRow[]>();
  for (const item of scoped) {
    const k = (item.floor ?? "").trim() || "__unrecorded__";
    const bucket = floorMap.get(k) ?? [];
    bucket.push(item);
    floorMap.set(k, bucket);
  }
  const floors: FloorBreakdown[] = [...floorMap.entries()]
    .map(([floor, rows]) => ({
      floor: floor === "__unrecorded__" ? null : floor,
      label: floor === "__unrecorded__" ? "Floor not recorded" : floor,
      floorNo: floorNumber(floor === "__unrecorded__" ? null : floor),
      units: rows.reduce((s, i) => s + qty(i), 0),
      wocdUnits: rows.filter(wocd).reduce((s, i) => s + qty(i), 0),
    }))
    .sort((a, b) => (a.floorNo ?? 999) - (b.floorNo ?? 999));

  return {
    category,
    label: meta.label,
    totalUnits,
    totalOpenings: scoped.length,
    types,
    floors,
    wocdUnits: scoped.filter(wocd).reduce((s, i) => s + qty(i), 0),
    wocdRule: rule,
    jurisdiction,
    productNotes: jurisdiction.productImplications[category] ?? [],
    unassignedFloorUnits: scoped
      .filter((i) => !(i.floor ?? "").trim())
      .reduce((s, i) => s + qty(i), 0),
    unsizedUnits: scoped.filter((i) => sizeKey(i) === null).reduce((s, i) => s + qty(i), 0),
  };
}

/** Runs the pipeline for all six shortcut categories at once (for the cards). */
export function runFullTakeoff(
  items: TakeoffItemRow[],
  jurisdictionInput: JurisdictionInput | null = null,
): Record<ShortcutCategory, CategoryTakeoff> {
  const out = {} as Record<ShortcutCategory, CategoryTakeoff>;
  for (const c of SHORTCUT_CATEGORIES) {
    out[c.key] = runCategoryTakeoff(items, c.key, jurisdictionInput);
  }
  return out;
}

/**
 * Quote-readiness blockers for one category (Quote Readiness Agent stage).
 * Deterministic checks — the AI agent adds judgment on top.
 */
export function quoteBlockers(takeoff: CategoryTakeoff): string[] {
  const blockers: string[] = [];
  if (takeoff.totalUnits === 0)
    blockers.push(`No ${takeoff.label.toLowerCase()} found in the verified takeoff yet.`);
  if (takeoff.unassignedFloorUnits > 0)
    blockers.push(
      `${takeoff.unassignedFloorUnits} unit(s) have no recorded floor — floor counts may be incomplete.`,
    );
  if (takeoff.unsizedUnits > 0)
    blockers.push(
      `${takeoff.unsizedUnits} unit(s) have no recorded size — quoting needs dimensions.`,
    );
  if (takeoff.types.some((t) => t.label === "Unclassified"))
    blockers.push(`Some items are unclassified — review type assignments before quoting.`);
  return blockers;
}
