import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const QUOTE_STATUSES = [
  "new",
  "reviewing",
  "more_information_needed",
  "quote_in_progress",
  "quote_sent",
  "converted_to_project",
  "won",
  "lost",
  "archived",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  more_information_needed: "More Information Needed",
  quote_in_progress: "Quote in Progress",
  quote_sent: "Quote Sent",
  converted_to_project: "Converted to Project",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

export const listQuoteRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((row) => row.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: docs } = await context.supabase
        .from("quote_request_documents")
        .select("submission_id")
        .in("submission_id", ids);
      (docs ?? []).forEach((doc) => {
        counts.set(doc.submission_id, (counts.get(doc.submission_id) ?? 0) + 1);
      });
    }

    const { data: staff } = await context.supabase.from("profiles").select("id,full_name,email");

    return {
      requests: (data ?? []).map((row) => ({ ...row, documentCount: counts.get(row.id) ?? 0 })),
      staff: staff ?? [],
    };
  });

export const getQuoteRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const [request, documents, activity] = await Promise.all([
      context.supabase.from("contact_submissions").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("quote_request_documents")
        .select("*")
        .eq("submission_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("quote_request_activity")
        .select("*")
        .eq("submission_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (!request.data) throw new Error("Quote request not found.");
    return {
      request: request.data,
      documents: documents.data ?? [],
      activity: activity.data ?? [],
    };
  });

export const updateQuoteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(QUOTE_STATUSES).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        internalNotes: z.string().max(8000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
    const notes: string[] = [];
    if (data.status) {
      patch.status = data.status;
      notes.push(`Status set to ${QUOTE_STATUS_LABELS[data.status]}`);
    }
    if (data.assignedTo !== undefined) {
      patch.assigned_to = data.assignedTo;
      notes.push(data.assignedTo ? "Assignment updated" : "Assignment cleared");
    }
    if (data.priority) {
      patch.priority = data.priority;
      notes.push(`Priority set to ${data.priority}`);
    }
    if (data.internalNotes !== undefined) {
      patch.internal_notes = data.internalNotes;
      notes.push("Internal notes updated");
    }

    const { error } = await context.supabase
      .from("contact_submissions")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("quote_request_activity").insert({
      submission_id: data.id,
      actor_id: context.userId,
      kind: "updated",
      detail: notes.join(" · ") || "Request updated",
    });

    return { ok: true as const };
  });

export const updateQuoteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200).optional(),
        classification: z.string().trim().max(80).nullable().optional(),
        remove: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: doc } = await context.supabase
      .from("quote_request_documents")
      .select("id,submission_id,file_name,storage_path,document_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found.");

    if (data.remove) {
      if (doc.document_id) {
        throw new Error("This document is already part of a project and cannot be removed here.");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("quote-uploads").remove([doc.storage_path]);
      await context.supabase.from("quote_request_documents").delete().eq("id", data.id);
    } else {
      const patch: Record<string, unknown> = {};
      if (data.fileName) patch.file_name = data.fileName;
      if (data.classification !== undefined) patch.classification = data.classification;
      const { error } = await context.supabase
        .from("quote_request_documents")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    await context.supabase.from("quote_request_activity").insert({
      submission_id: doc.submission_id,
      actor_id: context.userId,
      kind: "document",
      detail: data.remove ? `Removed ${doc.file_name}` : `Updated ${doc.file_name}`,
    });

    return { ok: true as const };
  });

export const getQuoteDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), download: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: doc } = await context.supabase
      .from("quote_request_documents")
      .select("storage_path,file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("quote-uploads")
      .createSignedUrl(
        doc.storage_path,
        300,
        data.download ? { download: doc.file_name } : undefined,
      );
    if (error || !signed) throw new Error("Could not create a secure link for that file.");
    return { url: signed.signedUrl };
  });

export const convertQuoteRequestToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        projectName: z.string().trim().min(1).max(200),
        address: z.string().trim().max(240).nullable().optional(),
        city: z.string().trim().max(120).nullable().optional(),
        state: z.string().trim().max(60).nullable().optional(),
        postalCode: z.string().trim().max(20).nullable().optional(),
        county: z.string().trim().max(120).nullable().optional(),
        projectType: z.string().trim().max(120).nullable().optional(),
        estimatorId: z.string().uuid().nullable().optional(),
        notes: z.string().max(8000).nullable().optional(),
        priority: z.string().max(20).nullable().optional(),
        documentIds: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { convertQuoteRequest } = await import("@/lib/quote-requests.server");
    return convertQuoteRequest(context.supabase, context.userId, data);
  });
