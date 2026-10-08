/** Shared (client + server) rules for prospect quote-request document uploads. */

export const QUOTE_UPLOAD_BUCKET = "quote-uploads";

export const QUOTE_MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per file
export const QUOTE_MAX_FILES = 20;

export const QUOTE_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
] as const;

export const QUOTE_ACCEPT_ATTRIBUTE = QUOTE_ACCEPTED_EXTENSIONS.join(",");

export type QuoteFileKind = "pdf" | "zip" | "image" | "document";

export function quoteFileKind(name: string): QuoteFileKind | null {
  const ext = extensionOf(name);
  if (ext === ".pdf") return "pdf";
  if (ext === ".zip") return "zip";
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(ext)) return "image";
  if ([".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"].includes(ext)) return "document";
  return null;
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/** Strips directory traversal and unsafe characters from an uploaded filename. */
export function sanitizeQuoteFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/_{2,}/g, "_")
    .trim();
  const safe = cleaned.replace(/^\.+/, "").slice(0, 180);
  return safe.length ? safe : "file";
}

export function validateQuoteFile(name: string, sizeBytes: number): string | null {
  if (!quoteFileKind(name)) {
    return "Unsupported file type. Upload PDF, ZIP, image, or common document files.";
  }
  if (sizeBytes <= 0) return "That file is empty (0 bytes).";
  if (sizeBytes > QUOTE_MAX_FILE_BYTES) {
    return `Files are limited to ${Math.round(QUOTE_MAX_FILE_BYTES / (1024 * 1024))} MB each.`;
  }
  return null;
}
