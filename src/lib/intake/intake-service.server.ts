import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ArchiveRejected, extractPdfEntry, planArchive, sha256Hex } from "./intake.server";
import {
  displayNameFromFilename,
  hasPdfSignature,
  hasZipSignature,
  inferCategory,
  isPdfName,
  isZipName,
  revisionKey,
  sanitizeFilename,
  type IntakeLimits,
} from "./shared";

type Db = SupabaseClient<Database>;

const BUCKET = "plan-files";

export async function loadLimits(supabase: Db): Promise<IntakeLimits> {
  const { data, error } = await supabase
    .from("intake_settings")
    .select(
      "max_pdf_bytes,max_zip_bytes,max_archive_entries,max_uncompressed_bytes,max_compression_ratio",
    )
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    maxPdfBytes: Number(data?.max_pdf_bytes ?? 1073741824),
    maxZipBytes: Number(data?.max_zip_bytes ?? 104857600),
    maxArchiveEntries: Number(data?.max_archive_entries ?? 2000),
    maxUncompressedBytes: Number(data?.max_uncompressed_bytes ?? 1610612736),
    maxCompressionRatio: Number(data?.max_compression_ratio ?? 120),
    maxArchiveMemberBytes: Math.min(Number(data?.max_pdf_bytes ?? 1073741824), 80 * 1024 * 1024),
  };
}

async function audit(
  supabase: Db,
  projectId: string,
  userId: string | null,
  action: string,
  entityId: string | null,
  detail: Record<string, unknown>,
) {
  await supabase.from("audit_log").insert({
    project_id: projectId,
    user_id: userId,
    action,
    entity_type: "intake",
    entity_id: entityId,
    detail: detail as never,
  });
}

async function bumpJob(
  supabase: Db,
  jobId: string,
  field: "accepted_count" | "ignored_count" | "duplicate_count" | "failed_count",
  by = 1,
) {
  const { data } = await supabase.from("intake_jobs").select(field).eq("id", jobId).maybeSingle();
  const current = Number((data as Record<string, number> | null)?.[field] ?? 0);
  await supabase
    .from("intake_jobs")
    .update({ [field]: current + by } as never)
    .eq("id", jobId);
}

/** Validates a queued file against the server limits and reserves its storage path. */
export async function approveUpload(
  supabase: Db,
  userId: string,
  input: {
    projectId: string;
    jobId: string;
    filename: string;
    sizeBytes: number;
    mimeType?: string | null;
  },
) {
  const limits = await loadLimits(supabase);
  const safeName = sanitizeFilename(input.filename);
  const kind = isPdfName(safeName) ? "pdf" : isZipName(safeName) ? "zip" : null;

  if (!kind) {
    return {
      ok: false as const,
      reason: "Unsupported file type. The intake engine accepts PDF and ZIP files.",
    };
  }
  if (input.sizeBytes <= 0) {
    return { ok: false as const, reason: "That file is empty (0 bytes)." };
  }
  const max = kind === "pdf" ? limits.maxPdfBytes : limits.maxZipBytes;
  if (input.sizeBytes > max) {
    return {
      ok: false as const,
      reason: `${kind === "pdf" ? "PDF plan sets" : "ZIP archives"} are limited to ${Math.round(max / (1024 * 1024))} MB.`,
    };
  }

  const intakeFileId = crypto.randomUUID();
  const storagePath = `${input.projectId}/intake/${intakeFileId}.${kind}`;
  const { error } = await supabase.from("intake_files").insert({
    id: intakeFileId,
    job_id: input.jobId,
    project_id: input.projectId,
    source_kind: kind,
    original_filename: safeName,
    storage_path: storagePath,
    mime_type: kind === "pdf" ? "application/pdf" : "application/zip",
    size_bytes: input.sizeBytes,
    status: "uploading",
  });
  if (error) return { ok: false as const, reason: error.message };

  return { ok: true as const, intakeFileId, storagePath, kind, limits };
}

