/**
 * Canonical list of project information fields the document-first extraction
 * engine looks for. `column` maps a field onto the projects table so a blank
 * project record can be auto-filled; review-only fields have no column.
 */
export type ExtractionFieldType = "text" | "date" | "integer";

export type ExtractionField = {
  key: string;
  label: string;
  group: "identity" | "location" | "parties" | "set" | "building" | "code";
  column?: string;
  type: ExtractionFieldType;
  hint: string;
};

export const EXTRACTION_FIELDS: ExtractionField[] = [
  {
    key: "project_name",
    label: "Project / job name",
    group: "identity",
    column: "name",
    type: "text",
    hint: "Project or job name from the cover/title sheet",
  },
  {
    key: "project_number",
    label: "Project number",
    group: "identity",
    column: "project_number",
    type: "text",
    hint: "Architect or owner project/job number",
  },
  {
    key: "permit_number",
    label: "Permit / application number",
    group: "identity",
    column: "permit_number",
    type: "text",
    hint: "Permit, application or plan review number",
  },
  {
    key: "parcel_id",
    label: "Parcel / folio / APN",
    group: "identity",
    column: "parcel_id",
    type: "text",
    hint: "Parcel, folio, tax or APN identifier",
  },

  {
    key: "address_full",
    label: "Full project address",
    group: "location",
    column: "address",
    type: "text",
    hint: "Complete street address of the project site only",
  },
  {
    key: "street",
    label: "Street",
    group: "location",
    type: "text",
    hint: "Street number and name of the project site",
  },
  {
    key: "unit_suite",
    label: "Unit / suite",
    group: "location",
    column: "unit_suite",
    type: "text",
    hint: "Unit or suite of the project site",
  },
  {
    key: "city",
    label: "City",
    group: "location",
    column: "city",
    type: "text",
    hint: "City of the project site",
  },
  {
    key: "county",
    label: "County",
    group: "location",
    column: "county",
    type: "text",
    hint: "County of the project site",
  },
  {
    key: "state",
    label: "State",
    group: "location",
    column: "state",
    type: "text",
    hint: "Two-letter state code of the project site",
  },
  {
    key: "postal_code",
    label: "ZIP",
    group: "location",
    column: "postal_code",
    type: "text",
    hint: "Postal code of the project site",
  },
  {
    key: "country",
    label: "Country",
    group: "location",
    column: "country",
    type: "text",
    hint: "Country, usually USA",
  },
  {
    key: "municipality",
    label: "Municipality / AHJ",
    group: "location",
    column: "municipality",
    type: "text",
    hint: "Municipality or authority having jurisdiction",
  },
  {
    key: "subdivision",
    label: "Development / subdivision",
    group: "location",
    column: "subdivision",
    type: "text",
    hint: "Development, community or subdivision name",
  },
  {
    key: "building_name",
    label: "Building name / number",
    group: "location",
    type: "text",
    hint: "Building name or number covered by this set",
  },

  {
    key: "owner_developer",
    label: "Owner / developer",
    group: "parties",
    column: "owner_developer",
    type: "text",
    hint: "Owner or developer company name",
  },
  {
    key: "architect",
    label: "Architect / designer",
    group: "parties",
    column: "architect",
    type: "text",
    hint: "Architect or designer firm name",
  },
  {
    key: "engineer",
    label: "Engineer(s)",
    group: "parties",
    column: "engineer",
    type: "text",
    hint: "Structural/civil/MEP engineering firm names, comma separated",
  },
  {
    key: "general_contractor",
    label: "General contractor",
    group: "parties",
    column: "general_contractor",
    type: "text",
    hint: "General contractor company name",
  },

  {
    key: "drawing_set_title",
    label: "Drawing set title",
    group: "set",
    column: "drawing_set_title",
    type: "text",
    hint: "Title of the drawing set, e.g. Permit Set",
  },
  {
    key: "issue_date",
    label: "Issue date",
    group: "set",
    column: "issue_date",
    type: "date",
    hint: "Issue date of the set (YYYY-MM-DD)",
  },
  {
    key: "revision_date",
    label: "Revision date",
    group: "set",
    column: "revision_date",
    type: "date",
    hint: "Latest revision date (YYYY-MM-DD)",
  },
  {
    key: "revision",
    label: "Revision",
    group: "set",
    column: "revision",
    type: "text",
    hint: "Latest revision identifier",
  },
  {
    key: "sheet_index_summary",
    label: "Sheet index",
    group: "set",
    type: "text",
    hint: "Short summary of the sheet index, e.g. A-000 to A-501",
  },
  {
    key: "disciplines",
    label: "Detected disciplines",
    group: "set",
    type: "text",
    hint: "Disciplines present, comma separated (A, S, C, M, E, P)",
  },

  {
    key: "occupancy_type",
    label: "Occupancy / use type",
    group: "building",
    column: "occupancy_type",
    type: "text",
    hint: "Occupancy classification or use type",
  },
  {
    key: "construction_type",
    label: "Construction type",
    group: "building",
    column: "construction_type",
    type: "text",
    hint: "Construction type, e.g. Type V-B",
  },
  {
    key: "building_count",
    label: "Number of buildings",
    group: "building",
    column: "building_count",
    type: "integer",
    hint: "Number of buildings, only if stated",
  },
  {
    key: "story_count",
    label: "Floors / stories",
    group: "building",
    column: "story_count",
    type: "integer",
    hint: "Number of floors/stories, only if stated",
  },
  {
    key: "unit_count",
    label: "Number of units",
    group: "building",
    column: "unit_count",
    type: "integer",
    hint: "Number of dwelling units, only if stated",
  },
  {
    key: "phase_count",
    label: "Number of phases",
    group: "building",
    column: "phase_count",
    type: "integer",
    hint: "Number of phases, only if stated",
  },
  {
    key: "project_type",
    label: "Project type",
    group: "building",
    column: "project_type",
    type: "text",
    hint: "Residential, multifamily, commercial, etc.",
  },

  {
    key: "code_edition",
    label: "Building code edition",
    group: "code",
    column: "code_edition",
    type: "text",
    hint: "Applicable building code and edition",
  },
  {
    key: "wind_speed",
    label: "Design wind speed",
    group: "code",
    column: "wind_speed",
    type: "text",
    hint: "Ultimate design wind speed with units",
  },
  {
    key: "exposure_category",
    label: "Exposure category",
    group: "code",
    column: "exposure_category",
    type: "text",
    hint: "Wind exposure category",
  },
  {
    key: "risk_category",
    label: "Risk category",
    group: "code",
    column: "risk_category",
    type: "text",
    hint: "Risk category",
  },
  {
    key: "flood_zone",
    label: "Flood zone",
    group: "code",
    column: "flood_zone",
    type: "text",
    hint: "FEMA flood zone designation",
  },
  {
    key: "design_pressure_notes",
    label: "Design pressure references",
    group: "code",
    column: "design_pressure_notes",
    type: "text",
    hint: "Design pressure references or table notes",
  },
];

