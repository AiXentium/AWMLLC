/**
 * Measurement accuracy layer for the takeoff system.
 *
 * Architecture decision: the AI transcribes dimensions exactly as printed
 * ("3'-0\"", "3060", "914") and stores the raw text. ALL conversion to
 * inches happens here, deterministically. A model doing arithmetic on
 * fractions is where silent mis-measurements come from; this module is the
 * single source of truth for what a dimension means.
 *
 * Formats handled:
 *   3'-0"  3'0"  3'  3 ft 0 in   → feet + inches
 *   36"  36 in  36-1/2"  36 1/2" → inches (fractions supported)
 *   3-0  3 - 0                   → feet - inches (dash form)
 *   3060 (as a pair)             → 3'-0" × 6'-0" industry shorthand
 *   914 mm  0.9 m                → metric
 *   36 (bare)                    → inches (US schedules)
 */

import type { ShortcutCategory } from "./orchestrator";

export type ParsedDimension = {
  inches: number;
  /** How the value was interpreted, for audit display. */
  format: "feet-inches" | "inches" | "industry-pair" | "metric" | "bare-inches";
  raw: string;
};

function parseFraction(part: string): number | null {
  const frac = part.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    if (!denom) return null;
    return Number(frac[1]) / denom;
  }
  const n = Number(part);
  return Number.isFinite(n) ? n : null;
}

