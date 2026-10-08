/**
 * Provider-neutral cloud import, revision detection, sync and export.
 *
 * Every cloud file — Dropbox today, Google Drive through the same adapter —
 * is copied into the project's private bucket and then handed to the *existing*
 * intake pipeline (approveUpload → finalizeUpload → extractArchive), so
 * hashing, duplicate detection, PDF splitting, project-information extraction,
 * sheet classification, Working Sets and the Project Intelligence Model all run
 * exactly as they do for a browser upload. There is no cloud-only analysis path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CloudAdapter } from "./adapter.server";
import {
  CLOUD_IMPORT_MAX_BYTES,
  type CloudFile,
  type CloudImportResult,
  type CloudProviderId,
} from "./shared";

type Db = SupabaseClient<Database>;

async function audit(
  supabase: Db,
  input: {
    projectId: string;
    userId: string;
    action: string;
    entityId?: string | null;
    detail: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    project_id: input.projectId,
    user_id: input.userId,
    action: input.action,
    entity_type: "cloud_file",
    entity_id: input.entityId ?? null,
    detail: input.detail as never,
  });
}

/**
 * Records a revision as an intelligence fact so later passes can compare sheet
 * and opening changes. User-decided facts are never overwritten.
 */
async function recordRevisionFact(
  supabase: Db,
  input: {
    projectId: string;
    provider: CloudProviderId;
    file: CloudFile;
    revisionNumber: number;
    previousDocumentId: string | null;
    documentId: string | null;
  },
) {
  const factKey = `cloud_revision:${input.provider}:${input.file.id}:${input.revisionNumber}`;
  const { data: prior } = await supabase
    .from("project_intelligence_facts")
    .select("id,status,version")
    .eq("project_id", input.projectId)
    .eq("fact_type", "conflict")
    .eq("fact_key", factKey)
    .maybeSingle();
  if (prior && ["user_confirmed", "user_corrected", "rejected"].includes(prior.status)) return;

  const payload = {
    project_id: input.projectId,
    document_id: input.documentId,
    fact_type: "conflict",
    fact_key: factKey,
    label: `Revision ${input.revisionNumber} detected for ${input.file.name}`,
    value: {
      provider: input.provider,
      remote_path: input.file.path,
      revision_number: input.revisionNumber,
      previous_document_id: input.previousDocumentId,
      remote_modified_time: input.file.modifiedTime,
    } as never,
    sources: [
      { label: `${input.file.name} (${input.provider})`, detail: input.file.path },
    ] as never,
    reasoning:
      `A newer version of “${input.file.name}” was imported from the linked cloud folder. ` +
      `It was stored as revision ${input.revisionNumber} instead of replacing the previous plan set, ` +
      `so earlier takeoff work and confirmed facts stay intact.`,
    confidence: 0.9,
  };
  if (prior) {
    await supabase
      .from("project_intelligence_facts")
      .update({ ...payload, version: prior.version + 1, superseded: false })
      .eq("id", prior.id);
  } else {
    await supabase.from("project_intelligence_facts").insert(payload);
  }
}

export type ImportCloudFileInput = {
  supabase: Db;
  userId: string;
  adapter: CloudAdapter;
  projectId: string;
  jobId: string;
  /** Provider handle (Dropbox path / Drive file id). */
  ref: string;
  allowDuplicate?: boolean;
  /** Import a changed file as a new revision instead of reporting "unchanged". */
  asRevision?: boolean;
};

