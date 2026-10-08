import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DRIVE_IMPORT_MAX_BYTES,
  GOOGLE_DRIVE_SCOPES,
  type DriveFile,
  type DriveImportResult,
  type DriveStatus,
} from "./drive-shared";

/**
 * Server API for the Google Drive App User Connector.
 * Connection keys, gateway credentials and Drive bytes stay on the server;
 * imported files always land in the project's private bucket and then run the
 * exact same intake pipeline as a browser upload.
 */

export const getDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveStatus> => {
    const { driveConfigurationStatus } = await import("./gateway.server");
    const config = driveConfigurationStatus();
    if (!config.configured) return { configured: false, connected: false, reason: config.reason };
    const { loadDriveConnection } = await import("./connections.server");
    const connection = await loadDriveConnection(context.userId);
    if (!connection) return { configured: true, connected: false };
    return {
      configured: true,
      connected: true,
      accountEmail: connection.accountEmail,
      accountName: connection.accountName,
      connectedAt: connection.connectedAt,
    };
  });

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ returnUrl: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { startDriveAuthorization } = await import("./gateway.server");
    const { loadDriveConnection } = await import("./connections.server");
    const existing = await loadDriveConnection(context.userId);
    const url = await startDriveAuthorization({
      appUserId: context.userId,
      returnUrl: data.returnUrl,
      scopes: GOOGLE_DRIVE_SCOPES,
      connectionApiKey: existing?.connectionApiKey ?? null,
    });
    return { url };
  });

export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { exchangeDriveOAuthCode } = await import("./gateway.server");
    const { driveAccount } = await import("./drive.server");
    const { saveDriveConnection } = await import("./connections.server");
    const { connectionApiKey } = await exchangeDriveOAuthCode(data.code);
    let account = { email: null as string | null, name: null as string | null };
    try {
      account = await driveAccount(connectionApiKey);
    } catch {
      /* profile lookup is optional */
    }
    await saveDriveConnection({
      userId: context.userId,
      connectionApiKey,
      accountEmail: account.email,
      accountName: account.name,
      scopes: GOOGLE_DRIVE_SCOPES,
    });
    return { ok: true as const, accountEmail: account.email };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadDriveConnection, deleteDriveConnection } = await import("./connections.server");
    const { revokeDriveConnection } = await import("./gateway.server");
    const connection = await loadDriveConnection(context.userId);
    if (connection) {
      try {
        await revokeDriveConnection(connection.connectionApiKey);
      } catch {
        /* the local record is removed regardless */
      }
      await deleteDriveConnection(context.userId);
    }
    return { ok: true as const };
  });

export const browseDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        folderId: z.string().max(200).nullable().optional(),
        search: z.string().max(200).nullable().optional(),
        pageToken: z.string().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ files: DriveFile[]; nextPageToken: string | null }> => {
      const { requireDriveKey } = await import("./connections.server");
      const { listDriveEntries } = await import("./drive.server");
      const key = await requireDriveKey(context.userId);
      return listDriveEntries(key, data);
    },
  );

export const listDriveFolderTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ parentId: z.string().max(200).nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<DriveFile[]> => {
    const { requireDriveKey } = await import("./connections.server");
    const { listDriveFolders } = await import("./drive.server");
    const key = await requireDriveKey(context.userId);
    return listDriveFolders(key, data.parentId ?? null);
  });

export const createDriveProjectFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ segments: z.array(z.string().min(1).max(120)).min(1).max(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireDriveKey } = await import("./connections.server");
    const { ensureDriveFolderPath } = await import("./drive.server");
    const key = await requireDriveKey(context.userId);
    const folder = await ensureDriveFolderPath(key, data.segments);
    return { folder };
  });

/** Metadata preview for the selection step (name, size, folder, source URL). */
export const previewDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ projectId: z.string().uuid(), fileIds: z.array(z.string().min(1)).min(1).max(25) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireDriveKey } = await import("./connections.server");
    const { driveFileMeta } = await import("./drive.server");
    const key = await requireDriveKey(context.userId);
    const files: DriveFile[] = [];
    for (const id of data.fileIds) files.push(await driveFileMeta(key, id));
    const { data: previous } = await context.supabase
      .from("drive_source_files")
      .select("drive_file_id,drive_name,created_at")
      .eq("project_id", data.projectId)
      .in("drive_file_id", data.fileIds);
    const seen = new Map((previous ?? []).map((row) => [row.drive_file_id, row]));
    return files.map((file) => ({
      file,
      alreadyImported: seen.has(file.id),
      importedAt: seen.get(file.id)?.created_at ?? null,
      tooLarge: (file.sizeBytes ?? 0) > DRIVE_IMPORT_MAX_BYTES,
    }));
  });

