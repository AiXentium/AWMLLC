/**
 * Layer 2 — Tesseract OCR for scanned sheets (no embedded text layer).
 *
 * Tesseract.js runs fully in the browser (WebAssembly + worker) — free,
 * no API key, no uploads. It is lazily loaded so the main bundle stays
 * lean; if it fails to load, the caller falls back to the vision model
 * and flags the sheet for review.
 *
 * Every word comes back with a confidence score and bounding box.
 * Words below threshold are kept verbatim but flagged needsReview —
 * the pipeline shows them as unverified, never silently corrected.
 */
import type { OcrBlock } from "./types";
import { gateBlocks } from "./guardrails";

type TessWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

/** OCRs a page image (data URL). Throws when Tesseract cannot run. */
export async function ocrImage(dataUrl: string): Promise<OcrBlock[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(dataUrl);
  const words: TessWord[] = (data.words ?? []).filter(
    (w: TessWord) => w.text && w.text.trim().length > 0,
  );
  const blocks: OcrBlock[] = words.map((w) => ({
    text: w.text,
    confidence: Math.round(w.confidence),
    box: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
    source: "tesseract" as const,
    needsReview: false,
  }));
  return gateBlocks(blocks);
}

/** True when the tesseract.js module can be loaded in this environment. */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await import("tesseract.js");
    return true;
  } catch {
    return false;
  }
}
