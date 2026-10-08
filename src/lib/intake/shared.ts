/**
 * Shared, environment-agnostic intake helpers.
 * Safe to import from browser code and from server function handlers.
 */

export const DOCUMENT_CATEGORIES = [
  "Architectural",
  "Structural",
  "Civil",
  "MEP",
  "Window Schedule",
  "Door Schedule",
  "Specifications",
  "Addendum",
  "Shop Drawings",
  "Other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type IntakeFileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "queued"
  | "extracting"
  | "extracting_pages"
  | "generating_thumbnails"
  | "ready"
  | "duplicate"
  | "ignored"
  | "partially_failed"
  | "failed"
  | "cancelled";

export type IntakeLimits = {
  maxPdfBytes: number;
  maxZipBytes: number;
  maxArchiveEntries: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
  /** Largest single file the worker will decompress out of an archive. */
  maxArchiveMemberBytes: number;
};

export const FALLBACK_LIMITS: IntakeLimits = {
  maxPdfBytes: 1024 * 1024 * 1024,
  maxZipBytes: 100 * 1024 * 1024,
  maxArchiveEntries: 2000,
  maxUncompressedBytes: 1536 * 1024 * 1024,
  maxCompressionRatio: 120,
  maxArchiveMemberBytes: 80 * 1024 * 1024,
};

/** Strips directories, control characters and shell-hostile characters from a name. */
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned.replace(/^\.+/, "").slice(0, 180);
  return safe.length ? safe : "file";
}

/**
 * Normalizes an archive entry path. Returns null when the path escapes the
 * archive root (zip-slip), is absolute, or contains a drive letter.
 */
export function sanitizeArchivePath(raw: string): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const parts: string[] = [];
  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(segment)) return null;
    parts.push(segment);
  }
  if (!parts.length) return null;
  return parts.join("/");
}

/** The folder portion of an archive entry path ("" when at the root). */
export function archiveFolderOf(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function isPdfName(name: string) {
  return /\.pdf$/i.test(name);
}

export function isZipName(name: string) {
  return /\.zip$/i.test(name);
}

/** Best-effort discipline inference from a file or folder name. */
export function inferCategory(fullPath: string): DocumentCategory {
  const value = fullPath.toLowerCase();
  const test = (patterns: RegExp[]) => patterns.some((p) => p.test(value));

  if (test([/window\s*schedule/, /\bwin[-_ ]?sched/, /schedule.*window/])) return "Window Schedule";
  if (test([/door\s*schedule/, /\bdoor[-_ ]?sched/, /schedule.*door/])) return "Door Schedule";
  if (test([/addend/, /\basi\b/, /bulletin/])) return "Addendum";
  if (test([/shop\s*draw/, /submittal/, /\bshops?\b/])) return "Shop Drawings";
  if (test([/spec(ification)?s?\b/, /division\s*\d/, /\bcsi\b/])) return "Specifications";
  if (test([/structural/, /\bs-?\d/, /framing/, /foundation/])) return "Structural";
  if (test([/civil/, /\bc-?\d/, /site\s*plan/, /grading/, /drainage/, /paving/])) return "Civil";
  if (
    test([
      /mechanical/,
      /electrical/,
      /plumbing/,
      /\bmep\b/,
      /\bhvac\b/,
      /\bm-?\d/,
      /\be-?\d/,
      /\bp-?\d/,
    ])
  )
    return "MEP";
  if (
    test([
      /architect/,
      /\ba-?\d/,
      /floor\s*plan/,
      /elevation/,
      /\bplan\s*set/,
      /reflected\s*ceiling/,
    ])
  )
    return "Architectural";
  return "Other";
}

/**
 * Normalized key used to spot likely revisions of the same drawing:
 * strips revision markers, dates, and separators from the filename stem.
 */
export function revisionKey(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/\b(rev|revision|r|v|ver|version)[\s._-]*\d+[a-z]?\b/g, "")
    .replace(/\b\d{1,2}[-._]\d{1,2}[-._]\d{2,4}\b/g, "")
    .replace(/\b\d{4}[-._]\d{2}[-._]\d{2}\b/g, "")
    .replace(/\b(final|draft|copy|updated?|new|old)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function displayNameFromFilename(filename: string) {
  return (
    sanitizeFilename(filename)
      .replace(/\.pdf$/i, "")
      .slice(0, 140) || "Plan set"
  );
}

/** True when the first bytes are a PDF header. */
export function hasPdfSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** True when the first bytes are a ZIP local-file / empty-archive header. */
export function hasZipSignature(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  const [a, b, c, d] = bytes;
  return (
    a === 0x50 &&
    b === 0x4b &&
    (c === 0x03 || c === 0x05 || c === 0x07) &&
    (d === 0x04 || d === 0x06 || d === 0x08)
  );
}

export const INTAKE_TERMINAL_STATUSES: IntakeFileStatus[] = [
  "ready",
  "duplicate",
  "ignored",
  "failed",
  "cancelled",
  "partially_failed",
];

export function intakeStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Queued",
    uploading: "Uploading",
    uploaded: "Uploaded",
    queued: "Queued for processing",
    extracting: "Extracting archive",
    extracting_pages: "Extracting pages",
    generating_thumbnails: "Generating thumbnails",
    ready: "Ready",
    duplicate: "Duplicate",
    ignored: "Ignored",
    partially_failed: "Partially failed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}
