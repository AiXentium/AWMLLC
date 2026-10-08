/**
 * Browser-safe Google Drive integration types and constants.
 * No secrets, no server-only imports — safe to import from components.
 */

export const GOOGLE_DRIVE_CONNECTOR_ID = "google_drive";

/**
 * Smallest scope set that supports the two features we ship:
 *  - drive.readonly : browse and copy the user's existing plan sets into AWM
 *  - drive.file     : create/update only the files AWM itself writes back
 */
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

/** Largest single Drive file the server will stream into project storage. */
export const DRIVE_IMPORT_MAX_BYTES = 200 * 1024 * 1024;

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveStatus =
  | { configured: false; connected: false; reason: string }
  | { configured: true; connected: false }
  | {
      configured: true;
      connected: true;
      accountEmail: string | null;
      accountName: string | null;
      connectedAt: string | null;
    };

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  iconLink: string | null;
  parentId: string | null;
  folderName: string | null;
  md5: string | null;
};

export type DriveImportResult =
  | { ok: true; kind: "pdf"; duplicate: false; documentId: string; intakeFileId: string }
  | { ok: true; kind: "pdf"; duplicate: true; existingName: string; intakeFileId: string }
  | { ok: true; kind: "zip"; accepted: number; duplicates: number; ignored: number; failed: number }
  | { ok: false; reason: string };

export function driveRootFolderName(projectName: string) {
  return `AWM Coastal Windows / ${projectName || "Project"}`;
}

export function isImportableDriveFile(file: DriveFile) {
  return (
    file.mimeType === "application/pdf" ||
    /\.pdf$/i.test(file.name) ||
    file.mimeType === "application/zip" ||
    file.mimeType === "application/x-zip-compressed" ||
    /\.zip$/i.test(file.name)
  );
}
