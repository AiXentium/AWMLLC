import { createSHA256 } from "hash-wasm";

const SLICE = 8 * 1024 * 1024;

/**
 * Streams a file through SHA-256 in 8 MB slices so multi-hundred-MB plan sets
 * are never fully materialised in browser memory.
 */
export async function checksumFile(
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: { cancelled: boolean },
): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  let offset = 0;
  while (offset < file.size) {
    if (signal?.cancelled) throw new Error("Cancelled");
    const end = Math.min(offset + SLICE, file.size);
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    hasher.update(chunk);
    offset = end;
    onProgress?.(file.size ? offset / file.size : 1);
  }
  return hasher.digest("hex");
}