/** Reads the first bytes and true size of a stored object without buffering it. */
async function probeStoredObject(supabase: Db, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data) throw new Error(error?.message ?? "Could not read the stored file.");
  const response = await fetch(data.signedUrl, { headers: { Range: "bytes=0-7" } });
  if (!response.ok && response.status !== 206)
    throw new Error("The uploaded file could not be read back from storage.");
  const header = new Uint8Array(await response.arrayBuffer());
  const contentRange = response.headers.get("content-range");
  const total = contentRange
    ? Number(contentRange.split("/")[1])
    : Number(response.headers.get("content-length") ?? 0);
  return { header, size: Number.isFinite(total) ? total : 0 };
}

export async function finalizeUpload(
  supabase: Db,
  userId: string,
  input: { intakeFileId: string; checksum: string; allowDuplicate?: boolean },
) {
  const { data: file, error } = await supabase
    .from("intake_files")
    .select("id,job_id,project_id,source_kind,original_filename,storage_path,size_bytes")
    .eq("id", input.intakeFileId)
    .maybeSingle();
  if (error || !file || !file.storage_path) throw new Error("That intake file no longer exists.");

  const limits = await loadLimits(supabase);
  const fail = async (reason: string) => {
    await supabase
      .from("intake_files")
      .update({ status: "failed", error_message: reason })
      .eq("id", file.id);
    await bumpJob(supabase, file.job_id, "failed_count");
    await audit(supabase, file.project_id, userId, "intake.file_failed", file.id, {
      filename: file.original_filename,
      reason,
    });
    return { ok: false as const, reason };
  };

  const probe = await probeStoredObject(supabase, file.storage_path);
  const maxBytes = file.source_kind === "pdf" ? limits.maxPdfBytes : limits.maxZipBytes;
  if (probe.size > maxBytes) {
    await supabase.storage.from(BUCKET).remove([file.storage_path]);
    return fail(
      `The stored file exceeds the enforced ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    );
  }
  const signatureOk =
    file.source_kind === "pdf"
      ? hasPdfSignature(probe.header)
      : hasZipSignature(probe.header.subarray(0, 4));
  if (!signatureOk) {
    await supabase.storage.from(BUCKET).remove([file.storage_path]);
    return fail("The uploaded file does not match its type (bad file signature).");
  }

  await supabase
    .from("intake_files")
    .update({ status: "uploaded", checksum: input.checksum, size_bytes: probe.size })
    .eq("id", file.id);

  if (file.source_kind === "zip") {
    await supabase.from("intake_files").update({ status: "queued" }).eq("id", file.id);
    await audit(supabase, file.project_id, userId, "intake.archive_uploaded", file.id, {
      filename: file.original_filename,
      size_bytes: probe.size,
    });
    return { ok: true as const, kind: "zip" as const, intakeFileId: file.id };
  }

  const result = await registerPdfDocument(supabase, userId, {
    projectId: file.project_id,
    jobId: file.job_id,
    intakeFileId: file.id,
    filename: file.original_filename,
    storagePath: file.storage_path,
    sizeBytes: probe.size,
    checksum: input.checksum,
    allowDuplicate: input.allowDuplicate ?? false,
    sourceArchive: null,
    sourceFolder: null,
  });
  return { ok: true as const, kind: "pdf" as const, ...result };
}

type RegisterInput = {
  projectId: string;
  jobId: string;
  intakeFileId: string;
  filename: string;
  storagePath: string;
  sizeBytes: number;
  checksum: string;
  allowDuplicate: boolean;
  sourceArchive: string | null;
  sourceFolder: string | null;
};

/** Creates one plan document per PDF, with duplicate and revision awareness. */
async function registerPdfDocument(supabase: Db, userId: string, input: RegisterInput) {
  const { data: existing } = await supabase
    .from("documents")
    .select("id,name,checksum,original_filename,page_count,created_at")
    .eq("project_id", input.projectId)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = existing ?? [];
  const duplicate = rows.find((d) => d.checksum && d.checksum === input.checksum);
  if (duplicate && !input.allowDuplicate) {
    await supabase
      .from("intake_files")
      .update({
        status: "duplicate",
        duplicate_of: duplicate.id,
        reason: "Identical content already uploaded",
      })
      .eq("id", input.intakeFileId);
    await bumpJob(supabase, input.jobId, "duplicate_count");
    await audit(
      supabase,
      input.projectId,
      userId,
      "intake.duplicate_detected",
      input.intakeFileId,
      {
        filename: input.filename,
        matches: duplicate.name,
      },
    );
    return {
      duplicate: true as const,
      existing: { id: duplicate.id, name: duplicate.name },
      intakeFileId: input.intakeFileId,
    };
  }

  const key = revisionKey(input.filename);
  const revisionCandidate = key
    ? rows.find(
        (d) => d.checksum !== input.checksum && revisionKey(d.original_filename ?? d.name) === key,
      )
    : undefined;

  const documentId = crypto.randomUUID();
  const category = inferCategory(`${input.sourceFolder ?? ""}/${input.filename}`);
  const { error: docError } = await supabase.from("documents").insert({
    id: documentId,
    project_id: input.projectId,
    name: displayNameFromFilename(input.filename),
    kind: "plan_set",
    status: "queued",
    storage_path: input.storagePath,
    original_filename: input.filename,
    mime_type: "application/pdf",
    size_bytes: input.sizeBytes,
    checksum: input.checksum,
    category,
    source_archive: input.sourceArchive,
    source_folder: input.sourceFolder,
    intake_file_id: input.intakeFileId,
    created_by: userId,
  });
  if (docError) throw new Error(docError.message);

  await supabase
    .from("intake_files")
    .update({ status: "queued", document_id: documentId, checksum: input.checksum })
    .eq("id", input.intakeFileId);
  await bumpJob(supabase, input.jobId, "accepted_count");
  await audit(supabase, input.projectId, userId, "intake.pdf_accepted", documentId, {
    filename: input.filename,
    category,
    source_archive: input.sourceArchive,
    source_folder: input.sourceFolder,
  });

  return {
    duplicate: false as const,
    documentId,
    intakeFileId: input.intakeFileId,
    category,
    revisionCandidate: revisionCandidate
      ? { id: revisionCandidate.id, name: revisionCandidate.name }
      : null,
  };
}

/** Downloads, validates and unpacks a ZIP archive entirely on the server. */
export async function extractArchive(supabase: Db, userId: string, intakeFileId: string) {
  const { data: file, error } = await supabase
    .from("intake_files")
    .select("id,job_id,project_id,original_filename,storage_path,size_bytes,status")
    .eq("id", intakeFileId)
    .maybeSingle();
  if (error || !file || !file.storage_path) throw new Error("That archive no longer exists.");

  const limits = await loadLimits(supabase);
  await supabase
    .from("intake_files")
    .update({ status: "extracting", error_message: null })
    .eq("id", file.id);

  try {
    if (Number(file.size_bytes ?? 0) > limits.maxZipBytes) {
      throw new ArchiveRejected(
        `ZIP archives are limited to ${Math.round(limits.maxZipBytes / (1024 * 1024))} MB for server-side extraction.`,
      );
    }
    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(file.storage_path);
    if (dlError || !blob) throw new Error(dlError?.message ?? "Could not download the archive.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const plan = planArchive(bytes, limits);

    // Idempotency: entries already extracted for this archive are skipped on retry.
    const { data: already } = await supabase
      .from("intake_files")
      .select("original_filename,source_folder,status")
      .eq("parent_file_id", file.id);
    const done = new Set(
      (already ?? [])
        .filter((r) => ["ready", "queued", "duplicate"].includes(r.status))
        .map((r) => `${r.source_folder ?? ""}/${r.original_filename}`),
    );

    let accepted = 0;
    let duplicates = 0;
    let failed = 0;

    for (const entry of plan.ignored) {
      await supabase.from("intake_files").insert({
        job_id: file.job_id,
        project_id: file.project_id,
        parent_file_id: file.id,
        source_kind: "archive_member",
        original_filename: sanitizeFilename(entry.name),
        source_archive: file.original_filename,
        source_folder: entry.name.split("/").slice(0, -1).join("/"),
        status: "ignored",
        reason: entry.reason,
      });
      await bumpJob(supabase, file.job_id, "ignored_count");
    }

    for (const entry of plan.pdfs) {
      const displayName = sanitizeFilename(entry.path);
      const folder = entry.folder;
      if (done.has(`${folder}/${displayName}`)) continue;

      const childId = crypto.randomUUID();
      await supabase.from("intake_files").insert({
        id: childId,
        job_id: file.job_id,
        project_id: file.project_id,
        parent_file_id: file.id,
        source_kind: "archive_member",
        original_filename: displayName,
        source_archive: file.original_filename,
        source_folder: folder,
        status: "uploading",
        mime_type: "application/pdf",
        size_bytes: entry.uncompressedSize,
      });

      try {
        const data = extractPdfEntry(bytes, entry);
        const checksum = await sha256Hex(data);
        const storagePath = `${file.project_id}/intake/${childId}.pdf`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, data, { contentType: "application/pdf", upsert: true });
        if (up.error) throw new Error(up.error.message);

        await supabase
          .from("intake_files")
          .update({ status: "uploaded", storage_path: storagePath, size_bytes: data.byteLength })
          .eq("id", childId);

        const result = await registerPdfDocument(supabase, userId, {
          projectId: file.project_id,
          jobId: file.job_id,
          intakeFileId: childId,
          filename: displayName,
          storagePath,
          sizeBytes: data.byteLength,
          checksum,
          allowDuplicate: false,
          sourceArchive: file.original_filename,
          sourceFolder: folder,
        });
        if (result.duplicate) duplicates += 1;
        else accepted += 1;
      } catch (entryError) {
        failed += 1;
        await supabase
          .from("intake_files")
          .update({
            status: "failed",
            error_message: entryError instanceof Error ? entryError.message : "Extraction failed",
          })
          .eq("id", childId);
        await bumpJob(supabase, file.job_id, "failed_count");
      }
    }

    const status = failed > 0 ? "partially_failed" : "ready";
    await supabase.from("intake_files").update({ status }).eq("id", file.id);
    await audit(supabase, file.project_id, userId, "intake.archive_extracted", file.id, {
      archive: file.original_filename,
      accepted,
      duplicates,
      ignored: plan.ignored.length,
      failed,
    });

    return { ok: true as const, accepted, duplicates, ignored: plan.ignored.length, failed };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Archive extraction failed.";
    await supabase
      .from("intake_files")
      .update({ status: "failed", error_message: reason })
      .eq("id", file.id);
    await bumpJob(supabase, file.job_id, "failed_count");
    await audit(supabase, file.project_id, userId, "intake.archive_failed", file.id, {
      archive: file.original_filename,
      reason,
    });
    return { ok: false as const, reason };
  }
}

export async function cancelFile(supabase: Db, intakeFileId: string, reason?: string) {
  const { data: file } = await supabase
    .from("intake_files")
    .select("id,project_id,storage_path,status")
    .eq("id", intakeFileId)
    .maybeSingle();
  if (!file) return { ok: false as const };
  if (file.storage_path && ["uploading", "pending"].includes(file.status)) {
    await supabase.storage.from(BUCKET).remove([file.storage_path]);
  }
  await supabase
    .from("intake_files")
    .update({ status: "cancelled", reason: reason ?? "Cancelled by user" })
    .eq("id", intakeFileId);
  return { ok: true as const };
}
