/**
 * Unified page reader — the single entry point for reading plan sheets.
 *
 * Strategy (best available, free-first):
 *   1. PDF text layer (pdfjs-dist) — exact, free, instant. Used when the
 *      sheet has embedded text (most CAD exports).
 *   2. Paid OCR (Google Document AI / Azure Document Intelligence) — used
 *      when API credentials are configured. Best accuracy for scans,
 *      tables and handwriting.
 *   3. Tesseract OCR (in-browser, free) — used when no paid provider is
 *      configured. Word-level confidences; low confidence blocks flagged.
 *   4. Vision AI (existing provider rotation) — the runner still sends
 *      images for schedule reading, but the OCR text goes with them so
 *      the model quotes the transcription instead of inventing.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OcrBlock, OcrPageResult } from "./types";
import { EMPTY_OCR } from "./types";
import { extractPageBlocks } from "./pdf-text";
import { renderPageToBlob } from "@/lib/pdf-client";
import { gateBlocks } from "./guardrails";
import { paidOcr, paidOcrAvailable, paidOcrName } from "./providers";

/** Sheets with fewer than this many text-layer chars get the OCR pass. */
export const OCR_FALLBACK_MIN_CHARS = 50;

function joinBlocks(blocks: OcrBlock[]): string {
  return blocks
    .map((b) => b.text)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarize(
  pageNumber: number,
  blocks: OcrBlock[],
  source: OcrPageResult["source"],
): OcrPageResult {
  const gated = gateBlocks(blocks);
  const text = joinBlocks(gated);
  const avg =
    gated.length === 0
      ? -1
      : Math.round(gated.reduce((s, b) => s + b.confidence, 0) / gated.length);
  return {
    pageNumber,
    source,
    blocks: gated,
    text,
    avgConfidence: avg,
    needsReview: gated.some((b) => b.needsReview) || gated.length === 0,
    charCount: text.length,
  };
}

/**
 * Reads one sheet: text layer first, paid OCR when configured, Tesseract
 * fallback for scans. Never throws — returns EMPTY_OCR (flagged for
 * review) on failure.
 */
export async function readPageWithOcr(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  opts: { minChars?: number; ocrWidth?: number } = {},
): Promise<OcrPageResult> {
  const minChars = opts.minChars ?? OCR_FALLBACK_MIN_CHARS;
  try {
    const { blocks, charCount } = await extractPageBlocks(pdf, pageNumber);
    if (charCount >= minChars) {
      return summarize(pageNumber, blocks, "pdf-text");
    }
    // Thin or missing text layer — scanned sheet. Render once and OCR it:
    // paid provider first (best), Tesseract second (free).
    const width = opts.ocrWidth ?? 1800;
    const rendered = await renderPageToBlob(pdf, pageNumber, width).catch(() => null);
    if (rendered) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not encode sheet image"));
        reader.readAsDataURL(rendered.blob);
      }).catch(() => null);
      if (dataUrl) {
        // renderPageToBlob reports base (scale-1) dims; scale up to rendered pixels.
        const scale = width / rendered.width;
        const imgW = width;
        const imgH = Math.round(rendered.height * scale);
        if (paidOcrAvailable()) {
          try {
            const paidBlocks = await paidOcr(dataUrl, imgW, imgH);
            if (paidBlocks.length > 0) {
              const name = paidOcrName();
              return summarize(
                pageNumber,
                paidBlocks,
                name === "azure-document-intelligence"
                  ? "azure-document-intelligence"
                  : "google-document-ai",
              );
            }
          } catch {
            // Paid OCR failed — fall through to Tesseract.
          }
        }
        try {
          const { ocrImage } = await import("./tesseract");
          const ocrBlocks = await ocrImage(dataUrl);
          if (ocrBlocks.length > 0) {
            return summarize(pageNumber, ocrBlocks, "tesseract");
          }
        } catch {
          // Tesseract unavailable — fall through to whatever text layer exists.
        }
      }
    }
    if (blocks.length > 0) return summarize(pageNumber, blocks, "pdf-text");
    return { ...EMPTY_OCR, pageNumber };
  } catch {
    return { ...EMPTY_OCR, pageNumber };
  }
}
