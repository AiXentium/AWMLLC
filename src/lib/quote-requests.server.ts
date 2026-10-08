import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { QUOTE_UPLOAD_BUCKET } from "@/lib/quote-uploads.shared";

type Db = SupabaseClient<Database>;

export type ConvertInput = {
  submissionId: string;
  projectName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  county?: string | null;
  projectType?: string | null;
  estimatorId?: string | null;
  notes?: string | null;
  priority?: string | null;
  documentIds: string[];
};

async function copyIntoPlanFiles(admin: Db, from: string, to: string) {
  const copy = await admin.storage
    .from(QUOTE_UPLOAD_BUCKET)
    .copy(from, to, { destinationBucket: "plan-files" } as never);
  if (!copy.error) return;

  // Older storage deployments have no cross-bucket copy — stream it instead.
  const download = await admin.storage.from(QUOTE_UPLOAD_BUCKET).download(from);
  if (download.error || !download.data) {
    throw new Error(download.error?.message ?? "The uploaded file could not be read.");
  }
  const upload = await admin.storage
    .from("plan-files")
    .upload(to, download.data, { upsert: true, contentType: download.data.type || undefined });
  if (upload.error) throw new Error(upload.error.message);
}

/**
 * Promotes a prospect quote request into a real project. Files that already
 * live in the quote bucket are copied once into the project intake path and
 * pushed through the existing intake service — no second upload, no second
 * processing pipeline.
 */
export async function convertQuoteRequest(supabase: Db, userId: string, input: ConvertInput) {
  const { data: submission, error } = await supabase
    .from("contact_submissions")
    .select("*")
    .eq("id", input.submissionId)
    .maybeSingle();
  if (error || !submission) throw new Error("That quote request no longer exists.");
  if (submission.converted_project_id) {
    return {
      ok: true as const,
      projectId: submission.converted_project_id,
      alreadyConverted: true,
    };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: input.projectName,
      owner_id: userId,
      estimator_id: input.estimatorId || null,
      address: input.address || submission.project_address,
      city: input.city || submission.city,
      state: input.state || submission.state,
      postal_code: input.postalCode || submission.zip_code,
      county: input.county || submission.county,
      project_type: input.projectType || submission.project_type,
      notes: input.notes ?? submission.message,
      status: "active",
      is_demo: false,
    })
    .select("id")
    .single();
  if (projectError || !project)
    throw new Error(projectError?.message ?? "Project creation failed.");

  const { data: docs } = await supabase
    .from("quote_request_documents")
    .select("id,file_name,size_bytes,mime_type,kind,checksum,storage_path")
    .eq("submission_id", input.submissionId)
    .in(
      "id",
      input.documentIds.length ? input.documentIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const transferable = (docs ?? []).filter((doc) => doc.kind === "pdf" || doc.kind === "zip");
  let imported = 0;
  const failures: string[] = [];

  if (transferable.length) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { approveUpload, finalizeUpload, extractArchive } =
      await import("@/lib/intake/intake-service.server");

    const { data: job } = await supabase
      .from("intake_jobs")
      .insert({
        project_id: project.id,
        created_by: userId,
        label: `Quote request ${submission.project_name ?? submission.name}`,
        total_files: transferable.length,
        status: "running",
      })
      .select("id")
      .single();

    for (const doc of transferable) {
      try {
        const approval = await approveUpload(supabase, userId, {
          projectId: project.id,
          jobId: job!.id,
          filename: doc.file_name,
          sizeBytes: Number(doc.size_bytes ?? 0),
          mimeType: doc.mime_type,
        });
        if (!approval.ok) throw new Error(approval.reason);

        await copyIntoPlanFiles(
          supabaseAdmin as unknown as Db,
          doc.storage_path,
          approval.storagePath,
        );

        const finalized = await finalizeUpload(supabase, userId, {
          intakeFileId: approval.intakeFileId,
          checksum: doc.checksum ?? crypto.randomUUID().replace(/-/g, ""),
          allowDuplicate: false,
        });
        if (!finalized.ok) throw new Error(finalized.reason);

        if (finalized.kind === "zip") {
          await extractArchive(supabase, userId, approval.intakeFileId);
        }

        await supabase
          .from("quote_request_documents")
          .update({
            intake_file_id: approval.intakeFileId,
            document_id: "documentId" in finalized ? (finalized.documentId as string) : null,
          })
          .eq("id", doc.id);
        imported += 1;
      } catch (transferError) {
        failures.push(
          `${doc.file_name}: ${transferError instanceof Error ? transferError.message : "transfer failed"}`,
        );
      }
    }

    await supabase.from("intake_jobs").update({ status: "complete" }).eq("id", job!.id);
  }

  await supabase
    .from("contact_submissions")
    .update({
      status: "converted_to_project",
      converted_project_id: project.id,
      last_activity_at: new Date().toISOString(),
      priority: input.priority ?? submission.priority,
      assigned_to: input.estimatorId || submission.assigned_to,
    })
    .eq("id", input.submissionId);

  await supabase.from("quote_request_activity").insert({
    submission_id: input.submissionId,
    actor_id: userId,
    kind: "converted",
    detail: `Converted to project "${input.projectName}" · ${imported} document${imported === 1 ? "" : "s"} transferred${failures.length ? ` · ${failures.length} failed` : ""}.`,
  });

  return { ok: true as const, projectId: project.id, imported, failures, alreadyConverted: false };
}
