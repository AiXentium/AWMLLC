/**
 * Shared vocabulary for the automatic plan pre-analysis that runs straight
 * after project-information extraction. Client and server both import this;
 * it must stay free of browser and server-only APIs.
 */

export type SheetCategory =
  | "window_schedule"
  | "door_schedule"
  | "glazing_schedule"
  | "storefront_schedule"
  | "curtain_wall_schedule"
  | "roof_plan"
  | "floor_plan"
  | "elevation"
  | "reflected_ceiling_plan"
  | "section_detail"
  | "general_notes"
  | "revision"
  | "site_plan"
  | "cover_index"
  | "other";

export const SHEET_CATEGORIES: SheetCategory[] = [
  "window_schedule",
  "door_schedule",
  "glazing_schedule",
  "storefront_schedule",
  "curtain_wall_schedule",
  "roof_plan",
  "floor_plan",
  "elevation",
  "reflected_ceiling_plan",
  "section_detail",
  "general_notes",
  "revision",
  "site_plan",
  "cover_index",
  "other",
];

export const CATEGORY_LABELS: Record<SheetCategory, string> = {
  window_schedule: "Window schedule",
  door_schedule: "Door schedule",
  glazing_schedule: "Glazing schedule",
  storefront_schedule: "Storefront schedule",
  curtain_wall_schedule: "Curtain wall schedule",
  roof_plan: "Roof plan",
  floor_plan: "Floor plan",
  elevation: "Elevation",
  reflected_ceiling_plan: "Reflected ceiling plan",
  section_detail: "Section / detail",
  general_notes: "General notes",
  revision: "Revision / bulletin",
  site_plan: "Site plan",
  cover_index: "Cover / sheet index",
  other: "Not takeoff relevant",
};

/**
 * How much a sheet matters to a window/door takeoff. Anything at or above
 * WORKING_SET_THRESHOLD is auto-selected into the initial working set.
 */
export const CATEGORY_RELEVANCE: Record<SheetCategory, number> = {
  window_schedule: 100,
  door_schedule: 100,
  glazing_schedule: 95,
  storefront_schedule: 95,
  curtain_wall_schedule: 95,
  roof_plan: 85,
  elevation: 80,
  floor_plan: 75,
  reflected_ceiling_plan: 55,
  section_detail: 35,
  general_notes: 30,
  revision: 30,
  site_plan: 20,
  cover_index: 10,
  other: 0,
};

export const WORKING_SET_THRESHOLD = 55;

export const SCHEDULE_CATEGORIES: SheetCategory[] = [
  "window_schedule",
  "door_schedule",
  "glazing_schedule",
  "storefront_schedule",
  "curtain_wall_schedule",
];

// ---------------------------------------------------------------------------
// Trade focus — scan only the sheets a trade needs, saving AI time and tokens
// ---------------------------------------------------------------------------

export type TradeFocus = "all" | "windows" | "doors" | "storefront_glazing" | "roofing";

export const TRADE_FOCI: Record<
  TradeFocus,
  { label: string; blurb: string; categories: SheetCategory[] }
> = {
  all: {
    label: "All trades",
    blurb: "Scan every sheet for a full takeoff",
    categories: [...SHEET_CATEGORIES],
  },
  windows: {
    label: "Windows",
    blurb: "Window & glazing schedules, elevations, floor plans",
    categories: ["window_schedule", "glazing_schedule", "elevation", "floor_plan"],
  },
  doors: {
    label: "Doors",
    blurb: "Door schedules, floor plans, elevations",
    categories: ["door_schedule", "floor_plan", "elevation"],
  },
  storefront_glazing: {
    label: "Storefront / Curtain wall",
    blurb: "Storefront & curtain wall schedules, elevations",
    categories: [
      "storefront_schedule",
      "curtain_wall_schedule",
      "glazing_schedule",
      "elevation",
      "floor_plan",
    ],
  },
  roofing: {
    label: "Roofing",
    blurb: "Roof plans, roof details and roofing notes",
    categories: ["roof_plan", "section_detail", "general_notes"],
  },
};

