/**
 * Automatic PDF splitting for the Supabase Free 50 MB per-file storage cap.
 *
 * Plan sets routinely exceed 50 MB. Instead of failing the upload (or asking
 * the user to split files by hand every time), oversized PDFs are split into
 * sequentially-named parts here in the browser before they reach the queue:
 *   "Set.pdf" → "Set.part1.pdf", "Set.part2.pdf", …
 *
 * Each part stays under MAX_PART_BYTES so every storage backend accepts it.
 * Splitting is lossless — pages are copied verbatim, no re-rendering.
 */

/** Target ceiling per part — comfortably under the 50 MB platform cap. */
export const MAX_PART_BYTES = 45 * 1024 * 1024;

export function needsSplit(file: File): boolean {
  return /\.pdf$/i.test(file.name) && file.size > MAX_PART_BYTES;
}

/**
 * Splits a PDF into sequentially-named parts, each under MAX_PART_BYTES.
 * Returns the original file untouched when no split is needed.
 * pdf-lib is loaded lazily so the main bundle stays lean.
 */
export async function splitPdfIfNeeded(file: File): Promise<File[]> {
  if (!needsSplit(file)) return [file];

  const { PDFDocument } = await import("pdf-lib");
  const srcBytes = await file.arrayBuffer();
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  if (totalPages <= 1) return [file]; // single huge page — nothing to split

  const baseName = file.name.replace(/\.pdf$/i, "");
  // Initial guess: assume pages are roughly uniform in size.
  const guessPerChunk = Math.max(1, Math.floor((totalPages * MAX_PART_BYTES) / file.size));

  const parts: File[] = [];
  let start = 0;
  let partNum = 1;

  while (start < totalPages) {
    let end = Math.min(start + guessPerChunk, totalPages);
    let chunkBytes: Uint8Array | null = null;

    // Shrink the window until the serialized part fits (binary halving).
    while (end > start) {
      const doc = await PDFDocument.create();
      const indices = Array.from({ length: end - start }, (_, i) => start + i);
      const pages = await doc.copyPages(src, indices);
      pages.forEach((p) => doc.addPage(p));
      const data = await doc.save();
      if (data.length <= MAX_PART_BYTES || end - start === 1) {
        chunkBytes = data;
        break;
      }
      end = start + Math.max(1, Math.floor((end - start) / 2));
    }

    if (!chunkBytes) break; // safety — should not happen
    parts.push(
      new File([chunkBytes], `${baseName}.part${partNum}.pdf`, { type: "application/pdf" }),
    );
    start = end;
    partNum++;
  }

  return parts.length > 1 ? parts : [file];
}