export const importDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        jobId: z.string().uuid(),
        fileId: z.string().min(1).max(200),
        allowDuplicate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DriveImportResult> => {
    const { requireDriveKey } = await import("./connections.server");
    const { driveFileMeta, downloadDriveFile } = await import("./drive.server");
    const { approveUpload, finalizeUpload, extractArchive } =
      await import("@/lib/intake/intake-service.server");
    const { sha256Hex } = await import("@/lib/intake/intake.server");
    const { sanitizeFilename } = await import("@/lib/intake/shared");

    const key = await requireDriveKey(context.userId);
    const meta = await driveFileMeta(key, data.fileId);
    const filename = sanitizeFilename(meta.name);
    if ((meta.sizeBytes ?? 0) > DRIVE_IMPORT_MAX_BYTES) {
      return {
        ok: false,
        reason: `“${filename}” is larger than the ${Math.round(DRIVE_IMPORT_MAX_BYTES / (1024 * 1024))} MB Google Drive import limit. Download it and use the normal resumable upload instead.`,
      };
    }

    const approval = await approveUpload(context.supabase, context.userId, {
      projectId: data.projectId,
      jobId: data.jobId,
      filename,
      sizeBytes: meta.sizeBytes ?? 0,
      mimeType: meta.mimeType,
    });
    if (!approval.ok) return { ok: false, reason: approval.reason };

    const audit = async (action: string, detail: Record<string, unknown>) => {
      await context.supabase.from("audit_log").insert({
        project_id: data.projectId,
        user_id: context.userId,
        action,
        entity_type: "drive_file",
        entity_id: approval.intakeFileId,
        detail: detail as never,
      });
    };

    let bytes: Uint8Array;
    try {
      bytes = await downloadDriveFile(key, data.fileId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Google Drive download failed.";
      await context.supabase
        .from("intake_files")
        .update({ status: "failed", error_message: reason })
        .eq("id", approval.intakeFileId);
      await audit("drive.import_failed", { filename, drive_file_id: data.fileId, reason });
      return { ok: false, reason };
    }

    // Durable private copy first — the project must keep working if the Drive
    // file is later moved, renamed or unshared.
    const upload = await context.supabase.storage
      .from("plan-files")
      .upload(approval.storagePath, bytes, {
        contentType: approval.kind === "pdf" ? "application/pdf" : "application/zip",
        upsert: true,
      });
    if (upload.error) {
      await audit("drive.import_failed", { filename, reason: upload.error.message });
      return { ok: false, reason: upload.error.message };
    }

    const checksum = await sha256Hex(bytes);
    const finalized = await finalizeUpload(context.supabase, context.userId, {
      intakeFileId: approval.intakeFileId,
      checksum,
      allowDuplicate: data.allowDuplicate ?? false,
    });
    if (!finalized.ok) return { ok: false, reason: finalized.reason };

    const recordSource = async (documentId: string | null) => {
      await context.supabase.from("drive_source_files").insert({
        project_id: data.projectId,
        intake_file_id: approval.intakeFileId,
        document_id: documentId,
        drive_file_id: meta.id,
        drive_name: meta.name,
        drive_mime_type: meta.mimeType,
        drive_folder_id: meta.parentId,
        drive_folder_name: meta.folderName,
        drive_modified_time: meta.modifiedTime,
        drive_web_view_link: meta.webViewLink,
        drive_md5: meta.md5,
        size_bytes: meta.sizeBytes,
        checksum,
        latest_modified_time: meta.modifiedTime,
        last_checked_at: new Date().toISOString(),
        imported_by: context.userId,
      });
    };

    if (finalized.kind === "zip") {
      const extracted = await extractArchive(
        context.supabase,
        context.userId,
        approval.intakeFileId,
      );
      if (!extracted.ok) return { ok: false, reason: extracted.reason };
      await recordSource(null);
      await audit("drive.imported", {
        filename,
        drive_file_id: meta.id,
        kind: "zip",
        accepted: extracted.accepted,
      });
      return {
        ok: true,
        kind: "zip",
        accepted: extracted.accepted,
        duplicates: extracted.duplicates,
        ignored: extracted.ignored,
        failed: extracted.failed,
      };
    }

    if ("duplicate" in finalized && finalized.duplicate) {
      await audit("drive.import_duplicate", {
        filename,
        drive_file_id: meta.id,
        matches: finalized.existing.name,
      });
      return {
        ok: true,
        kind: "pdf",
        duplicate: true,
        existingName: finalized.existing.name,
        intakeFileId: approval.intakeFileId,
      };
    }

    const documentId = "documentId" in finalized ? finalized.documentId : null;
    await recordSource(documentId ?? null);
    await audit("drive.imported", {
      filename,
      drive_file_id: meta.id,
      kind: "pdf",
      document_id: documentId,
    });
    return {
      ok: true,
      kind: "pdf",
      duplicate: false,
      documentId: documentId ?? "",
      intakeFileId: approval.intakeFileId,
    };
  });

