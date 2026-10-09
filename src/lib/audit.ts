import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "document.uploaded"
  | "document.upload_failed"
  | "document.processed"
  | "document.processed_with_errors"
  | "intake.job_started"
  | "intake.pdf_accepted"
  | "intake.archive_extracted"
  | "intake.archive_failed"
  | "intake.duplicate_detected"
  | "intake.revision_superseded"
  | "intake.file_failed"
  | "drive.connected"
  | "drive.disconnected"
  | "drive.imported"
  | "drive.import_duplicate"
  | "drive.import_failed"
  | "drive.exported"
  | "drive.export_replaced"
  | "dropbox.connected"
  | "dropbox.disconnected"
  | "dropbox.imported"
  | "dropbox.import_duplicate"
  | "dropbox.import_failed"
  | "dropbox.exported"
  | "dropbox.export_replaced"
  | "dropbox.folder_linked"
  | "dropbox.folder_unlinked"
  | "dropbox.sync_checked"
  | "page.scale_calibrated"
  | "ai.analysis_run"
  | "ai.detection_approved"
  | "ai.detection_rejected"
  | "takeoff.item_created"
  | "takeoff.item_edited"
  | "takeoff.item_bulk_edited"
  | "takeoff.item_deleted"
  | "takeoff.item_pending"
  | "takeoff.item_review"
  | "takeoff.item_approved"
  | "takeoff.item_rejected"
  | "takeoff.schedule_promoted"
  | "takeoff.quote_requested"
  | "takeoff.plan_search_converted"
  | "quote.draft_created"
  | "export.generated"
  | "export.failed"
  | "project.created"
  | "project.updated"
  | "extraction.completed"
  | "extraction.failed"
  | "extraction.geocoded"
  | "extraction.geocode_failed"
  | "extraction.field_accepted"
  | "extraction.field_rejected"
  | "analysis.working_set_created"
  | "analysis.completed"
  | "analysis.failed"
  | "analysis.vision_sheet_failed"
  | "analysis.approved"
  | "jurisdiction.updated"
  | "jurisdiction.verified"
  | "incoming.reassigned"
  | "incoming.requeued"
  | "ykk.mapping_updated"
  | "lifecycle.deleted"
  | "lifecycle.restored"
  | "lifecycle.purged"
  | "lifecycle.page_excluded"
  | "lifecycle.page_included"
  | "project.locked"
  | "project.unlocked"
  | "document.locked"
  | "document.unlocked"
  | "project.archived"
  | "extraction.contact_extracted"
  | "extraction.contact_corrected"
  | "extraction.contact_rejected"
  | "extraction.contact_merged"
  | "extraction.address_rejected"
  | "extraction.address_duplicate"
  | "extraction.address_confirmed"
  | "extraction.pin_corrected"
  | "authority.added"
  | "authority.verified"
  | "authority.researched";

/**
 * Fire-and-forget audit trail entry. Never throws: an audit failure must not
 * break the estimator workflow it is describing.
 */
export async function logAudit(entry: {
  projectId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      project_id: entry.projectId,
      user_id: data.user?.id ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      detail: (entry.detail ?? {}) as never,
    });
  } catch {
    /* audit logging is best-effort */
  }
}

/** Human-readable labels for the activity/QA panel. */
export const AUDIT_LABELS: Record<string, string> = {
  "document.uploaded": "Plan set uploaded",
  "document.upload_failed": "Plan upload failed",
  "document.processed": "Plan set processed",
  "document.processed_with_errors": "Plan set processed with page errors",
  "intake.job_started": "Intake batch started",
  "intake.pdf_accepted": "Plan file accepted",
  "intake.archive_extracted": "ZIP archive extracted",
  "intake.archive_failed": "ZIP archive rejected",
  "intake.duplicate_detected": "Duplicate file detected",
  "intake.revision_superseded": "Plan revision superseded",
  "intake.file_failed": "Intake file failed",

  "page.scale_calibrated": "Sheet scale calibrated",
  "ai.analysis_run": "AI analysis run",
  "ai.detection_approved": "AI detection approved",
  "ai.detection_rejected": "AI detection rejected",
  "takeoff.item_created": "Takeoff item created",
  "takeoff.item_edited": "Takeoff item edited",
  "takeoff.item_bulk_edited": "Takeoff items bulk edited",
  "takeoff.item_deleted": "Takeoff item deleted",
  "takeoff.item_pending": "Takeoff item set to pending",
  "takeoff.item_review": "Takeoff item sent to review",
  "takeoff.item_approved": "Takeoff item approved",
  "takeoff.item_rejected": "Takeoff item rejected",
  "takeoff.schedule_promoted": "Schedule rows promoted to takeoff",
  "quote.draft_created": "Draft quote created",
  "export.generated": "Export generated",
  "export.failed": "Export failed",
  "project.created": "Project created",
  "project.updated": "Project details updated",
  "extraction.completed": "Project info extracted from documents",
  "extraction.failed": "Project info extraction failed",
  "extraction.geocoded": "Project site geocoded",
  "extraction.geocode_failed": "Geocoding failed",
  "extraction.field_accepted": "Extracted field accepted",
  "extraction.field_rejected": "Extracted field rejected",
  "analysis.working_set_created": "AI working set created",
  "analysis.completed": "AI plan pre-analysis completed",
  "analysis.failed": "AI plan pre-analysis failed",
  "analysis.approved": "Pre-analysis approved",
  "lifecycle.deleted": "Record deleted",
  "lifecycle.restored": "Record restored",
  "lifecycle.purged": "Record permanently purged",
  "lifecycle.page_excluded": "Sheet excluded from workflow",
  "lifecycle.page_included": "Sheet returned to workflow",
  "project.locked": "Project locked",
  "project.unlocked": "Project unlocked",
  "document.locked": "Document locked",
  "document.unlocked": "Document unlocked",
  "project.archived": "Archive snapshot created",
  "extraction.contact_extracted": "Project contacts extracted",
  "extraction.contact_corrected": "Contact corrected",
  "extraction.contact_rejected": "Contact rejected",
  "extraction.contact_merged": "Duplicate contacts merged",
  "extraction.address_rejected": "Address candidate rejected",
  "extraction.address_duplicate": "Address marked duplicate",
  "extraction.address_confirmed": "Project site confirmed",
  "extraction.pin_corrected": "Project site pin corrected",
  "authority.added": "Authority record added",
  "authority.verified": "Authority record verified",
  "authority.researched": "Jurisdiction authorities researched",
};

export function auditLabel(action: string) {
  return AUDIT_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export function auditDetailText(detail: unknown) {
  if (!detail || typeof detail !== "object") return "";
  const entries = Object.entries(detail as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 4);
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`).join(" · ");
}
