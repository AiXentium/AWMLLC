import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  QUOTE_MAX_FILES,
  QUOTE_UPLOAD_BUCKET,
  quoteFileKind,
  sanitizeQuoteFilename,
  validateQuoteFile,
} from "./quote-uploads.shared";

const quoteDocumentSchema = z.object({
  path: z.string().min(1).max(400),
  fileName: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().max(200).nullable().optional(),
  checksum: z.string().max(128).nullable().optional(),
});

const quoteSchema = z.object({
  draftToken: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(1).max(40),
  preferredContact: z.string().trim().max(40).optional().or(z.literal("")),
  projectName: z.string().trim().min(1).max(160),
  projectAddress: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(120),
  county: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().min(1).max(60),
  zipCode: z.string().trim().max(20).optional().or(z.literal("")),
  projectType: z.string().trim().min(1).max(120),
  productInterest: z.string().trim().max(160).optional().or(z.literal("")),
  quantities: z.string().trim().max(60).optional().or(z.literal("")),
  deadline: z.string().trim().max(40).optional().or(z.literal("")),
  budgetRange: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(4000),
  consent: z.literal(true),
  documents: z.array(quoteDocumentSchema).max(QUOTE_MAX_FILES).default([]),
});

export type QuoteRequestInput = z.infer<typeof quoteSchema>;

/**
 * Issues a short-lived signed upload URL so a prospect can push a plan set
 * straight into the private quote bucket. Nothing is readable by the public:
 * the URL only permits a single write to the reserved path.
 */
export const createQuoteUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        draftToken: z.string().uuid(),
        fileName: z.string().min(1).max(300),
        sizeBytes: z.number().int().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const safeName = sanitizeQuoteFilename(data.fileName);
    const problem = validateQuoteFile(safeName, data.sizeBytes);
    if (problem) return { ok: false as const, reason: problem };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `drafts/${data.draftToken}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(QUOTE_UPLOAD_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) {
      return { ok: false as const, reason: "Upload could not be started. Please try again." };
    }
    return {
      ok: true as const,
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      fileName: safeName,
    };
  });

export const submitQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("contact_submissions")
      .insert({
        name: `${data.firstName} ${data.lastName}`.trim(),
        first_name: data.firstName,
        last_name: data.lastName,
        company: data.company || null,
        email: data.email,
        phone: data.phone,
        preferred_contact: data.preferredContact || null,
        project_name: data.projectName,
        project_address: data.projectAddress,
        city: data.city,
        county: data.county || null,
        state: data.state,
        zip_code: data.zipCode || null,
        project_type: data.projectType,
        product_interest: data.productInterest || null,
        quantities: data.quantities || null,
        deadline: data.deadline || null,
        budget_range: data.budgetRange || null,
        message: data.message,
        consent: data.consent,
        status: "new",
        source: "website_quote_form",
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Submission failed");

    const prefix = `drafts/${data.draftToken}/`;
    const rows = data.documents
      .filter((doc) => doc.path.startsWith(prefix))
      .map((doc) => {
        const safeName = sanitizeQuoteFilename(doc.fileName);
        return {
          submission_id: inserted.id,
          file_name: safeName,
          original_filename: doc.fileName.slice(0, 200),
          size_bytes: doc.sizeBytes,
          mime_type: doc.mimeType ?? null,
          kind: quoteFileKind(safeName) ?? "document",
          checksum: doc.checksum ?? null,
          storage_path: doc.path,
        };
      });

    if (rows.length) {
      const { error: docError } = await supabaseAdmin.from("quote_request_documents").insert(rows);
      if (docError) throw new Error(docError.message);
    }

    await supabaseAdmin.from("quote_request_activity").insert({
      submission_id: inserted.id,
      kind: "submitted",
      detail: `Quote request submitted from the website with ${rows.length} document${rows.length === 1 ? "" : "s"}.`,
    });

    // Fire-and-forget: email + SMS the owner about the new lead.
    // Never blocks or fails the submission.
    const { notifyNewLead } = await import("./lead-notifications.server");
    notifyNewLead({
      id: inserted.id,
      name: `${data.firstName} ${data.lastName}`.trim(),
      company: data.company || null,
      email: data.email,
      phone: data.phone,
      projectName: data.projectName,
      projectAddress: data.projectAddress,
      city: data.city,
      projectType: data.projectType,
      budgetRange: data.budgetRange || null,
      documentCount: rows.length,
    }).catch((err) => console.error("[lead-notify] unexpected:", err));

    return { ok: true as const, documents: rows.length };
  });