export const FIELD_BY_KEY = new Map(EXTRACTION_FIELDS.map((f) => [f.key, f]));

export const GROUP_LABELS: Record<ExtractionField["group"], string> = {
  identity: "Project identity",
  location: "Location",
  parties: "Project team",
  set: "Drawing set",
  building: "Building program",
  code: "Code & wind criteria",
};

export const HIGH_CONFIDENCE = 0.8;

export function confidenceLabel(confidence: number) {
  if (confidence >= HIGH_CONFIDENCE) return "High";
  if (confidence >= 0.55) return "Medium";
  return "Low";
}

/** Sheet-relevance ranking used to spend AI calls on the pages that matter. */
const PAGE_KEYWORDS: { re: RegExp; score: number }[] = [
  { re: /\bcover\s*sheet\b|\btitle\s*sheet\b/i, score: 60 },
  { re: /\bsheet\s+index\b|\bdrawing\s+index\b|\bindex\s+of\s+drawings\b/i, score: 45 },
  { re: /\bcode\s+(summary|analysis|data)\b/i, score: 40 },
  { re: /\bgeneral\s+notes\b/i, score: 25 },
  { re: /\bsite\s+plan\b/i, score: 30 },
  { re: /\bpermit\b|\bapplication\s+no\b/i, score: 22 },
  { re: /\bwindow\s+schedule\b|\bdoor\s+schedule\b/i, score: 20 },
  { re: /\bproject\s+(name|address|number)\b/i, score: 35 },
  { re: /\bowner\b|\barchitect\b|\bengineer\b|\bcontractor\b/i, score: 14 },
  { re: /\bfolio\b|\bparcel\b|\bapn\b/i, score: 18 },
  { re: /\bwind\s+speed\b|\bexposure\b|\brisk\s+category\b|\bflood\s+zone\b/i, score: 16 },
  {
    re: /\b\d{2,6}\s+[A-Za-z0-9.\- ]{3,40}\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|hwy|highway|pkwy|terrace|ter|cir|circle)\b/i,
    score: 26,
  },
];

export function scorePageText(text: string, pageNumber: number) {
  let score = Math.max(0, 30 - (pageNumber - 1) * 6);
  for (const k of PAGE_KEYWORDS) if (k.re.test(text)) score += k.score;
  return score;
}
