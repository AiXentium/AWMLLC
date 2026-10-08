/**
 * Provider-agnostic cloud-storage types.
 *
 * Browser-safe: no secrets, no server-only imports. Dropbox ships on this
 * interface today; Google Drive is wrapped by the same adapter so both
 * providers can share one import/export pipeline instead of duplicating logic.
 */

export type CloudProviderId = "dropbox" | "google_drive";

export const CLOUD_PROVIDER_LABELS: Record<CloudProviderId, string> = {
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

/** Where a project document originally came from. */
export type DocumentSource = "local" | CloudProviderId;

export const DOCUMENT_SOURCE_LABELS: Record<DocumentSource, string> = {
  local: "Local Upload",
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

/** One file or folder in a connected cloud account. */
export type CloudFile = {
  /** Stable provider handle used for reads (Drive file id, Dropbox path). */
  id: string;
  name: string;
  /** Full provider path when the provider is path-based, else "". */
  path: string;
  isFolder: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  modifiedTime: string | null;
  /** Provider revision marker — changes whenever the file content changes. */
  rev: string | null;
  /** Provider-side content hash when available (used for revision detection). */
  contentHash: string | null;
  webUrl: string | null;
  folderPath: string | null;
  folderName: string | null;
};

export type CloudStatus =
  | { configured: false; connected: false; reason: string }
  | { configured: true; connected: false }
  | {
      configured: true;
      connected: true;
      accountEmail: string | null;
      accountName: string | null;
      connectedAt: string | null;
    };

export type CloudImportResult =
  | {
      ok: true;
      kind: "pdf";
      outcome: "imported" | "revision";
      documentId: string;
      intakeFileId: string;
      revisionNumber: number;
    }
  | { ok: true; kind: "pdf"; outcome: "duplicate"; existingName: string; intakeFileId: string }
  | { ok: true; kind: "pdf"; outcome: "unchanged"; existingName: string }
  | {
      ok: true;
      kind: "zip";
      outcome: "imported";
      accepted: number;
      duplicates: number;
      ignored: number;
      failed: number;
    }
  | { ok: false; reason: string };

export type CloudSyncSummary = {
  checked: number;
  updates: number;
  added: number;
  removed: number;
  renamed: number;
  errors: number;
  message: string;
};

/** Largest single cloud file the server will stream into project storage. */
export const CLOUD_IMPORT_MAX_BYTES = 200 * 1024 * 1024;

export function isImportableCloudFile(file: CloudFile) {
  if (file.isFolder) return false;
  return (
    /\.pdf$/i.test(file.name) ||
    /\.zip$/i.test(file.name) ||
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/zip" ||
    file.mimeType === "application/x-zip-compressed"
  );
}

export function cloudSyncStatusLabel(status: string | null | undefined) {
  const map: Record<string, string> = {
    idle: "Not checked yet",
    checking: "Checking for updates…",
    synced: "Up to date",
    updates_available: "Updates available",
    error: "Last check failed",
  };
  return map[status ?? "idle"] ?? "Not checked yet";
}