export const TRADE_FOCUS_ORDER: TradeFocus[] = [
  "all",
  "windows",
  "doors",
  "storefront_glazing",
  "roofing",
];

export function isTradeFocus(value: unknown): value is TradeFocus {
  return typeof value === "string" && (Object.keys(TRADE_FOCI) as string[]).includes(value);
}

export function resolveTradeFocus(value: unknown): TradeFocus {
  return isTradeFocus(value) ? value : "all";
}

export const CALLOUT_CATEGORIES: SheetCategory[] = [
  "floor_plan",
  "elevation",
  "reflected_ceiling_plan",
];

/**
 * Categories a complete permit-ready plan set is normally expected to contain.
 * Anything not detected is reported in the coverage summary with an
 * explanation rather than being silently dropped.
 */
export const COVERAGE_EXPECTATIONS: {
  category: SheetCategory;
  required: boolean;
  missingExplanation: string;
}[] = [
  {
    category: "cover_index",
    required: false,
    missingExplanation:
      "No cover or sheet index was detected — sheet numbering may have to be confirmed manually.",
  },
  {
    category: "site_plan",
    required: false,
    missingExplanation:
      "No site plan was detected — building orientation and exposure must be confirmed from other sheets.",
  },
  {
    category: "floor_plan",
    required: true,
    missingExplanation:
      "No floor plan was detected, so schedule marks cannot be correlated with plan callouts.",
  },
  {
    category: "elevation",
    required: true,
    missingExplanation:
      "No elevation was detected, so opening sizes and head heights cannot be cross-checked.",
  },
  {
    category: "window_schedule",
    required: true,
    missingExplanation:
      "No window schedule was detected — window quantities rely on plan callouts only.",
  },
  {
    category: "door_schedule",
    required: true,
    missingExplanation:
      "No door schedule was detected — door quantities rely on plan callouts only.",
  },
  {
    category: "storefront_schedule",
    required: false,
    missingExplanation:
      "No storefront schedule was detected — this is normal on residential sets with no commercial entrances.",
  },
  {
    category: "curtain_wall_schedule",
    required: false,
    missingExplanation:
      "No curtain wall schedule was detected — this is normal unless the project has a glazed façade system.",
  },
  {
    category: "section_detail",
    required: false,
    missingExplanation:
      "No sections or details were detected — jamb, head and sill conditions will need manual review.",
  },
  {
    category: "general_notes",
    required: false,
    missingExplanation:
      "No general notes sheet was detected — glazing, impact and energy requirements may be printed elsewhere.",
  },
  {
    category: "revision",
    required: false,
    missingExplanation:
      "No revision or bulletin sheet was detected — this set appears to be an original issue.",
  },
];

// ---------------------------------------------------------------------------
// Preliminary quantity buckets
// ---------------------------------------------------------------------------

export type QuantityBucket =
  | "windows"
  | "exterior_doors"
  | "interior_doors"
  | "sliding_doors"
  | "storefront"
  | "curtain_wall"
  | "specialty";

export const QUANTITY_BUCKETS: { bucket: QuantityBucket; label: string }[] = [
  { bucket: "windows", label: "Windows" },
  { bucket: "exterior_doors", label: "Exterior doors" },
  { bucket: "interior_doors", label: "Interior doors" },
  { bucket: "sliding_doors", label: "Sliding doors" },
  { bucket: "storefront", label: "Storefront systems" },
  { bucket: "curtain_wall", label: "Curtain wall" },
  { bucket: "specialty", label: "Specialty openings" },
];

export function bucketLabel(bucket: string) {
  return QUANTITY_BUCKETS.find((b) => b.bucket === bucket)?.label ?? bucket;
}

/**
 * Buckets one schedule row from the words printed on the plan. Deterministic on
 * purpose: the estimator can trace every classification back to the text.
 */
