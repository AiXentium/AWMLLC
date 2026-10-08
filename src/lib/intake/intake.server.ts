/**
 * Server-only archive inspection and extraction helpers.
 * Never imported by client code (blocked by the *.server.ts filename rule).
 */
import { unzipSync } from "fflate";
import {
  archiveFolderOf,
  hasPdfSignature,
  hasZipSignature,
  isPdfName,
  sanitizeArchivePath,
  type IntakeLimits,
} from "./shared";

export class ArchiveRejected extends Error {}

export type ArchiveEntry = {
  path: string;
  rawName: string;
  folder: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  encrypted: boolean;
};

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

/**
 * Parses the ZIP central directory without decompressing anything, so that
 * bombs, traversal, encryption and unsupported compression are rejected before
 * a single byte is inflated.
 */
export function readCentralDirectory(bytes: Uint8Array): ArchiveEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const scanFrom = Math.max(0, bytes.length - 66_000);
  for (let i = bytes.length - 22; i >= scanFrom; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new ArchiveRejected(
      "That file is not a readable ZIP archive (no directory record found).",
    );

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset === 0xffffffff || entryCount === 0xffff) {
    throw new ArchiveRejected(
      "ZIP64 archives are not supported yet. Re-zip the plans as a standard archive.",
    );
  }

  const entries: ArchiveEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CEN_SIG) {
      throw new ArchiveRejected("This ZIP archive is malformed and cannot be read safely.");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const rawName = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const path = sanitizeArchivePath(rawName);
    if (rawName && !rawName.endsWith("/") && path === null) {
      throw new ArchiveRejected(
        `This archive contains an unsafe path ("${rawName.slice(0, 60)}") and was rejected.`,
      );
    }
    entries.push({
      path: path ?? "",
      rawName,
      folder: path ? archiveFolderOf(path) : "",
      compressedSize,
      uncompressedSize,
      method,
      encrypted: (flags & 0x1) === 0x1,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export type ArchivePlan = {
  pdfs: ArchiveEntry[];
  ignored: { name: string; reason: string }[];
};

/** Applies every safety limit and splits entries into "extract" vs "ignore". */
export function planArchive(bytes: Uint8Array, limits: IntakeLimits): ArchivePlan {
  if (!hasZipSignature(bytes.subarray(0, 4))) {
    throw new ArchiveRejected("That file is not a ZIP archive (bad file signature).");
  }
  const entries = readCentralDirectory(bytes);
  const files = entries.filter((e) => !e.rawName.endsWith("/"));

  if (files.length > limits.maxArchiveEntries) {
    throw new ArchiveRejected(
      `This archive has ${files.length} entries, more than the ${limits.maxArchiveEntries} allowed. Split it into smaller archives.`,
    );
  }
  if (files.some((e) => e.encrypted)) {
    throw new ArchiveRejected(
      "This archive is password-protected. Remove the password and upload it again — encrypted archives cannot be opened.",
    );
  }

  const totalUncompressed = files.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (totalUncompressed > limits.maxUncompressedBytes) {
    throw new ArchiveRejected(
      "This archive expands to more data than the intake engine will decompress. Split it up.",
    );
  }
  const totalCompressed = Math.max(
    1,
    files.reduce((sum, e) => sum + e.compressedSize, 0),
  );
  if (totalUncompressed / totalCompressed > limits.maxCompressionRatio) {
    throw new ArchiveRejected(
      "This archive was rejected as unsafe: its compression ratio looks like a zip bomb.",
    );
  }

  const pdfs: ArchiveEntry[] = [];
  const ignored: { name: string; reason: string }[] = [];
  for (const entry of files) {
    const name = entry.path || entry.rawName;
    if (/(^|\/)(__MACOSX|\.DS_Store)/i.test(name)) {
      ignored.push({ name, reason: "System file" });
      continue;
    }
    if (!isPdfName(name)) {
      ignored.push({ name, reason: "Unsupported file type" });
      continue;
    }
    if (entry.method !== 0 && entry.method !== 8) {
      ignored.push({ name, reason: "Unsupported compression method" });
      continue;
    }
    if (entry.uncompressedSize > limits.maxArchiveMemberBytes) {
      ignored.push({ name, reason: "PDF inside the archive is too large to extract" });
      continue;
    }
    pdfs.push(entry);
  }
  return { pdfs, ignored };
}

/** Inflates a single archive entry and validates that it really is a PDF. */
export function extractPdfEntry(bytes: Uint8Array, entry: ArchiveEntry): Uint8Array {
  const out = unzipSync(bytes, { filter: (file) => file.name === entry.rawName });
  const data = out[entry.rawName];
  if (!data) throw new Error("Entry could not be decompressed.");
  if (!hasPdfSignature(data.subarray(0, 5)))
    throw new Error("Entry is not a valid PDF (bad file signature).");
  return data;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
