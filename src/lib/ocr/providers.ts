/**
 * Layer 2.5 — paid OCR providers (API key ready).
 *
 * Google Document AI and Azure Document Intelligence are the best OCR
 * engines on the market for document layout, tables and handwriting.
 * Both are fully coded here — the ONLY thing needed to activate one is
 * its API credentials in the environment:
 *
 * Google Document AI:
 *   VITE_GOOGLE_DOCAI_API_KEY
 *   VITE_GOOGLE_DOCAI_PROJECT        (GCP project id)
 *   VITE_GOOGLE_DOCAI_LOCATION       (e.g. "us")
 *   VITE_GOOGLE_DOCAI_PROCESSOR_ID   (OCR processor id)
 *
 * Azure Document Intelligence:
 *   VITE_AZURE_DOCINTEL_ENDPOINT     (e.g. https://myresource.cognitiveservices.azure.com)
 *   VITE_AZURE_DOCINTEL_KEY
 *
 * Set either pair and the reader prefers it over Tesseract automatically.
 * Set neither and the system stays on the free stack — nothing breaks.
 *
 * Security note: these keys are read client-side for Washington's internal
 * tool. If this ever becomes multi-user, move the calls to a server
 * function and keep the keys server-side.
 */
import type { OcrBlock, OcrBox } from "./types";
import { gateBlocks } from "./guardrails";

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i === -1 ? dataUrl : dataUrl.slice(i + 1);
}

function boxFromPoints(points: { x: number; y: number }[], w: number, h: number): OcrBox {
  const xs = points.map((p) => p.x * w);
  const ys = points.map((p) => p.y * h);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

// ---------------------------------------------------------------------------
// Google Document AI
// ---------------------------------------------------------------------------

export function googleDocAiConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_GOOGLE_DOCAI_API_KEY &&
    import.meta.env.VITE_GOOGLE_DOCAI_PROJECT &&
    import.meta.env.VITE_GOOGLE_DOCAI_LOCATION &&
    import.meta.env.VITE_GOOGLE_DOCAI_PROCESSOR_ID,
  );
}

type DocAiBlock = {
  layout?: {
    textAnchor?: { textSegments?: { startIndex?: string; endIndex?: string }[] };
    confidence?: number;
    boundingPoly?: { normalizedVertices?: { x?: number; y?: number }[] };
  };
};

export async function googleDocAiOcr(
  dataUrl: string,
  imgW: number,
  imgH: number,
): Promise<OcrBlock[]> {
  const key = import.meta.env.VITE_GOOGLE_DOCAI_API_KEY as string;
  const project = import.meta.env.VITE_GOOGLE_DOCAI_PROJECT as string;
  const location = import.meta.env.VITE_GOOGLE_DOCAI_LOCATION as string;
  const processor = import.meta.env.VITE_GOOGLE_DOCAI_PROCESSOR_ID as string;
  const url =
    `https://${location}-documentai.googleapis.com/v1` +
    `/projects/${project}/locations/${location}/processors/${processor}:process?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawDocument: { content: dataUrlToBase64(dataUrl), mimeType: "image/jpeg" },
    }),
  });
  if (!res.ok) throw new Error(`Document AI failed: ${res.status}`);
  const json = await res.json();
  const fullText: string = json.document?.text ?? "";
  const blocks: OcrBlock[] = [];
  for (const page of json.document?.pages ?? []) {
    for (const b of (page.blocks ?? []) as DocAiBlock[]) {
      const seg = b.layout?.textAnchor?.textSegments?.[0];
      if (!seg) continue;
      const start = Number(seg.startIndex ?? 0);
      const end = Number(seg.endIndex ?? 0);
      const text = fullText.slice(start, end).trim();
      if (!text) continue;
      const verts = (b.layout?.boundingPoly?.normalizedVertices ?? []).map((v) => ({
        x: v.x ?? 0,
        y: v.y ?? 0,
      }));
      blocks.push({
        text,
        confidence: Math.round((b.layout?.confidence ?? 0) * 100),
        box: verts.length ? boxFromPoints(verts, imgW, imgH) : null,
        source: "google-document-ai",
        needsReview: false,
      });
    }
  }
  return gateBlocks(blocks);
}

// ---------------------------------------------------------------------------
// Azure Document Intelligence (prebuilt-read)
// ---------------------------------------------------------------------------

export function azureDocIntelConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_AZURE_DOCINTEL_ENDPOINT && import.meta.env.VITE_AZURE_DOCINTEL_KEY,
  );
}

type AzureWord = { content?: string; confidence?: number; polygon?: number[] };

async function azurePoll(operationUrl: string, key: string): Promise<AzureWord[]> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(operationUrl, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!res.ok) throw new Error(`Document Intelligence poll failed: ${res.status}`);
    const json = await res.json();
    if (json.status === "succeeded") {
      const words: AzureWord[] = [];
      for (const page of json.analyzeResult?.pages ?? []) {
        for (const w of (page.words ?? []) as AzureWord[]) words.push(w);
      }
      return words;
    }
    if (json.status === "failed") throw new Error("Document Intelligence analysis failed");
  }
  throw new Error("Document Intelligence timed out");
}

export async function azureDocIntelOcr(
  dataUrl: string,
  imgW: number,
  imgH: number,
): Promise<OcrBlock[]> {
  const endpoint = (import.meta.env.VITE_AZURE_DOCINTEL_ENDPOINT as string).replace(/\/$/, "");
  const key = import.meta.env.VITE_AZURE_DOCINTEL_KEY as string;
  const url = `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": key,
    },
    body: JSON.stringify({ base64Source: dataUrlToBase64(dataUrl) }),
  });
  if (res.status !== 202) throw new Error(`Document Intelligence failed: ${res.status}`);
  const operationUrl = res.headers.get("Operation-Location");
  if (!operationUrl) throw new Error("Document Intelligence returned no operation URL");
  const words = await azurePoll(operationUrl, key);
  const blocks: OcrBlock[] = [];
  for (const w of words) {
    const text = (w.content ?? "").trim();
    if (!text) continue;
    const poly = w.polygon ?? [];
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < poly.length; i += 2)
      pts.push({ x: poly[i] / imgW, y: poly[i + 1] / imgH });
    blocks.push({
      text,
      confidence: Math.round((w.confidence ?? 0) * 100),
      box: pts.length ? boxFromPoints(pts, imgW, imgH) : null,
      source: "azure-document-intelligence",
      needsReview: false,
    });
  }
  return gateBlocks(blocks);
}

// ---------------------------------------------------------------------------
// Dispatcher — prefers whichever paid provider is configured.
// ---------------------------------------------------------------------------

export function paidOcrAvailable(): boolean {
  return googleDocAiConfigured() || azureDocIntelConfigured();
}

export function paidOcrName(): string | null {
  if (googleDocAiConfigured()) return "google-document-ai";
  if (azureDocIntelConfigured()) return "azure-document-intelligence";
  return null;
}

/** Runs the configured paid OCR. Throws when none is configured. */
export async function paidOcr(dataUrl: string, imgW: number, imgH: number): Promise<OcrBlock[]> {
  if (googleDocAiConfigured()) return googleDocAiOcr(dataUrl, imgW, imgH);
  if (azureDocIntelConfigured()) return azureDocIntelOcr(dataUrl, imgW, imgH);
  throw new Error("No paid OCR provider configured — set the API credentials.");
}
