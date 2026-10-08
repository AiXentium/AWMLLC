/**
 * Google Drive behind the shared CloudAdapter contract. Server-only.
 *
 * This is a thin translation layer only — all Drive behaviour keeps living in
 * `src/lib/google/drive.server.ts`, so the existing Drive features are
 * untouched while the shared import/export services can treat both providers
 * identically.
 */
import { requireDriveKey } from "@/lib/google/connections.server";
import {
  createDriveFolder,
  downloadDriveFile,
  driveAccount,
  driveFileMeta,
  ensureDriveFolderPath,
  findDriveFileByName,
  listDriveEntries,
  listDriveFolders,
  updateDriveFileContent,
  uploadDriveFile,
} from "@/lib/google/drive.server";
import { DRIVE_FOLDER_MIME, type DriveFile } from "@/lib/google/drive-shared";
import type { CloudAdapter } from "./adapter.server";
import type { CloudFile } from "./shared";

function toCloudFile(file: DriveFile): CloudFile {
  return {
    id: file.id,
    name: file.name,
    path: file.name,
    isFolder: file.mimeType === DRIVE_FOLDER_MIME,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    modifiedTime: file.modifiedTime,
    // Drive has no rev string; modifiedTime + md5 give the same change signal.
    rev: file.md5 ?? file.modifiedTime,
    contentHash: file.md5,
    webUrl: file.webViewLink,
    folderPath: file.parentId,
    folderName: file.folderName,
  };
}

export async function createGoogleDriveAdapter(userId: string): Promise<CloudAdapter> {
  const key = await requireDriveKey(userId);

  return {
    provider: "google_drive",
    account: () => driveAccount(key),
    async listEntries({ ref, search, cursor }) {
      const res = await listDriveEntries(key, { folderId: ref, search, pageToken: cursor });
      return { files: res.files.map(toCloudFile), nextCursor: res.nextPageToken };
    },
    async listFolders(ref) {
      return (await listDriveFolders(key, ref)).map(toCloudFile);
    },
    async fileMeta(ref) {
      return toCloudFile(await driveFileMeta(key, ref));
    },
    download: (ref) => downloadDriveFile(key, ref),
    async ensureFolderPath(segments) {
      const folder = await ensureDriveFolderPath(key, segments);
      return folder ? toCloudFile(folder) : null;
    },
    async findFileByName(name, folderRef) {
      const file = await findDriveFileByName(key, name, folderRef);
      return file ? toCloudFile(file) : null;
    },
    async uploadFile({ name, mimeType, bytes, folderRef, overwrite }) {
      if (overwrite) {
        const existing = await findDriveFileByName(key, name, folderRef);
        if (existing) {
          return toCloudFile(
            await updateDriveFileContent(key, { fileId: existing.id, mimeType, bytes }),
          );
        }
      }
      return toCloudFile(
        await uploadDriveFile(key, { name, mimeType, bytes, folderId: folderRef }),
      );
    },
    async listFolderContents(ref) {
      const out: CloudFile[] = [];
      let cursor: string | null = null;
      do {
        const page = await listDriveEntries(key, { folderId: ref, pageToken: cursor });
        out.push(...page.files.map(toCloudFile));
        cursor = page.nextPageToken;
      } while (cursor && out.length < 1000);
      return out;
    },
  };
}

export { createDriveFolder };
