/**
 * Layer 1 — native PDF text extraction (pdfjs-dist, already a dependency).
 *
 * CAD-exported plans (Revit, AutoCAD) embed real text: this is 100% accurate
 * and costs nothing. Returns word-level blocks with approximate bounding
 * boxes in PDF points so every extracted value traces back to a location
 * on the page.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { OcrBlock, OcrBox } from "./types";

type TextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function boxFor(item: TextItem, pageHeight: number): OcrBox | null {
  const t = item.transform;
  if (!t || t.length < 6) return null;
  const x = t[4];
  const yTop = pageHeight - t[5];
  const w = item.width ?? 0;
  const h = item.height ?? 10;
  return { x0: x, y0: yTop - h, x1: x + w, y1: yTop };
}

export async function extractPageBlocks(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<{ blocks: OcrBlock[]; charCount: number }> {
  const page: PDFPageProxy = await pdf.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const blocks: OcrBlock[] = [];
    let charCount = 0;
    for (const raw of content.items as TextItem[]) {
      const str = raw.str ?? "";
      if (!str.trim()) continue;
      charCount += str.trim().length;
      blocks.push({
        text: str,
        confidence: 100,
        box: boxFor(raw, viewport.height),
        source: "pdf-text",
        needsReview: false,
      });
    }
    return { blocks, charCount };
  } finally {
    page.cleanup();
  }
}
