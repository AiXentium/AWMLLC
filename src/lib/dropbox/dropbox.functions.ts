import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CLOUD_IMPORT_MAX_BYTES,
  type CloudFile,
  type CloudImportResult,
  type CloudStatus,
} from "@/lib/cloud/shared";

/**
 * Server API for the Dropbox integration.
 *
 * OAuth tokens, Dropbox bytes and every provider credential stay on the server.
 * Imported files land in the project's private bucket and then run the exact
 * same intake + pre-analysis pipeline as a browser upload.
 */

export const getDropboxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CloudStatus> => {
    const { dropboxConfigurationStatus } = await import("./dropbox-api.server");
    const config = dropboxConfigurationStatus();
    if (!config.configured) return { configured: false, connected: false, reason: config.reason };
    const { loadDropboxConnection } = await import("./connections.server");
    const connection = await loadDropboxConnection(context.userId);
    if (!connection) return { configured: true, connected: false };
    return {
      configured: true,
      connected: true,
      accountEmail: connection.accountEmail,
      accountName: connection.accountName,
      connectedAt: connection.connectedAt,
    };
  });

export const startDropboxConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ returnUrl: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { buildAuthorizationUrl, signOAuthState } = await import("./dropbox-api.server");
    return {
      url: buildAuthorizationUrl({
        redirectUri: data.returnUrl,
        state: signOAuthState(context.userId),
      }),
    };
  });

export const completeDropboxConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1).max(4000),
        state: z.string().min(1).max(2000),
        returnUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { exchangeAuthorizationCode, verifyOAuthState, currentAccount } =
      await import("./dropbox-api.server");
    const { saveDropboxConnection } = await import("./connections.server");
    if (!verifyOAuthState(data.state, context.userId)) {
      return {
        ok: false as const,
        reason: "That Dropbox sign-in link is no longer valid. Try connecting again.",
      };
    }
    const tokens = await exchangeAuthorizationCode(data.code, data.returnUrl);
    let account = { email: null as string | null, name: null as string | null };
    try {
      account = await currentAccount(tokens.accessToken);
    } catch {
      /* profile lookup is optional */
    }
    await saveDropboxConnection({
      userId: context.userId,
      tokens,
      accountEmail: account.email,
      accountName: account.name,
    });
    return { ok: true as const, accountEmail: account.email };
  });

export const disconnectDropbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectDropbox: revoke } = await import("./connections.server");
    await revoke(context.userId);
    return { ok: true as const };
  });

export const browseDropbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        path: z.string().max(1000).nullable().optional(),
        search: z.string().max(200).nullable().optional(),
        cursor: z.string().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ files: CloudFile[]; nextCursor: string | null }> => {
      const { createDropboxAdapter } = await import("./dropbox-adapter.server");
      const adapter = await createDropboxAdapter(context.userId);
      return adapter.listEntries({
        ref: data.path ?? null,
        search: data.search,
        cursor: data.cursor,
      });
    },
  );

export const listDropboxFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ path: z.string().max(1000).nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CloudFile[]> => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const adapter = await createDropboxAdapter(context.userId);
    return adapter.listFolders(data.path ?? null);
  });

export const createDropboxProjectFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ segments: z.array(z.string().min(1).max(120)).min(1).max(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const adapter = await createDropboxAdapter(context.userId);
    return { folder: await adapter.ensureFolderPath(data.segments) };
  });

/** Metadata preview for the selection step, including revision awareness. */
export const previewDropboxFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ projectId: z.string().uuid(), paths: z.array(z.string().min(1)).min(1).max(25) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const adapter = await createDropboxAdapter(context.userId);
    const files: CloudFile[] = [];
    for (const path of data.paths) files.push(await adapter.fileMeta(path));

    const { data: previous } = await context.supabase
      .from("cloud_source_files")
      .select("remote_id,remote_rev,revision_number,created_at")
      .eq("project_id", data.projectId)
      .eq("provider", "dropbox")
      .in(
        "remote_id",
        files.map((f) => f.id),
      );
    const seen = new Map((previous ?? []).map((row) => [row.remote_id, row]));

    return files.map((file) => {
      const prior = seen.get(file.id);
      return {
        file,
        alreadyImported: Boolean(prior),
        importedAt: prior?.created_at ?? null,
        isRevision: Boolean(prior && (file.rev ?? "") !== (prior.remote_rev ?? "")),
        nextRevision: prior ? prior.revision_number + 1 : 1,
        tooLarge: (file.sizeBytes ?? 0) > CLOUD_IMPORT_MAX_BYTES,
      };
    });
  });

export const importDropboxFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        jobId: z.string().uuid(),
        path: z.string().min(1).max(1000),
        allowDuplicate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CloudImportResult> => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const { importCloudFile } = await import("@/lib/cloud/import.server");
    const adapter = await createDropboxAdapter(context.userId);
    return importCloudFile({
      supabase: context.supabase,
      userId: context.userId,
      adapter,
      projectId: data.projectId,
      jobId: data.jobId,
      ref: data.path,
      allowDuplicate: data.allowDuplicate,
    });
  });

