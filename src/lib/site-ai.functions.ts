/**
 * Server-only AI site editing.
 *
 * `siteAiEdit` takes Washington's plain-English instruction plus the page's
 * current sections, asks the AI (free-first provider rotation) to return the
 * FULL updated sections array as JSON, validates it against the SiteSection
 * schema, and returns it for preview. Nothing is saved here — the client
 * shows a preview and Washington approves before useSaveSitePage persists.
 *
 * Hard rules enforced both in the prompt and in validation:
 * - Every returned section id must already exist in the input. No invented ids.
 * - Only sections relevant to the instruction may change; others must be
 *   byte-identical to the input.
 * - The SiteSection schema is preserved (type/order/eyebrow/heading/body/
 *   font/image/cta_label/cta_href/items).
 */
import { createServerFn } from "@tanstack/react-start";
import { callWithFallback } from "@/lib/ai/providers.server";
import type { SiteSection, SiteSectionType } from "@/lib/site-pages";

export type SiteAiEditInput = {
  pageSlug: string;
  instruction: string;
  sections: SiteSection[];
};

export type SiteAiEditResult =
  | { ok: true; sections: SiteSection[]; summary: string; provider: string; model: string }
  | { ok: false; error: string };

const VALID_TYPES: SiteSectionType[] = ["hero", "text", "features", "cta", "gallery"];
const VALID_FONTS = ["", "serif", "sans"];

const SYSTEM_PROMPT = `You edit website page content for AWM LLC (American Windows Manufacturer LLC), an independent supplier/distributor of YKK AP residential windows and patio doors in Florida.

You receive the page's current sections as JSON and a plain-English instruction from the site owner. Return the FULL updated sections array as JSON.

HARD RULES — violating any of these invalidates your response:
1. NEVER invent, rename, or remove section ids. Every section in your output must keep its exact original id. If the instruction asks for a brand-new section, do NOT create it — leave the sections as-is and say so in the summary.
2. Change ONLY what the instruction asks for. Sections unrelated to the instruction must be returned byte-identical to the input.
3. Keep the exact schema per section: { id, type, order, eyebrow, heading, body, font, image, cta_label, cta_href, items }. "type" must be one of: hero, text, features, cta, gallery. "font" must be "", "serif", or "sans". "items" is an array of { title, text }.
4. Do not change "image" values unless the instruction explicitly asks for a different image. Valid image filenames are provided in the input when relevant.
5. Keep the business voice: AWM LLC is the hero; YKK AP distributorship is a supporting credential. Never claim AWM manufactures YKK products. Service area is Florida and Central Florida.
6. Keep copy concise and professional. Preserve any Florida product approval IDs or factual claims already present; never invent new ones.

Return ONLY a JSON object in this shape, no markdown fences, no commentary:
{"sections": [ ...full updated sections... ], "summary": "one or two sentences describing what changed"}`;

function sanitizeSection(raw: unknown, knownIds: Set<string>): SiteSection | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const id = String(s.id ?? "");
  if (!id || !knownIds.has(id)) return null;
  const type = String(s.type ?? "");
  if (!(VALID_TYPES as string[]).includes(type)) return null;
  const font = s.font === undefined || s.font === null ? "" : String(s.font);
  const itemsRaw = Array.isArray(s.items) ? s.items : [];
  return {
    id,
    type: type as SiteSectionType,
    order: Number.isFinite(Number(s.order)) ? Number(s.order) : 0,
    eyebrow: s.eyebrow == null ? "" : String(s.eyebrow).slice(0, 200),
    heading: String(s.heading ?? "").slice(0, 300),
    body: String(s.body ?? "").slice(0, 5000),
    font: VALID_FONTS.includes(font) ? font : "",
    image: String(s.image ?? "").slice(0, 200),
    cta_label: String(s.cta_label ?? "").slice(0, 120),
    cta_href: String(s.cta_href ?? "").slice(0, 300),
    items: itemsRaw.slice(0, 20).map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return {
        title: String(o.title ?? "").slice(0, 200),
        text: String(o.text ?? "").slice(0, 1000),
      };
    }),
  };
}

function parseJsonObject(text: string): unknown {
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

export const siteAiEdit = createServerFn({ method: "POST" })
  .inputValidator((input: SiteAiEditInput) => {
    if (!input?.pageSlug) throw new Error("A page is required.");
    if (!input?.instruction?.trim()) throw new Error("An instruction is required.");
    if (!Array.isArray(input.sections)) throw new Error("Sections are required.");
    return {
      pageSlug: String(input.pageSlug).slice(0, 60),
      instruction: String(input.instruction).slice(0, 2000),
      sections: input.sections.slice(0, 40),
    };
  })
  .handler(async ({ data }): Promise<SiteAiEditResult> => {
    const knownIds = new Set(data.sections.map((s) => s.id));
    if (knownIds.size === 0) {
      return {
        ok: false,
        error: "This page has no editable sections yet. Create sections in the Site Editor first.",
      };
    }

    const prompt = [
      `Page slug: ${data.pageSlug}`,
      `Owner instruction: ${data.instruction}`,
      "",
      "Current sections JSON:",
      JSON.stringify(data.sections),
    ].join("\n");

    const fallback = await callWithFallback(
      {
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 6000,
        timeoutMs: 90_000,
      },
      { perProviderAttempts: 1 },
    );

    if (!fallback.ok) {
      const detail = fallback.attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ");
      return { ok: false, error: `All AI providers failed — ${detail}` };
    }

    let parsed: unknown;
    try {
      parsed = parseJsonObject(fallback.result.text);
    } catch {
      return {
        ok: false,
        error: "The AI did not return valid JSON. Try rephrasing the instruction.",
      };
    }

    const obj = (parsed ?? {}) as { sections?: unknown; summary?: unknown };
    if (!Array.isArray(obj.sections)) {
      return { ok: false, error: "The AI response was missing the sections array." };
    }

    const sections: SiteSection[] = [];
    for (const raw of obj.sections) {
      const clean = sanitizeSection(raw, knownIds);
      if (!clean) {
        return {
          ok: false,
          error:
            "The AI returned a section with an unknown id or invalid type. Nothing was changed.",
        };
      }
      sections.push(clean);
    }
    if (sections.length !== knownIds.size) {
      return {
        ok: false,
        error: "The AI dropped or duplicated sections. Nothing was changed — try again.",
      };
    }

    return {
      ok: true,
      sections: sections.slice().sort((a, b) => a.order - b.order),
      summary: String(obj.summary ?? "Sections updated.").slice(0, 500),
      provider: fallback.result.provider,
      model: fallback.result.model,
    };
  });
