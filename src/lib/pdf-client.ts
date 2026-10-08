// Browser-only PDF.js helpers. Always import dynamically from client code paths.
import type { PDFDocumentProxy } from "pdfjs-dist";
import { memoryManager } from "./memory-manager";

let libPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function getPdfjs() {
  if (!libPromise) {
    libPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return libPromise;
}

export async function loadPdfFromData(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const lib = await getPdfjs();
  return lib.getDocument({ data }).promise;
}

export async function loadPdfFromUrl(url: string, timeoutMs = 90000): Promise<PDFDocumentProxy> {
  const lib = await getPdfjs();
  // rangeChunkSize enables HTTP range streaming so the first page can render
  // before the whole file downloads (Supabase Storage supports Range).
  const loadPromise = lib.getDocument({ url, rangeChunkSize: 65536 }).promise;
  // Fail fast instead of hanging forever on a stalled download — the caller
  // surfaces this as a scan error with a retry option.
  const timeoutPromise = new Promise<never>((_, reject) =>
    window.setTimeout(
      () =>
        reject(
          new Error(
            `PDF download timed out after ${Math.round(timeoutMs / 1000)}s — the file may be too large or the connection stalled`,
          ),
        ),
      timeoutMs,
    ),
  );
  const pdf = await Promise.race([loadPromise, timeoutPromise]);
  // Safety net: register with the memory manager so a leaked PDF is reclaimed
  // by LRU eviction / heap-pressure watching even if a caller forgets destroy.
  // Callers (ViewerTab) still destroy explicitly on document switch — this is
  // the backstop, and destroy() is idempotent so double-dispose is safe.
  memoryManager.register(`pdf:${url}`, () => pdf.destroy().catch(() => undefined), {
    label: "pdf",
  });
  return pdf;
}

export type RenderedPage = { blob: Blob; width: number; height: number };

export async function renderPageToBlob(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
  quality = 0.7,
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  page.cleanup();
  if (!blob) throw new Error("Could not encode page thumbnail");
  return { blob, width: base.width, height: base.height };
}

/**
 * PDF.js refuses to run two render() calls against the same canvas. Zoom, page
 * switches and re-mounts can overlap, so the previous task for a canvas is
 * cancelled (and awaited) before the next one starts.
 */
type CancellableRender = { cancel: () => void; promise: Promise<unknown> };
const activeRenders = new WeakMap<HTMLCanvasElement, CancellableRender>();

function isCancelled(err: unknown) {
  return err instanceof Error && err.name === "RenderingCancelledException";
}

export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement,
) {
  const previous = activeRenders.get(canvas);
  if (previous) {
    previous.cancel();
    await previous.promise.catch(() => undefined);
  }

  const page = await pdf.getPage(pageNumber);
  // Cap the render resolution so high zoom on large sheets can't blow past
  // browser canvas memory (a 36"x24" sheet at 4x zoom would otherwise be ~287MB).
  const base = page.getViewport({ scale: 1 });
  const MAX_PIXELS = 16_000_000;
  const cappedScale = Math.min(scale, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
  const viewport = page.getViewport({ scale: cappedScale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);

  const task = page.render({ canvasContext: context, viewport });
  activeRenders.set(canvas, {
    cancel: () => task.cancel(),
    promise: task.promise,
  });
  try {
    await task.promise;
  } catch (err) {
    if (isCancelled(err)) return { width: canvas.width, height: canvas.height, cancelled: true };
    throw err;
  } finally {
    if (activeRenders.get(canvas)?.promise === task.promise) activeRenders.delete(canvas);
    page.cleanup();
  }
  return { width: canvas.width, height: canvas.height, cancelled: false };
}

/** Embedded text layer of a page, flattened to plain lines. Empty for scanned sheets. */
export async function extractPageText(pdf: PDFDocumentProxy, pageNumber: number, limit = 8000) {
  const page = await pdf.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    const parts: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items as {
      str?: string;
      transform?: number[];
    }[]) {
      const str = item.str ?? "";
      if (!str.trim()) continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) parts.push("\n");
      parts.push(str, " ");
      lastY = y;
    }
    return parts
      .join("")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, limit);
  } finally {
    page.cleanup();
  }
}

/** Renders a page to a JPEG data URL — used when a sheet has no embedded text. */
export async function renderPageToDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 1500,
  quality = 0.75,
) {
  const { blob } = await renderPageToBlob(pdf, pageNumber, targetWidth, quality);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not encode sheet image"));
    reader.readAsDataURL(blob);
  });
}
