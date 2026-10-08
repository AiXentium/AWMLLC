/**
 * Client-side PDF text extraction for the Import Blueprint flow.
 * Reads the first few pages of a plan PDF so the AI can identify the project
 * (name, address, architect, etc.) before the project record exists.
 */
import * as pdfjs from "pdfjs-dist";

// Use the bundled worker from the installed pdfjs-dist package.
// @ts-expect-error — pdfjs-dist exposes the worker entry without types here
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;
function ensureWorker() {
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
}

export type PdfTextSample = {
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
  /** True when the PDF had no extractable text (scanned images). */
  isScanned: boolean;
};

/** Extracts text from the first `maxPages` pages of a PDF file. */
export async function extractPdfTextSample(file: File, maxPages = 3): Promise<PdfTextSample> {
  ensureWorker();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = pdf.numPages;
  const pages: { pageNumber: number; text: string }[] = [];

  const limit = Math.min(pageCount, maxPages);
  for (let n = 1; n <= limit; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
    pages.push({ pageNumber: n, text });
    page.cleanup();
  }
  await pdf.destroy().catch(() => undefined);

  const isScanned = pages.every((p) => p.text.length < 40);
  return { pageCount, pages, isScanned };
}
