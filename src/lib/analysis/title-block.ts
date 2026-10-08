/**
 * Title block extractor — Togal-style automatic sheet naming.
 *
 * Reads a plan sheet's extracted text and pulls out the sheet number
 * (e.g. "A-101") and sheet title (e.g. "First Floor Plan") from the
 * title block, using deterministic regex patterns.
 *
 * Regex runs first (fast, free). When it finds nothing useful, the caller
 * should fall back to the AI extractor via the `extractTitleBlocks`
 * server function (batched, free-first provider rotation).
 */

export interface TitleBlockResult {
  sheet_number: string | null;
  title: string | null;
  /** 0–1. >= 0.6 is worth persisting. */
  confidence: number;
}

/** Discipline prefixes used in sheet numbering (AIA convention). */
const DISCIPLINES = [
  "G",
  "A",
  "S",
  "E",
  "M",
  "P",
  "C",
  "L",
  "FP",
  "FA",
  "ID",
  "I",
  "Q",
  "T",
  "AV",
  "SE",
];

/** Keywords that mark a line as a sheet title. */
const TITLE_KEYWORDS = [
  "FLOOR PLAN",
  "REFLECTED CEILING",
  "ROOF PLAN",
  "SITE PLAN",
  "ELEVATION",
  "BUILDING SECTION",
  "WALL SECTION",
  "SECTION",
  "DETAIL",
  "SCHEDULE",
  "WINDOW SCHEDULE",
  "DOOR SCHEDULE",
  "FINISH SCHEDULE",
  "FOUNDATION",
  "FRAMING PLAN",
  "ENLARGED PLAN",
  "STAIR",
  "ELEVATOR",
  "COVER",
  "SHEET INDEX",
  "DRAWING INDEX",
  "LEGEND",
  "ABBREVIATIONS",
  "GENERAL NOTES",
  "CODE PLAN",
  "LIFE SAFETY",
  "DEMOLITION",
  "PARTITION PLAN",
  "POWER PLAN",
  "LIGHTING PLAN",
  "PLUMBING PLAN",
  "MECHANICAL PLAN",
  "GRADING PLAN",
  "LANDSCAPE PLAN",
];

/**
 * Matches sheet numbers like A-101, A101, A 101, A.101, S-201, E-301,
 * P-001, FP-1, A-101A. Requires a known discipline prefix to avoid
 * matching random numbers (dimensions, dates, etc).
 */
const SHEET_RE = new RegExp(`\\b(${DISCIPLINES.join("|")})[\\s.\\-]*?(\\d{1,4}[A-Z]?)\\b`);

/** Stricter: sheet number on a line that mentions "sheet"/"dwg"/"drawing". */
const LABELED_SHEET_RE =
  /(?:SHEET|DWG|DRAWING|SH\.?)\s*(?:NO\.?|#)?\s*([A-Z]{1,3})[\s.-]*?(\d{1,4}[A-Z]?)/i;

function cleanTitle(raw: string): string {
  return raw
    .replace(/^(?:TITLE|SHEET\s+TITLE)\s*[:-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOf\b|\bAnd\b|\bThe\b|\bA\b/g, (w) => w.toLowerCase())
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function extractTitleBlock(text: string): TitleBlockResult {
  const empty: TitleBlockResult = { sheet_number: null, title: null, confidence: 0 };
  if (!text || text.trim().length < 20) return empty;

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length < 200);

  let sheetNumber: string | null = null;
  let sheetLineIdx = -1;
  let labeled = false;

  // Pass 1: labeled sheet number ("SHEET A-101", "DWG NO. S-201").
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LABELED_SHEET_RE);
    if (m) {
      sheetNumber = `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
      sheetLineIdx = i;
      labeled = true;
      break;
    }
  }

  // Pass 2: bare discipline-prefixed number, preferring lines that also
  // carry title keywords (title block lines usually have both).
  if (!sheetNumber) {
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(SHEET_RE);
      if (!m) continue;
      const upper = lines[i].toUpperCase();
      let score = 0;
      if (TITLE_KEYWORDS.some((k) => upper.includes(k))) score += 2;
      if (/^(?:[A-Z]{1,3}[\s.-]*\d{1,4}[A-Z]?)$/.test(lines[i])) score += 2;
      if (upper.includes("SCALE") || upper.includes("DATE") || upper.includes("DRAWN")) score += 1;
      if (i >= lines.length - 8) score += 1;
      if (score > bestScore) {
        bestScore = score;
        sheetNumber = `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
        sheetLineIdx = i;
      }
    }
    if (bestScore < 0) {
      sheetNumber = null;
      sheetLineIdx = -1;
    }
  }

  // Title: prefer a keyword line adjacent to the sheet number, else any
  // keyword line, else the longest non-junk line near the sheet number.
  let title: string | null = null;
  if (sheetLineIdx >= 0) {
    const window: string[] = [];
    for (let d = -3; d <= 3; d++) {
      const l = lines[sheetLineIdx + d];
      if (l && d !== 0) window.push(l);
    }
    const keywordLine = window.find((l) => TITLE_KEYWORDS.some((k) => l.toUpperCase().includes(k)));
    if (keywordLine) {
      title = titleCase(cleanTitle(keywordLine));
    } else {
      const candidate = window
        .filter((l) => l.length >= 4 && !SHEET_RE.test(l) && !/^\d[\d\s.,/\\-]*$/.test(l))
        .sort((a, b) => b.length - a.length)[0];
      if (candidate) title = titleCase(cleanTitle(candidate));
    }
  }
  if (!title) {
    const keywordLine = lines.find((l) => TITLE_KEYWORDS.some((k) => l.toUpperCase().includes(k)));
    if (keywordLine) title = titleCase(cleanTitle(keywordLine));
  }

  let confidence = 0;
  if (sheetNumber && title) confidence = labeled ? 0.95 : 0.85;
  else if (sheetNumber) confidence = labeled ? 0.8 : 0.65;
  else if (title) confidence = 0.55;

  return { sheet_number: sheetNumber, title, confidence };
}
