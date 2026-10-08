/**
 * Dropbox behind the shared CloudAdapter contract. Server-only.
 */
import { requireDropboxAccessToken } from "./connections.server";
import {
  createFolder,
  currentAccount,
  downloadFile,
  getMetadata,
  listFolder,
  searchFiles,
  uploadFile,
} from "./dropbox-api.server";
import type { CloudAdapter } from "@/lib/cloud/adapter.server";
import type { CloudFile } from "@/lib/cloud/shared";

function joinPath(parent: string | null, name: string) {
  const base = !parent || parent === "/" ? "" : parent.replace(/\/$/, "");
  return `${base}/${name}`;
}

export async function createDropboxAdapter(userId: string): Promise<CloudAdapter> {
  const token = await requireDropboxAccessToken(userId);

  const listAll = async (ref: string | null) => {
    const out: CloudFile[] = [];
    let cursor: string | null = null;
    do {
      const page = await listFolder(token, { path: ref, cursor });
      out.push(...page.files);
      cursor = page.nextCursor;
    } while (cursor && out.length < 2000);
    return out;
  };

  return {
    provider: "dropbox",
    account: () => currentAccount(token),
    async listEntries({ ref, search, cursor }) {
      if (search?.trim()) {
        return { files: await searchFiles(token, search.trim()), nextCursor: null };
      }
      const page = await listFolder(token, { path: ref ?? null, cursor });
      const files = page.files.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return { files, nextCursor: page.nextCursor };
    },
    async listFolders(ref) {
      return (await listAll(ref)).filter((f) => f.isFolder);
    },
    fileMeta: (ref) => getMetadata(token, ref),
    download: (ref) => downloadFile(token, ref),
    async ensureFolderPath(segments) {
      let path = "";
      let folder: CloudFile | null = null;
      for (const segment of segments) {
        const name = segment.trim().replace(/[\\/]/g, "-");
        if (!name) continue;
        path = `${path}/${name}`;
        try {
          folder = await getMetadata(token, path);
        } catch {
          folder = await createFolder(token, path);
        }
      }
      return folder;
    },
    async findFileByName(name, folderRef) {
      try {
        return await getMetadata(token, joinPath(folderRef, name));
      } catch {
        return null;
      }
    },
    async uploadFile({ name, bytes, folderRef, overwrite }) {
      return uploadFile(token, {
        path: joinPath(folderRef, name),
        bytes,
        overwrite: Boolean(overwrite),
      });
    },
    listFolderContents: (ref) => listAll(ref).then((files) => files.filter((f) => !f.isFolder)),
  };
}