export function bucketForRow(row: {
  scheduleType: string;
  mark: string | null;
  typeLabel: string | null;
  operation: string | null;
  material: string | null;
  notes: string | null;
}): QuantityBucket {
  const text = [row.typeLabel, row.operation, row.material, row.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const mark = (row.mark ?? "").toUpperCase();

  if (/curtain\s*wall|curtainwall/.test(text) || /^CW/.test(mark)) return "curtain_wall";
  if (/storefront|entrance\s*system|window\s*wall/.test(text) || /^(SF|WW)/.test(mark))
    return "storefront";
  if (/sliding|slider|sgd|patio\s*door|multi[-\s]?slide|bi[-\s]?fold/.test(text))
    return "sliding_doors";
  if (
    /skylight|louver|transom\s*only|arch(ed)?\s*top|specialty|custom\s*shape|round\s*top/.test(text)
  ) {
    return "specialty";
  }

  if (row.scheduleType === "door") {
    if (/interior|int\.|closet|bedroom|bath|pocket|passage/.test(text)) return "interior_doors";
    return "exterior_doors";
  }
  if (row.scheduleType === "glazing") return "storefront";
  return "windows";
}

export function isSheetCategory(value: unknown): value is SheetCategory {
  return typeof value === "string" && (SHEET_CATEGORIES as string[]).includes(value);
}

export function categoryLabel(value: string | null | undefined) {
  return isSheetCategory(value) ? CATEGORY_LABELS[value] : "Not takeoff relevant";
}

export const AUTO_WORKING_SET_NAME = "AI Pre-Analysis — Window & Door Takeoff";

/**
 * Split-plan grouping. Large PDFs are auto-split into "Set.part1.pdf",
 * "Set.part2.pdf", … — this recovers the original set name so all parts
 * are treated as one project instead of N separate working sets.
 */
export function splitGroupOf(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const m = fileName.trim().match(/^(.+)\.part\d+\.pdf$/i);
  return m ? m[1] : null;
}

/** Working-set name for auto-created sets — group-aware for split plans, trade-aware for focused scans. */
export function autoWorkingSetName(
  docName: string | null | undefined,
  tradeLabel?: string,
): string {
  const group = splitGroupOf(docName);
  const suffix =
    tradeLabel && tradeLabel !== "All trades" ? `${tradeLabel} Takeoff` : "Window & Door Takeoff";
  return group ? `${group} — ${suffix}` : `AI Pre-Analysis — ${suffix}`;
}

/** True when the working set was auto-created by pre-analysis. */
export function isAutoWorkingSet(
  name: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (name === AUTO_WORKING_SET_NAME) return true;
  return Boolean(description?.startsWith("Auto-selected by AI pre-analysis"));
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export type AnalysisStage =
  | "queued"
  | "reading_sheets"
  | "classifying"
  | "building_working_set"
  | "vision_counting"
  | "reading_schedules"
  | "correlating"
  | "needs_approval"
  | "approved"
  | "failed";

export const ANALYSIS_STAGE_LABELS: Record<AnalysisStage, string> = {
  queued: "Waiting",
  reading_sheets: "Reading sheets",
  classifying: "Identifying schedules, plans and elevations",
  building_working_set: "Building the working set",
  vision_counting: "Visually counting openings",
  reading_schedules: "Reading window and door schedules",
  correlating: "Correlating schedules with plan callouts",
  needs_approval: "Ready for your review",
  approved: "Approved",
  failed: "Failed",
};

export const ANALYSIS_BUSY_STAGES: AnalysisStage[] = [
  "queued",
  "reading_sheets",
  "classifying",
  "building_working_set",
  "vision_counting",
  "reading_schedules",
  "correlating",
];

export function isAnalysisBusy(status: string | null | undefined) {
  return ANALYSIS_BUSY_STAGES.includes(status as AnalysisStage);
}

// ---------------------------------------------------------------------------
// Keyword pre-scoring — cheap first pass so AI spend goes to real candidates
// ---------------------------------------------------------------------------

const KEYWORD_RULES: { re: RegExp; category: SheetCategory; weight: number }[] = [
  {
    re: /\bwindow\s+schedule\b|\bschedule\s+of\s+windows\b/i,
    category: "window_schedule",
    weight: 100,
  },
  { re: /\bdoor\s+schedule\b|\bschedule\s+of\s+doors\b/i, category: "door_schedule", weight: 100 },
  { re: /\bcurtain\s*wall\s+schedule\b/i, category: "curtain_wall_schedule", weight: 92 },
  { re: /\b(storefront|window\s*wall)\s+schedule\b/i, category: "storefront_schedule", weight: 92 },
  { re: /\b(glazing|glass)\s+schedule\b/i, category: "glazing_schedule", weight: 90 },
  {
    re: /\bgeneral\s+notes\b|\bcode\s+(summary|analysis)\b|\bspecifications?\b/i,
    category: "general_notes",
    weight: 45,
  },
  {
    re: /\brevision\s+(sheet|log|schedule)\b|\bbulletin\s*#?\d*\b|\baddendum\b/i,
    category: "revision",
    weight: 45,
  },
  {
    re: /\broof\s+plan\b|\broofing\s+plan\b|\broof\s+framing\s+plan\b/i,
    category: "roof_plan",
    weight: 85,
  },
  { re: /\bwindow\s+(&|and)\s+door\s+schedule\b/i, category: "window_schedule", weight: 100 },
  { re: /\breflected\s+ceiling\s+plan\b|\brcp\b/i, category: "reflected_ceiling_plan", weight: 70 },
  {
    re: /\b(exterior|building|front|rear|side|north|south|east|west)\s+elevations?\b/i,
    category: "elevation",
    weight: 80,
  },
  { re: /\belevations?\b/i, category: "elevation", weight: 55 },
  {
    re: /\b(first|second|third|ground|upper|lower|typical|overall)\s+floor\s+plan\b/i,
    category: "floor_plan",
    weight: 85,
  },
  { re: /\bfloor\s+plans?\b|\bkey\s+plan\b|\bunit\s+plan\b/i, category: "floor_plan", weight: 70 },
  {
    re: /\bwall\s+section\b|\bdetails?\b|\bjamb\b|\bhead\s*\/?\s*sill\b/i,
    category: "section_detail",
    weight: 40,
  },
  { re: /\bsite\s+plan\b|\bcivil\b/i, category: "site_plan", weight: 30 },
  {
    re: /\bcover\s*sheet\b|\bsheet\s+index\b|\bdrawing\s+index\b/i,
    category: "cover_index",
    weight: 25,
  },
];

export type SheetHint = { category: SheetCategory; score: number };

/** Deterministic keyword guess for one sheet, used to rank and to seed the AI. */
export function hintSheet(
  text: string,
  sheetNumber: string | null,
  title: string | null,
): SheetHint {
  const haystack = [sheetNumber ?? "", title ?? "", text.slice(0, 4000)].join("\n");
  let best: SheetHint = { category: "other", score: 0 };
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(haystack) && rule.weight > best.score) {
      best = { category: rule.category, score: rule.weight };
    }
  }
  return best;
}

/** Marks like W1, W-12, D03, SF2, CW-4 as they appear in schedules and callouts. */
export function normalizeMark(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s.]/g, "")
    .replace(/^([A-Z]+)-?0*(\d+)/, "$1$2");
}

export function markPattern(mark: string): RegExp | null {
  const clean = mark.trim().toUpperCase();
  if (!clean || clean.length > 12) return null;
  const match = clean.match(/^([A-Z]{1,3})-?0*(\d{1,4})([A-Z]?)$/);
  if (!match) {
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`, "gi");
  }
  const [, prefix, digits, suffix] = match;
  const num = String(Number(digits));
  const padded = `0*${num}`;
  return new RegExp(`(^|[^A-Z0-9])${prefix}-?${padded}${suffix}([^A-Z0-9]|$)`, "gi");
}

export function countCallouts(text: string, mark: string) {
  const re = markPattern(mark);
  if (!re) return 0;
  return (text.match(re) ?? []).length;
}