/** Manual "check for newer source version" using Drive modified time + md5. */
export const checkDriveSourceVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireDriveKey } = await import("./connections.server");
    const { driveFileMeta } = await import("./drive.server");
    const key = await requireDriveKey(context.userId);
    const { data: rows, error } = await context.supabase
      .from("drive_source_files")
      .select("id,drive_file_id,drive_modified_time,drive_md5")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);

    let updates = 0;
    let missing = 0;
    for (const row of rows ?? []) {
      try {
        const meta = await driveFileMeta(key, row.drive_file_id);
        const newer =
          (meta.modifiedTime &&
            row.drive_modified_time &&
            meta.modifiedTime > row.drive_modified_time) ||
          (!!meta.md5 && !!row.drive_md5 && meta.md5 !== row.drive_md5);
        if (newer) updates += 1;
        await context.supabase
          .from("drive_source_files")
          .update({
            update_available: newer,
            latest_modified_time: meta.modifiedTime,
            last_checked_at: new Date().toISOString(),
            status: "imported",
          })
          .eq("id", row.id);
      } catch {
        missing += 1;
        await context.supabase
          .from("drive_source_files")
          .update({ status: "unavailable", last_checked_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }
    return { checked: (rows ?? []).length, updates, missing };
  });

export const saveExportToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        exportId: z.string().uuid().nullable().optional(),
        storagePath: z.string().min(1).max(500),
        filename: z.string().min(1).max(200),
        folderId: z.string().max(200).nullable().optional(),
        folderName: z.string().max(300).nullable().optional(),
        onConflict: z.enum(["replace", "keep_both", "rename"]).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireDriveKey } = await import("./connections.server");
    const { findDriveFileByName, updateDriveFileContent, uploadDriveFile } =
      await import("./drive.server");
    const key = await requireDriveKey(context.userId);

    const download = await context.supabase.storage
      .from("project-exports")
      .download(data.storagePath);
    if (download.error || !download.data) {
      return {
        ok: false as const,
        reason: download.error?.message ?? "The generated file could not be read.",
      };
    }
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const mimeType = download.data.type || "application/octet-stream";

    const existing = await findDriveFileByName(key, data.filename, data.folderId ?? null);
    if (existing && !data.onConflict) {
      return {
        ok: false as const,
        conflict: true as const,
        existing: { id: existing.id, name: existing.name, webViewLink: existing.webViewLink },
        reason: `“${data.filename}” already exists in that Google Drive folder.`,
      };
    }

    let saved;
    let action: "created" | "replaced" | "new_version" = "created";
    if (existing && data.onConflict === "replace") {
      saved = await updateDriveFileContent(key, { fileId: existing.id, mimeType, bytes });
      action = "replaced";
    } else {
      const name =
        existing && data.onConflict === "keep_both"
          ? data.filename.replace(
              /(\.[^.]+)?$/,
              (ext) => ` (${new Date().toISOString().slice(0, 16).replace("T", " ")})${ext || ""}`,
            )
          : data.filename;
      saved = await uploadDriveFile(key, {
        name,
        mimeType,
        bytes,
        folderId: data.folderId ?? null,
      });
      action = existing ? "new_version" : "created";
    }

    await context.supabase.from("drive_exports").insert({
      project_id: data.projectId,
      export_id: data.exportId ?? null,
      drive_file_id: saved.id,
      drive_folder_id: data.folderId ?? null,
      drive_folder_name: data.folderName ?? null,
      filename: saved.name,
      file_type: data.filename.split(".").pop() ?? null,
      mime_type: mimeType,
      size_bytes: bytes.length,
      action,
      drive_web_view_link: saved.webViewLink,
      created_by: context.userId,
    });
    await context.supabase.from("audit_log").insert({
      project_id: data.projectId,
      user_id: context.userId,
      action: action === "replaced" ? "drive.export_replaced" : "drive.exported",
      entity_type: "drive_export",
      entity_id: saved.id,
      detail: { filename: saved.name, folder: data.folderName, action } as never,
    });

    return { ok: true as const, file: saved, action };
  });