/* --------------------------------------------------------- folder linking */

export const getProjectCloudLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: link } = await context.supabase
      .from("project_cloud_links")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("provider", "dropbox")
      .maybeSingle();
    const { data: sources } = await context.supabase
      .from("cloud_source_files")
      .select(
        "id,remote_name,remote_path,revision_number,update_available,status,sync_note,last_checked_at,created_at,document_id",
      )
      .eq("project_id", data.projectId)
      .eq("provider", "dropbox")
      .order("created_at", { ascending: false })
      .limit(100);
    const { data: exports } = await context.supabase
      .from("cloud_exports")
      .select("id,filename,file_type,remote_path,web_url,action,created_at")
      .eq("project_id", data.projectId)
      .eq("provider", "dropbox")
      .order("created_at", { ascending: false })
      .limit(50);
    return { link: link ?? null, sources: sources ?? [], exports: exports ?? [] };
  });

export const linkDropboxFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        folderPath: z.string().max(1000),
        folderName: z.string().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadDropboxConnection } = await import("./connections.server");
    const connection = await loadDropboxConnection(context.userId);
    const { error } = await context.supabase.from("project_cloud_links").upsert(
      {
        project_id: data.projectId,
        provider: "dropbox",
        folder_id: data.folderPath || null,
        folder_path: data.folderPath || "/",
        folder_name: data.folderName ?? "Dropbox",
        account_label: connection?.accountEmail ?? connection?.accountName ?? null,
        sync_status: "idle",
        sync_error: null,
        linked_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,provider" },
    );
    if (error) return { ok: false as const, reason: error.message };
    await context.supabase.from("audit_log").insert({
      project_id: data.projectId,
      user_id: context.userId,
      action: "dropbox.folder_linked",
      entity_type: "cloud_link",
      detail: { folder: data.folderPath } as never,
    });
    return { ok: true as const };
  });

/** Unlinks the folder without touching any imported project data. */
export const unlinkDropboxFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("project_cloud_links")
      .delete()
      .eq("project_id", data.projectId)
      .eq("provider", "dropbox");
    return { ok: true as const };
  });

export const checkDropboxUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const { syncCloudProject } = await import("@/lib/cloud/import.server");
    const adapter = await createDropboxAdapter(context.userId);
    return syncCloudProject({
      supabase: context.supabase,
      userId: context.userId,
      adapter,
      projectId: data.projectId,
    });
  });

/* ---------------------------------------------------------------- exports */

export const saveExportToDropbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        exportId: z.string().uuid().nullable().optional(),
        storagePath: z.string().min(1).max(500),
        filename: z.string().min(1).max(200),
        folderPath: z.string().max(1000).nullable().optional(),
        folderName: z.string().max(300).nullable().optional(),
        onConflict: z.enum(["replace", "keep_both"]).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createDropboxAdapter } = await import("./dropbox-adapter.server");
    const { sharedLink } = await import("./dropbox-api.server");
    const { requireDropboxAccessToken } = await import("./connections.server");
    const adapter = await createDropboxAdapter(context.userId);

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
    const folderRef = data.folderPath && data.folderPath !== "/" ? data.folderPath : null;

    const existing = await adapter.findFileByName(data.filename, folderRef);
    if (existing && !data.onConflict) {
      return {
        ok: false as const,
        conflict: true as const,
        existing: { name: existing.name, path: existing.path },
        reason: `“${data.filename}” already exists in that Dropbox folder.`,
      };
    }

    const name =
      existing && data.onConflict === "keep_both"
        ? data.filename.replace(
            /(\.[^.]+)?$/,
            (ext) => ` (${new Date().toISOString().slice(0, 16).replace("T", " ")})${ext || ""}`,
          )
        : data.filename;

    const saved = await adapter.uploadFile({
      name,
      mimeType,
      bytes,
      folderRef,
      overwrite: data.onConflict === "replace",
    });
    const action: "created" | "replaced" =
      existing && data.onConflict === "replace" ? "replaced" : "created";

    let link: string | null = null;
    try {
      link = await sharedLink(await requireDropboxAccessToken(context.userId), saved.path);
    } catch {
      /* the export is saved even when a share link cannot be created */
    }

    await context.supabase.from("cloud_exports").insert({
      project_id: data.projectId,
      provider: "dropbox",
      export_id: data.exportId ?? null,
      filename: saved.name,
      file_type: data.filename.split(".").pop() ?? null,
      mime_type: mimeType,
      remote_id: saved.id,
      remote_path: saved.path,
      folder_path: data.folderPath ?? "/",
      folder_name: data.folderName ?? "Dropbox",
      web_url: link,
      action,
      size_bytes: bytes.length,
      created_by: context.userId,
    });
    await context.supabase.from("audit_log").insert({
      project_id: data.projectId,
      user_id: context.userId,
      action: action === "replaced" ? "dropbox.export_replaced" : "dropbox.exported",
      entity_type: "cloud_export",
      detail: { filename: saved.name, folder: data.folderName, action } as never,
    });

    return { ok: true as const, file: { ...saved, webUrl: link }, action };
  });
