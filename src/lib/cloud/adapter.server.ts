/**
 * Shared cloud-storage adapter contract.
 *
 * Every provider (Dropbox today, Google Drive wrapped here, others later)
 * implements this one interface so the import, revision and export services
 * stay provider-neutral. Server-only: adapters hold live credentials.
 */
import type { CloudFile, CloudProviderId } from "./shared";

export interface CloudAdapter {
  provider: CloudProviderId;
  /** Human label for the connected account. */
  account(): Promise<{ email: string | null; name: string | null }>;
  /** Lists folders + importable files. `ref` is a folder handle (null = root). */
  listEntries(input: {
    ref?: string | null;
    search?: string | null;
    cursor?: string | null;
  }): Promise<{ files: CloudFile[]; nextCursor: string | null }>;
  /** Folders only — used by the "save export to…" folder picker. */
  listFolders(ref: string | null): Promise<CloudFile[]>;
  fileMeta(ref: string): Promise<CloudFile>;
  download(ref: string): Promise<Uint8Array>;
  /** Creates the nested folder path if missing and returns the leaf. */
  ensureFolderPath(segments: string[]): Promise<CloudFile | null>;
  findFileByName(name: string, folderRef: string | null): Promise<CloudFile | null>;
  uploadFile(input: {
    name: string;
    mimeType: string;
    bytes: Uint8Array;
    folderRef: string | null;
    /** Replace the existing file (keeping provider version history) when true. */
    overwrite?: boolean;
  }): Promise<CloudFile>;
  /** Lists every importable file inside a linked folder, for sync. */
  listFolderContents(ref: string | null): Promise<CloudFile[]>;
}

/** Resolves the adapter for a provider on behalf of one signed-in app user. */
export async function getCloudAdapter(
  provider: CloudProviderId,
  userId: string,
): Promise<CloudAdapter> {
  if (provider === "dropbox") {
    const { createDropboxAdapter } = await import("@/lib/dropbox/dropbox-adapter.server");
    return createDropboxAdapter(userId);
  }
  const { createGoogleDriveAdapter } = await import("./google-adapter.server");
  return createGoogleDriveAdapter(userId);
}