/** Parses one dimension string to decimal inches. Returns null when unsure — never guesses. */
export function parseDimensionToInches(raw: string | null | undefined): ParsedDimension | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (!s || /^(n\/?a|none|unknown|-|—|varies|vary|see notes?)$/.test(s)) return null;

  // Metric: "914 mm" or "0.9 m"
  const metric = s.match(/([\d.,\s/]+)\s*(mm|millimeters?)\b/);
  if (metric) {
    const n = parseFraction(metric[1].replace(/,/g, ""));
    if (n === null) return null;
    return { inches: Math.round((n / 25.4) * 100) / 100, format: "metric", raw: String(raw) };
  }
  const meters = s.match(/([\d.,]+)\s*m\b/);
  if (meters && !s.includes("'")) {
    const n = Number(meters[1]);
    if (!Number.isFinite(n)) return null;
    return { inches: Math.round(n * 39.3701 * 100) / 100, format: "metric", raw: String(raw) };
  }

  // Feet + inches: 3'-0", 3'0", 3 ft 6 in, 3'-6 1/2", 3'-6" (dash after quote)
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)\s*-?\s*([\d\s/.]*?)\s*(?:"|in\b)?$/);
  if (ftIn) {
    const feet = Number(ftIn[1]);
    const inchPart = ftIn[2].trim();
    let inches = 0;
    if (inchPart) {
      const parts = inchPart.split(/\s+/);
      for (const p of parts) {
        const v = parseFraction(p);
        if (v === null) return null;
        inches += v;
      }
    }
    if (!Number.isFinite(feet)) return null;
    return {
      inches: Math.round((feet * 12 + inches) * 100) / 100,
      format: "feet-inches",
      raw: String(raw),
    };
  }

  // Dash form: 3-0, 3 - 6 1/2  (feet - inches)
  const dash = s.match(/^(\d+)\s*-\s*([\d\s/.]+)$/);
  if (dash) {
    const feet = Number(dash[1]);
    let inches = 0;
    for (const p of dash[2].trim().split(/\s+/)) {
      const v = parseFraction(p);
      if (v === null) return null;
      inches += v;
    }
    return {
      inches: Math.round((feet * 12 + inches) * 100) / 100,
      format: "feet-inches",
      raw: String(raw),
    };
  }

  // Inches: 36", 36 in, 36 1/2", 36.5
  const inchMarked = s.match(/^([\d\s/.]+)\s*(?:"|in\b)$/);
  if (inchMarked) {
    let total = 0;
    for (const p of inchMarked[1].trim().split(/\s+/)) {
      const v = parseFraction(p);
      if (v === null) return null;
      total += v;
    }
    return { inches: Math.round(total * 100) / 100, format: "inches", raw: String(raw) };
  }

  // Bare number → inches (US schedules). Fractions like "36 1/2" also land here.
  const bareParts = s.split(/\s+/);
  if (bareParts.every((p) => /^[\d/.]+$/.test(p))) {
    let total = 0;
    for (const p of bareParts) {
      const v = parseFraction(p);
      if (v === null) return null;
      total += v;
    }
    if (total > 0)
      return { inches: Math.round(total * 100) / 100, format: "bare-inches", raw: String(raw) };
  }

  return null;
}

export type ParsedSize = {
  widthIn: number;
  heightIn: number;
  /** Display string in feet-inches, e.g. 3'-0" × 5'-0". */
  display: string;
};

/**
 * Parses a width/height pair. Handles separate fields ("3'-0" / "5'-0") and
 * the industry 4-digit shorthand ("3060" → 36 × 72).
 */
export function parseSizePair(
  widthRaw: string | null | undefined,
  heightRaw: string | null | undefined,
): ParsedSize | null {
  // Industry shorthand: one 4-digit token like "3060" = 3'-0" × 6'-0".
  const combined = [widthRaw, heightRaw].filter(Boolean).join(" ").trim();
  const pair = combined.match(/^\b(\d)(\d)(\d)(\d)\b$/);
  if (pair && !widthRaw?.includes("'") && !heightRaw?.includes("'")) {
    const w = Number(pair[1]) * 12 + Number(pair[2]);
    const h = Number(pair[3]) * 12 + Number(pair[4]);
    return { widthIn: w, heightIn: h, display: formatSize(w, h) };
  }

  const w = parseDimensionToInches(widthRaw);
  const h = parseDimensionToInches(heightRaw);
  if (!w || !h) return null;
  return { widthIn: w.inches, heightIn: h.inches, display: formatSize(w.inches, h.inches) };
}

/** Formats decimal inches as feet-inches: 36 → 3'-0", 36.5 → 3'-0 1/2". */
export function formatInches(inches: number): string {
  const total = Math.round(inches * 16) / 16; // nearest 1/16
  const feet = Math.floor(total / 12);
  const rem = total - feet * 12;
  const whole = Math.floor(rem);
  const frac = rem - whole;
  const sixteenths = Math.round(frac * 16);
  let fracStr = "";
  if (sixteenths > 0) {
    // reduce fraction
    let n = sixteenths,
      d = 16;
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const g = gcd(n, d);
    n /= g;
    d /= g;
    fracStr = whole > 0 ? ` ${n}/${d}` : `${n}/${d}`;
  }
  const inchStr = whole > 0 || fracStr ? `${whole}${fracStr}` : "0";
  return `${feet}'-${inchStr}"`;
}

export function formatSize(widthIn: number, heightIn: number): string {
  return `${formatInches(widthIn)} × ${formatInches(heightIn)}`;
}

/** Plausible single-unit ranges in inches, per shortcut category. */
const SIZE_RANGES: Record<
  ShortcutCategory,
  { w: [number, number]; h: [number, number]; note: string }
> = {
  windows: { w: [12, 144], h: [12, 144], note: "single window unit" },
  doors: { w: [18, 96], h: [72, 120], note: "single door leaf" },
  sliding_doors: { w: [48, 288], h: [72, 144], note: "sliding door assembly" },
  storefront_curtainwall: { w: [12, 480], h: [12, 240], note: "glazing assembly" },
  louvers: { w: [6, 120], h: [6, 120], note: "louver / vent" },
  skylights: { w: [12, 120], h: [12, 120], note: "skylight unit" },
};

export type SizeValidation = { ok: boolean; warnings: string[] };

/**
 * Sanity-checks a parsed size against the category's plausible range.
 * Out-of-range values are flagged for estimator review — never silently
 * "corrected", because a wrong auto-correction is worse than a flag.
 */
export function validateSize(
  widthIn: number,
  heightIn: number,
  category: ShortcutCategory,
): SizeValidation {
  const range = SIZE_RANGES[category];
  const warnings: string[] = [];
  if (widthIn < range.w[0] || widthIn > range.w[1]) {
    warnings.push(
      `Width ${formatInches(widthIn)} is outside the plausible range for ${range.note} (${formatInches(range.w[0])}–${formatInches(range.w[1])}) — verify against the schedule.`,
    );
  }
  if (heightIn < range.h[0] || heightIn > range.h[1]) {
    warnings.push(
      `Height ${formatInches(heightIn)} is outside the plausible range for ${range.note} (${formatInches(range.h[0])}–${formatInches(range.h[1])}) — verify against the schedule.`,
    );
  }
  return { ok: warnings.length === 0, warnings };
}

/** Area in square feet, rounded to 2 decimals. */
export function areaSqFt(widthIn: number, heightIn: number): number {
  return Math.round(((widthIn * heightIn) / 144) * 100) / 100;
}

/**
 * Parses a user-typed dimension for inline editing. Accepts anything
 * parseDimensionToInches handles (36, 36", 3'-0") — blank clears the value,
 * unparseable input returns an error instead of storing NaN.
 */
export function parseDimensionInput(raw: string): { inches: number | null; error?: string } {
  const t = raw.trim();
  if (!t) return { inches: null };
  const parsed = parseDimensionToInches(t);
  if (!parsed)
    return {
      inches: null,
      error: `"${raw.trim()}" isn't a recognizable dimension. Try 36, 36", or 3'-0".`,
    };
  if (!(parsed.inches > 0)) return { inches: null, error: "Dimension must be a positive number." };
  if (parsed.inches > 1200)
    return {
      inches: null,
      error: `"${raw.trim()}" looks too large — did you mean feet-inches like 3'-0"?`,
    };
  return { inches: parsed.inches };
}
