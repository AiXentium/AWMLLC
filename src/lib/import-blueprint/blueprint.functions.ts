import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export type BlueprintMetadata = {
  name: string | null;
  project_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  county: string | null;
  architect: string | null;
  general_contractor: string | null;
  description: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

export type ExtractBlueprintResult =
  | { ok: true; metadata: BlueprintMetadata; provider: string; model: string }
  | { ok: false; error: string };

const SYSTEM = `You are a construction document analyst for AWM LLC, a Florida supplier of YKK AP windows and patio doors.
You are given text extracted from the first pages of a construction plan set (cover sheet / title block area).
Extract the project identity as JSON. Rules:
- Respond with ONLY a JSON object, no markdown fences, no commentary.
- Use null for anything you cannot determine. Never invent an address, name, or firm.
- "name": the project/building name as shown (e.g. "Palm Beach Residence", "Lot 12 Model Sapphire"). Fall back to a short descriptive name derived from the address if no name is shown.
- "project_type": one of: Single Family Residential, Multi-Family Residential, Commercial, Mixed-Use, Renovation/Remodel, or null.
- "confidence": "high" if the title block clearly identifies the project, "medium" if partially legible, "low" if mostly guessing from fragments.
- "notes": one short sentence on what you based the extraction on (e.g. "Title block on sheet A-001").

JSON shape:
{"name":string|null,"project_type":string|null,"address":string|null,"city":string|null,"state":string|null,"postal_code":string|null,"county":string|null,"architect":string|null,"general_contractor":string|null,"description":string|null,"confidence":"high"|"medium"|"low","notes":string|null}`;

function cleanJson(text: string): string {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

/**
 * Reads a text sample from a plan PDF's opening pages and extracts the project
 * identity (name, address, architect, ...) so a project record can be created
 * from the document instead of typed by hand.
 */
export const extractBlueprintMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      filename: string;
      pageCount: number;
      isScanned: boolean;
      pages: { pageNumber: number; text: string }[];
    }) => {
      if (!input || typeof input.filename !== "string" || !input.filename.trim())
        throw new Error("Missing filename.");
      if (!Array.isArray(input.pages) || input.pages.length === 0)
        throw new Error("No page text to analyze.");
      return {
        filename: input.filename.slice(0, 200),
        pageCount: Math.max(1, Math.min(5000, Number(input.pageCount) || 1)),
        isScanned: Boolean(input.isScanned),
        pages: input.pages.slice(0, 5).map((p) => ({
          pageNumber: Number(p.pageNumber) || 0,
          text: String(p.text ?? "").slice(0, 12000),
        })),
      };
    },
  )
  .handler(async ({ data }): Promise<ExtractBlueprintResult> => {
    const { callWithFallback } = await import("@/lib/ai/providers.server");

    const prompt = [
      `Filename: ${data.filename}`,
      `Total pages in set: ${data.pageCount}`,
      data.isScanned
        ? "Note: the PDF pages contain scanned images with no extractable text. Do your best from the filename alone."
        : "Extracted text from the opening pages:",
      ...data.pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text || "(no text)"}`),
    ].join("\n\n");

    // Free-first automatic rotation: OpenRouter → Gemini → Groq, then paid fallbacks.
    const rotated = await callWithFallback({ system: SYSTEM, prompt, maxOutputTokens: 1200 });
    if (!rotated.ok) {
      const detail = rotated.attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ");
      return {
        ok: false,
        error: rotated.attempts.length
          ? `AI extraction failed — ${detail}. Add a free API key (OpenRouter, Gemini, or Groq) in AI Settings.`
          : "No AI provider key is configured. Add a free API key (OpenRouter, Gemini, or Groq) in AI Settings.",
      };
    }

    const { result } = rotated;
    try {
      const parsed = JSON.parse(cleanJson(result.text)) as BlueprintMetadata;
      return {
        ok: true,
        metadata: {
          name: parsed.name ?? null,
          project_type: parsed.project_type ?? null,
          address: parsed.address ?? null,
          city: parsed.city ?? null,
          state: parsed.state ?? null,
          postal_code: parsed.postal_code ?? null,
          county: parsed.county ?? null,
          architect: parsed.architect ?? null,
          general_contractor: parsed.general_contractor ?? null,
          description: parsed.description ?? null,
          confidence: ["high", "medium", "low"].includes(parsed.confidence)
            ? parsed.confidence
            : "low",
          notes: parsed.notes ?? null,
        },
        provider: result.provider,
        model: result.model,
      };
    } catch {
      return {
        ok: false,
        error: `The AI (${result.provider}) returned an unreadable response. Try again.`,
      };
    }
  });