export async function importCloudFile(input: ImportCloudFileInput): Promise<CloudImportResult> {
  const { supabase, userId, adapter, projectId, jobId } = input;
  const provider = adapter.provider;
  const { approveUpload, finalizeUpload, extractArchive } =
    await import("@/lib/intake/intake-service.server");
  const { sha256Hex } = await import("@/lib/intake/intake.server");
  const { sanitizeFilename } = await import("@/lib/intake/shared");

  let meta: CloudFile;
  try {
    meta = await adapter.fileMeta(input.ref);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "That cloud file could not be read.",
    };
  }
  const filename = sanitizeFilename(meta.name);

  if ((meta.sizeBytes ?? 0) > CLOUD_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      reason: `“${filename}” is larger than the ${Math.round(CLOUD_IMPORT_MAX_BYTES / (1024 * 1024))} MB cloud import limit. Download it and use the normal resumable upload instead.`,
    };
  }

  // Revision check against what this project already pulled from the provider.
  const { data: priorRows } = await supabase
    .from("cloud_source_files")
    .select("id,remote_rev,remote_content_hash,revision_number,document_id,remote_name,status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .eq("remote_id", meta.id)
    .order("revision_number", { ascending: false })
    .limit(1);
  const prior = priorRows?.[0] ?? null;
  const changed = prior
    ? (meta.rev ?? "") !== (prior.remote_rev ?? "") ||
      (!!meta.contentHash &&
        !!prior.remote_content_hash &&
        meta.contentHash !== prior.remote_content_hash)
    : false;

  if (prior && !changed && !input.allowDuplicate) {
    return { ok: true, kind: "pdf", outcome: "unchanged", existingName: prior.remote_name };
  }

  const approval = await approveUpload(supabase, userId, {
    projectId,
    jobId,
    filename,
    sizeBytes: meta.sizeBytes ?? 0,
    mimeType: meta.mimeType,
  });
  if (!approval.ok) return { ok: false, reason: approval.reason };

  let bytes: Uint8Array;
  try {
    bytes = await adapter.download(input.ref);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "The cloud download failed.";
    await supabase
      .from("intake_files")
      .update({ status: "failed", error_message: reason })
      .eq("id", approval.intakeFileId);
    await audit(supabase, {
      projectId,
      userId,
      action: `${provider}.import_failed`,
      entityId: approval.intakeFileId,
      detail: { filename, remote_path: meta.path, reason },
    });
    return { ok: false, reason };
  }

  // Durable private copy first — the project keeps working if the cloud file is
  // later moved, renamed or unshared.
  const upload = await supabase.storage.from("plan-files").upload(approval.storagePath, bytes, {
    contentType: approval.kind === "pdf" ? "application/pdf" : "application/zip",
    upsert: true,
  });
  if (upload.error) {
    await audit(supabase, {
      projectId,
      userId,
      action: `${provider}.import_failed`,
      detail: { filename, reason: upload.error.message },
    });
    return { ok: false, reason: upload.error.message };
  }

  const checksum = await sha256Hex(bytes);
  const finalized = await finalizeUpload(supabase, userId, {
    intakeFileId: approval.intakeFileId,
    checksum,
    // A confirmed revision must import even though it shares a project.
    allowDuplicate: input.allowDuplicate ?? changed,
  });
  if (!finalized.ok) return { ok: false, reason: finalized.reason };

  const revisionNumber = prior ? prior.revision_number + 1 : 1;
  const recordSource = async (documentId: string | null) => {
    await supabase.from("cloud_source_files").insert({
      project_id: projectId,
      provider,
      remote_id: meta.id,
      remote_path: meta.path,
      remote_name: meta.name,
      remote_rev: meta.rev,
      remote_content_hash: meta.contentHash,
      remote_modified_time: meta.modifiedTime,
      latest_rev: meta.rev,
      latest_modified_time: meta.modifiedTime,
      web_url: meta.webUrl,
      mime_type: meta.mimeType,
      size_bytes: meta.sizeBytes,
      checksum,
      document_id: documentId,
      intake_file_id: approval.intakeFileId,
      revision_number: revisionNumber,
      supersedes_source_file_id: prior?.id ?? null,
      update_available: false,
      status: "imported",
      sync_note: prior ? `Revision ${revisionNumber} of ${meta.name}` : null,
      imported_by: userId,
      last_checked_at: new Date().toISOString(),
    });
    if (prior) {
      await supabase
        .from("cloud_source_files")
        .update({
          status: "superseded",
          update_available: false,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", prior.id);
    }
  };

  if (finalized.kind === "zip") {
    const extracted = await extractArchive(supabase, userId, approval.intakeFileId);
    if (!extracted.ok) return { ok: false, reason: extracted.reason };
    await recordSource(null);
    await audit(supabase, {
      projectId,
      userId,
      action: `${provider}.imported`,
      entityId: approval.intakeFileId,
      detail: { filename, kind: "zip", accepted: extracted.accepted, revision: revisionNumber },
    });
    return {
      ok: true,
      kind: "zip",
      outcome: "imported",
      accepted: extracted.accepted,
      duplicates: extracted.duplicates,
      ignored: extracted.ignored,
      failed: extracted.failed,
    };
  }

  if ("duplicate" in finalized && finalized.duplicate) {
    await audit(supabase, {
      projectId,
      userId,
      action: `${provider}.import_duplicate`,
      detail: { filename, matches: finalized.existing.name },
    });
    return {
      ok: true,
      kind: "pdf",
      outcome: "duplicate",
      existingName: finalized.existing.name,
      intakeFileId: approval.intakeFileId,
    };
  }

  const documentId = "documentId" in finalized ? finalized.documentId : null;
  await recordSource(documentId ?? null);

  if (prior) {
    // Revision, not replacement: keep the earlier document and chain them.
    if (documentId && prior.document_id) {
      await supabase
        .from("documents")
        .update({ revision: `R${revisionNumber}`, supersedes_document_id: prior.document_id })
        .eq("id", documentId);
    }
    await recordRevisionFact(supabase, {
      projectId,
      provider,
      file: meta,
      revisionNumber,
      previousDocumentId: prior.document_id,
      documentId: documentId ?? null,
    });
  }

  await audit(supabase, {
    projectId,
    userId,
    action: `${provider}.imported`,
    entityId: approval.intakeFileId,
    detail: { filename, kind: "pdf", document_id: documentId, revision: revisionNumber },
  });

  return {
    ok: true,
    kind: "pdf",
    outcome: prior ? "revision" : "imported",
    documentId: documentId ?? "",
    intakeFileId: approval.intakeFileId,
    revisionNumber,
  };
}

/**
 * Compares the linked folder and previously imported files against the
 * provider, flagging new, changed, renamed and removed plan files. Nothing is
 * overwritten here — the estimator decides what to re-import.
 */
export async function syncCloudProject(input: {
  supabase: Db;
  userId: string;
  adapter: CloudAdapter;
  projectId: string;
}) {
  const { supabase, adapter, projectId } = input;
  const provider = adapter.provider;
  const now = new Date().toISOString();

  const { data: link } = await supabase
    .from("project_cloud_links")
    .select("id,folder_id,folder_path")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("cloud_source_files")
    .select("id,remote_id,remote_rev,remote_content_hash,remote_name,status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .neq("status", "superseded");

  let updates = 0;
  let removed = 0;
  let renamed = 0;
  let errors = 0;

  for (const row of rows ?? []) {
    try {
      const meta = await adapter.fileMeta(row.remote_id);
      const changed =
        (meta.rev ?? "") !== (row.remote_rev ?? "") ||
        (!!meta.contentHash &&
          !!row.remote_content_hash &&
          meta.contentHash !== row.remote_content_hash);
      const wasRenamed = meta.name !== row.remote_name;
      if (changed) updates += 1;
      if (wasRenamed) renamed += 1;
      await supabase
        .from("cloud_source_files")
        .update({
          update_available: changed,
          latest_rev: meta.rev,
          latest_modified_time: meta.modifiedTime,
          remote_name: meta.name,
          remote_path: meta.path,
          last_checked_at: now,
          status: "imported",
          sync_note: changed
            ? "A newer version is available in the cloud folder. Import it to create a new revision."
            : wasRenamed
              ? "This file was renamed in the cloud folder."
              : null,
        })
        .eq("id", row.id);
    } catch {
      errors += 1;
      removed += 1;
      await supabase
        .from("cloud_source_files")
        .update({
          status: "unavailable",
          last_checked_at: now,
          sync_note: "This file is no longer available in the cloud folder.",
        })
        .eq("id", row.id);
    }
  }

  // New plan files that appeared in the linked folder.
  let added = 0;
  if (link) {
    try {
      const contents = await adapter.listFolderContents(link.folder_id ?? link.folder_path ?? null);
      const known = new Set((rows ?? []).map((r) => r.remote_id));
      added = contents.filter(
        (f) => !f.isFolder && /\.(pdf|zip)$/i.test(f.name) && !known.has(f.id),
      ).length;
    } catch {
      errors += 1;
    }
  }

  const status =
    errors && !updates && !added ? "error" : updates || added ? "updates_available" : "synced";
  const message = [
    updates ? `${updates} plan file(s) changed` : "",
    added ? `${added} new file(s) in the linked folder` : "",
    renamed ? `${renamed} renamed` : "",
    removed ? `${removed} no longer available` : "",
  ]
    .filter(Boolean)
    .join(", ");

  if (link) {
    await supabase
      .from("project_cloud_links")
      .update({
        sync_status: status,
        sync_error: errors ? "Some files could not be read from the cloud folder." : null,
        last_checked_at: now,
        ...(status === "synced" ? { last_synced_at: now } : {}),
      })
      .eq("id", link.id);
  }

  return {
    checked: (rows ?? []).length,
    updates,
    added,
    removed,
    renamed,
    errors,
    message: message || "Everything is up to date.",
  };
}
