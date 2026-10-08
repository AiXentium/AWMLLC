import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cross-project incoming-document feed.
 *
 * This is a read/act layer over the EXISTING intake pipeline — it does not
 * duplicate any upload, checksum, extraction or conversion logic. Rows come
 * from the real tables written by that pipeline:
 *   intake_files            internal uploads + ZIP members
 *   cloud_source_files      Dropbox imports
 *   drive_source_files      Google Drive imports
 *   quote_request_documents public prospect quote-request uploads
 */

export type IncomingSource = "upload" | "archive" | "dropbox" | "google_drive" | "quote_request";

export type IncomingRow = {
  id: string;
  kind: "intake" | "quote";
  source: IncomingSource;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  duplicate: boolean;
  errorMessage: string | null;
  projectId: string | null;
  projectName: string | null;
  submissionId: string | null;
  contactName: string | null;
  companyName: string | null;
  documentId: string | null;
  pageCount: number | null;
  pagesProcessed: number | null;
  assignedTo: string | null;
  uploadedBy: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

function personName(
  people: Map<string, { full_name: string | null; email: string | null }>,
  id: string | null | undefined,
) {
  if (!id) return null;
  const row = people.get(id);
  return row?.full_name || row?.email || null;
}

export const listIncomingFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: IncomingRow[] }> => {
    const sb = context.supabase;

    const [intake, quoteDocs, cloud, drive, projects, people] = await Promise.all([
      sb
        .from("intake_files")
        .select(
          "id,project_id,source_kind,original_filename,source_archive,mime_type,size_bytes,status,reason,error_message,document_id,duplicate_of,archived_at,created_at,updated_at,job_id",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      sb
        .from("quote_request_documents")
        .select(
          "id,submission_id,file_name,original_filename,size_bytes,mime_type,kind,classification,document_id,intake_file_id,archived_at,created_at,updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      sb.from("cloud_source_files").select("intake_file_id,provider,status,remote_name"),
      sb.from("drive_source_files").select("intake_file_id,status,drive_name"),
      sb.from("projects").select("id,name").is("deleted_at", null),
      sb.from("profiles").select("id,full_name,email"),
    ]);

    const projectNames = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
    const peopleMap = new Map((people.data ?? []).map((p) => [p.id, p]));

    const cloudByIntake = new Map(
      (cloud.data ?? [])
        .filter((c) => c.intake_file_id)
        .map((c) => [c.intake_file_id as string, c]),
    );
    const driveByIntake = new Set(
      (drive.data ?? []).filter((d) => d.intake_file_id).map((d) => d.intake_file_id as string),
    );

    const jobIds = [
      ...new Set((intake.data ?? []).map((f) => f.job_id).filter(Boolean)),
    ] as string[];
    const jobOwners = new Map<string, string | null>();
    if (jobIds.length) {
      const { data: jobs } = await sb.from("intake_jobs").select("id,created_by").in("id", jobIds);
      (jobs ?? []).forEach((j) => jobOwners.set(j.id, j.created_by));
    }

    const documentIds = [
      ...new Set(
        [
          ...(intake.data ?? []).map((f) => f.document_id),
          ...(quoteDocs.data ?? []).map((d) => d.document_id),
        ].filter(Boolean),
      ),
    ] as string[];
    const docMap = new Map<string, { page_count: number | null; pages_processed: number | null }>();
    if (documentIds.length) {
      const { data: docs } = await sb
        .from("documents")
        .select("id,page_count,pages_processed")
        .in("id", documentIds);
      (docs ?? []).forEach((d) => docMap.set(d.id, d));
    }

    const submissionIds = [...new Set((quoteDocs.data ?? []).map((d) => d.submission_id))];
    const submissions = new Map<
      string,
      {
        contact_name: string | null;
        company_name: string | null;
        assigned_to: string | null;
        project_id: string | null;
      }
    >();
    if (submissionIds.length) {
      const { data: subs } = await sb
        .from("contact_submissions")
        .select("id,name,company,assigned_to,converted_project_id")
        .in("id", submissionIds);
      (subs ?? []).forEach((s) => {
        const row = s as Record<string, unknown>;
        submissions.set(s.id, {
          contact_name: (row.name as string | null) ?? null,
          company_name: (row.company as string | null) ?? null,
          assigned_to: (row.assigned_to as string | null) ?? null,
          project_id: (row.converted_project_id as string | null) ?? null,
        });
      });
    }

    const rows: IncomingRow[] = [];

    for (const f of intake.data ?? []) {
      const cloudRow = cloudByIntake.get(f.id);
      let source: IncomingSource = "upload";
      if (cloudRow) source = cloudRow.provider === "dropbox" ? "dropbox" : "google_drive";
      else if (driveByIntake.has(f.id)) source = "google_drive";
      else if (f.source_archive) source = "archive";

      const doc = f.document_id ? docMap.get(f.document_id) : undefined;
      rows.push({
        id: f.id,
        kind: "intake",
        source,
        fileName: f.original_filename,
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        status: f.status,
        duplicate: Boolean(f.duplicate_of) || f.status === "duplicate",
        errorMessage: f.error_message ?? f.reason ?? null,
        projectId: f.project_id,
        projectName: f.project_id ? (projectNames.get(f.project_id) ?? null) : null,
        submissionId: null,
        contactName: null,
        companyName: null,
        documentId: f.document_id,
        pageCount: doc?.page_count ?? null,
        pagesProcessed: doc?.pages_processed ?? null,
        assignedTo: null,
        uploadedBy: personName(peopleMap, f.job_id ? jobOwners.get(f.job_id) : null),
        archived: Boolean(f.archived_at),
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      });
    }

    for (const d of quoteDocs.data ?? []) {
      const sub = submissions.get(d.submission_id);
      const doc = d.document_id ? docMap.get(d.document_id) : undefined;
      rows.push({
        id: d.id,
        kind: "quote",
        source: "quote_request",
        fileName: d.file_name ?? d.original_filename,
        mimeType: d.mime_type,
        sizeBytes: d.size_bytes,
        status: d.document_id ? "converted" : sub?.project_id ? "converted" : "awaiting review",
        duplicate: false,
        errorMessage: null,
        projectId: sub?.project_id ?? null,
        projectName: sub?.project_id ? (projectNames.get(sub.project_id) ?? null) : null,
        submissionId: d.submission_id,
        contactName: sub?.contact_name ?? null,
        companyName: sub?.company_name ?? null,
        documentId: d.document_id,
        pageCount: doc?.page_count ?? null,
        pagesProcessed: doc?.pages_processed ?? null,
        assignedTo: personName(peopleMap, sub?.assigned_to),
        uploadedBy: sub?.contact_name ?? null,
        archived: Boolean(d.archived_at),
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      });
    }

    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { rows };
  });

export const getIncomingFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["intake", "quote"]),
        download: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.kind === "quote") {
      // RLS check first: the caller must be able to read the row.
      const { data: doc } = await context.supabase
        .from("quote_request_documents")
        .select("storage_path,file_name")
        .eq("id", data.id)
        .maybeSingle();
      if (!doc) throw new Error("Document not found.");
      const { data: signed, error } = await supabaseAdmin.storage
        .from("quote-uploads")
        .createSignedUrl(
          doc.storage_path,
          300,
          data.download ? { download: doc.file_name } : undefined,
        );
      if (error || !signed) throw new Error("Could not create a secure link for that file.");
      return { url: signed.signedUrl };
    }

    const { data: file } = await context.supabase
      .from("intake_files")
      .select("storage_path,original_filename")
      .eq("id", data.id)
      .maybeSingle();
    if (!file?.storage_path) throw new Error("That file has no stored copy.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("plan-files")
      .createSignedUrl(
        file.storage_path,
        300,
        data.download ? { download: file.original_filename } : undefined,
      );
    if (error || !signed) throw new Error("Could not create a secure link for that file.");
    return { url: signed.signedUrl };
  });

