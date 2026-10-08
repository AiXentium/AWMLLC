/**
 * Server-only helpers for document-first project information extraction.
 * Model keys and the geocoder are only ever touched here.
 */
import { EXTRACTION_FIELDS } from "./fields";
import {
  callWithRetry,
  configuredProviders,
  estimateCostUsd,
  providerApiKey,
  PROVIDER_PRIORITY,
  DEFAULT_MODELS,
  defaultModelFor,
  takeoffMathCandidate,
  AI_MODEL,
  type ProviderKey,
} from "@/lib/ai/providers.server";

export type ExtractedField = {
  key: string;
  value: string;
  confidence: number;
  pageNumber: number | null;
  snippet: string | null;
};

export type ExtractedAddress = {
  address: string;
  role: "site" | "architect" | "owner" | "contractor" | "engineer" | "unknown";
  label: string | null;
  pageNumber: number | null;
  confidence: number;
};

export type ExtractionModelResult = {
  fields: ExtractedField[];
  addresses: ExtractedAddress[];
  provider?: string;
  model?: string;
  error?: string;
};

const ROLES = ["site", "architect", "owner", "contractor", "engineer", "unknown"] as const;

export const EXTRACTION_SYSTEM = `You read construction drawing sheets for AWM LLC and extract factual project record data.

Hard rules:
- Only report values that literally appear in the supplied sheet text or image. Never guess, never infer a city from a ZIP, never invent numbers.
- Omit any field you cannot find. An omitted field is correct; a fabricated field is a serious error.
- Confidence must reflect the evidence: 0.9+ only for an explicit labelled value in a title block/cover sheet, 0.6-0.85 for a clearly implied value, below 0.6 for uncertain readings.
- Addresses: the project site address is the address of the work. Architect, engineer, owner and contractor addresses are consultant/office addresses and must be labelled with that role, never as the site.
- Reply with JSON only. No markdown fences, no commentary.`;

export function buildExtractionPrompt(input: {
  sheets: { pageNumber: number; sheetLabel: string | null; text: string }[];
  hasImages: boolean;
  missingOnly: string[] | null;
}) {
  const wanted = input.missingOnly?.length
    ? EXTRACTION_FIELDS.filter((f) => input.missingOnly!.includes(f.key))
    : EXTRACTION_FIELDS;

  const fieldLines = wanted.map((f) => `- "${f.key}" (${f.type}): ${f.hint}`).join("\n");
  const sheetBlocks = input.sheets
    .map(
      (s) =>
        `--- SHEET (page ${s.pageNumber}${s.sheetLabel ? `, ${s.sheetLabel}` : ""}) ---\n${s.text.slice(0, 7000)}`,
    )
    .join("\n\n");

  return [
    input.hasImages
      ? "The sheets below have no usable embedded text, so page images are attached. Read the title block, cover sheet and code summary from the images."
      : "Sheet text extracted from the PDF text layer follows.",
    "",
    sheetBlocks || "(no text layer available — use the attached images)",
    "",
    "Extract these fields where they are actually present:",
    fieldLines,
    "",
    `Return JSON exactly in this shape:`,
    `{"fields":[{"key":"city","value":"Naples","confidence":0.93,"page":1,"snippet":"NAPLES, FL 34102"}],`,
    `"addresses":[{"address":"123 Main St, Naples, FL 34102","role":"site","label":"Project site","page":1,"confidence":0.9}]}`,
    "",
    `"role" must be one of: ${ROLES.join(", ")}. Include every distinct address you find, each with its role.`,
  ].join("\n");
}

