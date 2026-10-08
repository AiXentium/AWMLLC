/**
 * Google Drive API operations executed as the connected app user through the
 * Lovable connector gateway. Server-only.
 */

import { DRIVE_FOLDER_MIME, type DriveFile } from "./drive-shared";
import { driveApi, driveApiJson } from "./gateway.server";

const FILE_FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents,md5Checksum";

type RawFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  md5Checksum?: string;
};

function toDriveFile(raw: RawFile, folderName: string | null = null): DriveFile {
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    sizeBytes: raw.size ? Number(raw.size) : null,
    modifiedTime: raw.modifiedTime ?? null,
    webViewLink: raw.webViewLink ?? null,
    iconLink: raw.iconLink ?? null,
    parentId: raw.parents?.[0] ?? null,
    folderName,
    md5: raw.md5Checksum ?? null,
  };
}

const COMMON = "supportsAllDrives=true&includeItemsFromAllDrives=true";

export async function driveAccount(key: string) {
  const json = await driveApiJson<{ user?: { emailAddress?: string; displayName?: string } }>(
    key,
    "/drive/v3/about?fields=user",
  );
  return { email: json.user?.emailAddress ?? null, name: json.user?.displayName ?? null };
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listDriveEntries(
  key: string,
  input: { folderId?: string | null; search?: string | null; pageToken?: string | null },
) {
  const clauses = ["trashed = false"];
  if (input.search?.trim()) {
    clauses.push(`name contains '${escapeQuery(input.search.trim())}'`);
    clauses.push(
      `(mimeType = '${DRIVE_FOLDER_MIME}' or mimeType = 'application/pdf' or mimeType contains 'zip')`,
    );
  } else {
    clauses.push(`'${escapeQuery(input.folderId || "root")}' in parents`);
  }
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    fields: `nextPageToken, files(${FILE_FIELDS})`,
    pageSize: "100",
    orderBy: "folder,modifiedTime desc",
  });
  const json = await driveApiJson<{ files?: RawFile[]; nextPageToken?: string }>(
    key,
    `/drive/v3/files?${params.toString()}&${COMMON}`,
  );
  return {
    files: (json.files ?? []).map((f) => toDriveFile(f)),
    nextPageToken: json.nextPageToken ?? null,
  };
}

export async function driveFileMeta(key: string, fileId: string) {
  const raw = await driveApiJson<RawFile>(
    key,
    `/drive/v3/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}&${COMMON}`,
  );
  let folderName: string | null = null;
  if (raw.parents?.[0]) {
    try {
      const parent = await driveApiJson<RawFile>(
        key,
        `/drive/v3/files/${encodeURIComponent(raw.parents[0])}?fields=id,name&${COMMON}`,
      );
      folderName = parent.name;
    } catch {
      folderName = null;
    }
  }
  return toDriveFile(raw, folderName);
}

export async function downloadDriveFile(key: string, fileId: string) {
  const res = await driveApi(
    key,
    `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&${COMMON}`,
  );
  if (!res.ok)
    throw new Error(
      `Could not download the Drive file [${res.status}]: ${(await res.text()).slice(0, 300)}`,
    );
  return new Uint8Array(await res.arrayBuffer());
}

export async function listDriveFolders(key: string, parentId: string | null) {
  const params = new URLSearchParams({
    q: `trashed = false and mimeType = '${DRIVE_FOLDER_MIME}' and '${escapeQuery(parentId || "root")}' in parents`,
    fields: `files(${FILE_FIELDS})`,
    pageSize: "100",
    orderBy: "name",
  });
  const json = await driveApiJson<{ files?: RawFile[] }>(
    key,
    `/drive/v3/files?${params.toString()}&${COMMON}`,
  );
  return (json.files ?? []).map((f) => toDriveFile(f));
}

export async function findDriveFolderByName(key: string, name: string, parentId: string | null) {
  const params = new URLSearchParams({
    q: `trashed = false and mimeType = '${DRIVE_FOLDER_MIME}' and name = '${escapeQuery(name)}' and '${escapeQuery(parentId || "root")}' in parents`,
    fields: `files(${FILE_FIELDS})`,
    pageSize: "1",
  });
  const json = await driveApiJson<{ files?: RawFile[] }>(
    key,
    `/drive/v3/files?${params.toString()}&${COMMON}`,
  );
  return json.files?.[0] ? toDriveFile(json.files[0]) : null;
}

export async function createDriveFolder(key: string, name: string, parentId: string | null) {
  const raw = await driveApiJson<RawFile>(key, `/drive/v3/files?fields=${FILE_FIELDS}&${COMMON}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return toDriveFile(raw);
}

/** Ensures "AWM Coastal Windows / <Project>" style nesting exists. */
export async function ensureDriveFolderPath(key: string, segments: string[]) {
  let parentId: string | null = null;
  let folder: DriveFile | null = null;
  for (const segment of segments) {
    const name = segment.trim();
    if (!name) continue;
    folder =
      (await findDriveFolderByName(key, name, parentId)) ??
      (await createDriveFolder(key, name, parentId));
    parentId = folder.id;
  }
  return folder;
}

export async function findDriveFileByName(key: string, name: string, folderId: string | null) {
  const params = new URLSearchParams({
    q: `trashed = false and name = '${escapeQuery(name)}' and '${escapeQuery(folderId || "root")}' in parents`,
    fields: `files(${FILE_FIELDS})`,
    pageSize: "1",
  });
  const json = await driveApiJson<{ files?: RawFile[] }>(
    key,
    `/drive/v3/files?${params.toString()}&${COMMON}`,
  );
  return json.files?.[0] ? toDriveFile(json.files[0]) : null;
}

/** Detaches a view into a standalone ArrayBuffer accepted by fetch(). */
function toBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function multipartBody(metadata: unknown, mimeType: string, bytes: Uint8Array) {
  const boundary = `awm${Math.random().toString(36).slice(2)}${Date.now()}`;
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function uploadDriveFile(
  key: string,
  input: { name: string; mimeType: string; bytes: Uint8Array; folderId: string | null },
) {
  const { body, contentType } = multipartBody(
    { name: input.name, ...(input.folderId ? { parents: [input.folderId] } : {}) },
    input.mimeType,
    input.bytes,
  );
  const res = await driveApi(
    key,
    `/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}&${COMMON}`,
    { method: "POST", headers: { "Content-Type": contentType }, body: toBody(body) },
  );
  if (!res.ok)
    throw new Error(
      `Google Drive upload failed [${res.status}]: ${(await res.text()).slice(0, 400)}`,
    );
  return toDriveFile((await res.json()) as RawFile);
}

/** Uploads new content over an existing Drive file, keeping its version history. */
export async function updateDriveFileContent(
  key: string,
  input: { fileId: string; mimeType: string; bytes: Uint8Array },
) {
  const res = await driveApi(
    key,
    `/upload/drive/v3/files/${encodeURIComponent(input.fileId)}?uploadType=media&fields=${FILE_FIELDS}&${COMMON}`,
    { method: "PATCH", headers: { "Content-Type": input.mimeType }, body: toBody(input.bytes) },
  );
  if (!res.ok)
    throw new Error(
      `Google Drive replace failed [${res.status}]: ${(await res.text()).slice(0, 400)}`,
    );
  return toDriveFile((await res.json()) as RawFile);
}