export const setIncomingArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        kind: z.enum(["intake", "quote"]),
        archived: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const table = data.kind === "quote" ? "quote_request_documents" : "intake_files";
    const { error } = await context.supabase
      .from(table)
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { updated: data.ids.length };
  });

/** Re-queues a failed document so the existing page-extraction worker picks it up again. */
export const retryIncomingFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: files, error } = await context.supabase
      .from("intake_files")
      .select("id,document_id,project_id")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const docIds = (files ?? []).map((f) => f.document_id).filter(Boolean) as string[];
    if (docIds.length) {
      await context.supabase
        .from("documents")
        .update({ status: "queued", error_message: null, pages_failed: 0 })
        .in("id", docIds);
    }
    await context.supabase
      .from("intake_files")
      .update({ status: "queued", error_message: null })
      .in("id", data.ids);

    return {
      requeued: files?.length ?? 0,
      projectIds: [...new Set((files ?? []).map((f) => f.project_id))],
    };
  });

/** Moves an already-ingested document (and its extracted sheets) to another project. */
export const assignIncomingToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ids: z.array(z.string().uuid()).min(1).max(100), projectId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: target } = await context.supabase
      .from("projects")
      .select("id,name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!target) throw new Error("That project is not available to you.");

    const { data: files, error } = await context.supabase
      .from("intake_files")
      .select("id,document_id")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const docIds = (files ?? []).map((f) => f.document_id).filter(Boolean) as string[];
    if (docIds.length) {
      await context.supabase
        .from("documents")
        .update({ project_id: data.projectId })
        .in("id", docIds);
      await context.supabase
        .from("pages")
        .update({ project_id: data.projectId })
        .in("document_id", docIds);
    }
    await context.supabase
      .from("intake_files")
      .update({ project_id: data.projectId })
      .in("id", data.ids);

    return { moved: files?.length ?? 0, projectName: target.name };
  });