function parseJsonBlock(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function clampConfidence(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

export function normalizeModelOutput(raw: unknown): {
  fields: ExtractedField[];
  addresses: ExtractedAddress[];
} {
  const obj = (raw ?? {}) as { fields?: unknown[]; addresses?: unknown[] };
  const allowed = new Set(EXTRACTION_FIELDS.map((f) => f.key));
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const item of obj.fields ?? []) {
    const row = item as {
      key?: string;
      value?: unknown;
      confidence?: unknown;
      page?: unknown;
      snippet?: unknown;
    };
    const key = String(row.key ?? "").trim();
    if (!allowed.has(key) || seen.has(key)) continue;
    const value = String(row.value ?? "").trim();
    if (!value || /^(n\/?a|unknown|none|tbd|—|-)$/i.test(value)) continue;
    seen.add(key);
    const page = Number(row.page);
    fields.push({
      key,
      value: value.slice(0, 500),
      confidence: clampConfidence(row.confidence),
      pageNumber: Number.isFinite(page) && page > 0 ? Math.trunc(page) : null,
      snippet: row.snippet ? String(row.snippet).slice(0, 400) : null,
    });
  }

  const addresses: ExtractedAddress[] = [];
  for (const item of obj.addresses ?? []) {
    const row = item as {
      address?: unknown;
      role?: unknown;
      label?: unknown;
      page?: unknown;
      confidence?: unknown;
    };
    const address = String(row.address ?? "").trim();
    if (address.length < 8) continue;
    const roleRaw = String(row.role ?? "unknown").toLowerCase();
    const role = (ROLES as readonly string[]).includes(roleRaw)
      ? (roleRaw as ExtractedAddress["role"])
      : "unknown";
    const page = Number(row.page);
    addresses.push({
      address: address.slice(0, 300),
      role,
      label: row.label ? String(row.label).slice(0, 120) : null,
      pageNumber: Number.isFinite(page) && page > 0 ? Math.trunc(page) : null,
      confidence: clampConfidence(row.confidence),
    });
  }

  return { fields, addresses };
}

/** Site-address ranking: role first, then corroboration from extracted city/ZIP. */
export function scoreAddress(
  candidate: ExtractedAddress,
  fields: ExtractedField[],
  siteHints: { city?: string | null; postal?: string | null; street?: string | null },
) {
  const roleScore: Record<ExtractedAddress["role"], number> = {
    site: 60,
    unknown: 20,
    owner: 8,
    contractor: 4,
    architect: 0,
    engineer: 0,
  };
  let score = roleScore[candidate.role] + candidate.confidence * 20;
  const lower = candidate.address.toLowerCase();
  const cityField = siteHints.city ?? fields.find((f) => f.key === "city")?.value ?? null;
  const zipField = siteHints.postal ?? fields.find((f) => f.key === "postal_code")?.value ?? null;
  const streetField = siteHints.street ?? fields.find((f) => f.key === "street")?.value ?? null;
  if (cityField && lower.includes(cityField.toLowerCase())) score += 12;
  if (zipField && lower.includes(zipField.toLowerCase())) score += 12;
  if (streetField && lower.includes(streetField.toLowerCase())) score += 16;
  if (/\b(suite|ste\.?|floor|fl\.?)\s*\d/i.test(candidate.address) && candidate.role !== "site")
    score -= 8;
  if (/architect|engineer|consultant|associates|design group/i.test(candidate.label ?? ""))
    score -= 10;
  return Math.round(Math.max(0, score));
}

type Candidate = { provider: ProviderKey; model: string };

export function buildChain(
  route: {
    provider?: string | null;
    model?: string | null;
    fallback_provider?: string | null;
    fallback_model?: string | null;
  } | null,
  opts?: { needsVision?: boolean; mathTask?: boolean },
): Candidate[] {
  // Rotation order is always free-first (OpenRouter → Gemini → Groq), paid last.
  // The DB route's per-provider model choices are honored; only the order is fixed.
  // Vision tasks skip providers without a vision-capable free model.
  const needsVision = Boolean(opts?.needsVision);
  const valid = (p?: string | null): p is ProviderKey =>
    !!p && (PROVIDER_PRIORITY as string[]).includes(p);
  const routeModels = new Map<string, string>();
  if (valid(route?.provider) && route?.model) routeModels.set(route.provider!, route.model);
  if (valid(route?.fallback_provider) && route?.fallback_model)
    routeModels.set(route.fallback_provider!, route.fallback_model!);

  const chain: Candidate[] = [];
  // Takeoff math (schedule reading, opening counts) leads with Claude Opus
  // when the Anthropic key is configured; otherwise the free-first rotation
  // runs as usual. Opus failures fall through to the normal rotation.
  if (opts?.mathTask) {
    const math = takeoffMathCandidate();
    if (math) chain.push(math);
  }
  for (const p of PROVIDER_PRIORITY) {
    const model = routeModels.get(p) ?? defaultModelFor(p, needsVision);
    if (!model) continue; // e.g. Groq has no free vision model
    chain.push({ provider: p, model });
  }
  return chain.filter((c) => Boolean(providerApiKey(c.provider)));
}

export async function runExtractionModel(input: {
  chain: Candidate[];
  prompt: string;
  images: string[];
  maxOutputTokens: number | null;
}): Promise<
  ExtractionModelResult & {
    usage?: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
  }
> {
  if (!configuredProviders().length || !input.chain.length) {
    return {
      fields: [],
      addresses: [],
      error: "No AI provider is configured for document extraction.",
    };
  }

  let lastError = "Extraction model request failed.";
  for (const candidate of input.chain) {
    try {
      const result = await callWithRetry({
        provider: candidate.provider,
        model: candidate.model,
        system: EXTRACTION_SYSTEM,
        prompt: input.prompt,
        images: input.images.length ? input.images : undefined,
        maxOutputTokens: input.maxOutputTokens ?? 2048,
        timeoutMs: 60_000,
      });
      const parsed = normalizeModelOutput(parseJsonBlock(result.text));
      return {
        ...parsed,
        provider: result.provider,
        model: result.model,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
          latencyMs: result.latencyMs,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Extraction model request failed.";
    }
  }
  return { fields: [], addresses: [], error: lastError };
}

export type GeocodeResult = {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  displayName?: string;
  /** How precise the match is: rooftop > street > locality > postal. */
  precision?: "rooftop" | "street" | "locality" | "postal";
  /** Which query variant produced the match (for diagnostics). */
  matchedQuery?: string;
  provider: string;
  error?: string;
};

type GeocodeAttempt = {
  params: Record<string, string>;
  label: string;
  precision: NonNullable<GeocodeResult["precision"]>;
};

const SUITE_PATTERN =
  /,?\s*\b(suite|ste\.?|floor|fl\.?|unit|bldg\.?|building|room|rm\.?|#)\s*[\w-]+/gi;

/**
 * Builds an ordered fallback chain of Nominatim queries from one address.
 * Free-text search is brittle (suite numbers, punctuation, new developments),
 * so we progressively simplify: full text → no suite → structured search →
 * street+ZIP → city/state → ZIP centroid. Never returns an empty list.
 */
function buildGeocodeAttempts(address: string): GeocodeAttempt[] {
  const clean = address.replace(/\s+/g, " ").trim();
  const attempts: GeocodeAttempt[] = [
    { params: { q: clean }, label: "full", precision: "rooftop" },
  ];

  const noSuite = clean
    .replace(SUITE_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
  if (noSuite && noSuite !== clean) {
    attempts.push({ params: { q: noSuite }, label: "no-suite", precision: "rooftop" });
  }

  const zip = clean.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
  const parts = clean
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? "";
  const state =
    lastPart.match(/^([A-Z]{2})\b/)?.[1] ?? clean.match(/\b([A-Z]{2})\s+\d{5}/)?.[1] ?? null;
  // 3+ parts: "street, city, ST ZIP" — 2 parts: "city, ST ZIP" — 1 part: free text only.
  const streetRaw = parts.length >= 3 ? parts[0] : "";
  const street = streetRaw
    .replace(SUITE_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const city = parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[0] : null;

  if (street && city && state) {
    attempts.push({
      params: { street, city, state, ...(zip ? { postalcode: zip } : {}), country: "USA" },
      label: "structured",
      precision: "rooftop",
    });
  }
  if (street && zip && street.replace(/[^a-z]/gi, "").length > 2) {
    attempts.push({
      params: { street, postalcode: zip, country: "USA" },
      label: "street-zip",
      precision: "street",
    });
  }
  if (city && state) {
    attempts.push({
      params: { city, state, ...(zip ? { postalcode: zip } : {}), country: "USA" },
      label: "locality",
      precision: "locality",
    });
  } else if (zip) {
    attempts.push({
      params: { postalcode: zip, country: "USA" },
      label: "zip",
      precision: "postal",
    });
  }

  const seen = new Set<string>();
  return attempts.filter((a) => {
    const key = JSON.stringify(a.params);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Geocodes through OpenStreetMap Nominatim — no API key required. Nominatim
 * asks for a descriptive User-Agent and rate-limits to ~1 request/second, so
 * callers geocode one candidate at a time and we pause between fallbacks.
 *
 * Tries a smart fallback chain instead of giving up on the first miss:
 * full address → suite stripped → structured search → street+ZIP →
 * city/state → ZIP centroid. The returned `precision` tells the UI how
 * exact the coordinates are.
 */
export async function geocodeAddressText(address: string): Promise<GeocodeResult> {
  const attempts = buildGeocodeAttempts(address);
  const tried: string[] = [];

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (i > 0) await sleep(1100); // Nominatim ~1 req/sec politeness
    tried.push(attempt.label);

    const url = new URL("https://nominatim.openstreetmap.org/search");
    for (const [k, v] of Object.entries(attempt.params)) url.searchParams.set(k, v);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "AWM-Takeoff-AI/1.0 (project site geocoding)",
          accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!res.ok) continue; // try the next simpler query
      const rows = (await res.json()) as {
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string>;
      }[];
      const hit = rows?.[0];
      if (!hit?.lat || !hit?.lon) continue; // no match — try next fallback
      const a = hit.address ?? {};
      return {
        ok: true,
        latitude: Number(hit.lat),
        longitude: Number(hit.lon),
        city: a.city ?? a.town ?? a.village ?? a.hamlet ?? null,
        county: a.county ? a.county.replace(/\s+County$/i, "") : null,
        state: a.state ?? null,
        postalCode: a.postcode ?? null,
        country: a.country_code ? a.country_code.toUpperCase() : null,
        displayName: hit.display_name,
        precision: attempt.precision,
        matchedQuery: attempt.label,
        provider: "nominatim",
      };
    } catch {
      // Network/timeout — try the next simpler query.
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    provider: "nominatim",
    error: `No match for this address (tried: ${tried.join(", ")}).`,
  };
}
