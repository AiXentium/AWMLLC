import { supabase } from "@/integrations/supabase/client";
import {
  buildTakeoffWorkbook,
  type ExportItem,
  type ExportProject,
} from "@/lib/exports/excel-export";
import { buildTakeoffPdf } from "@/lib/exports/pdf-report";
import { downloadBlob, signedUrl } from "@/lib/storage-client";
import type { ToolResult } from "./types";

const EXPORT_COLUMNS =
  "id,mark,description,category,product_type,system,frame_type,glass,operation,building,floor,unit,room,elevation,quantity,width_in,height_in,impact,status,notes,ai_confidence,primary_image_path,page_id,pages(sheet_number,page_number,title)";

type Row = ExportItem & {
  page_id: string | null;
  pages: { sheet_number: string | null; page_number: number; title: string | null } | null;
};

async function loadExportPayload(projectId: string) {
  const [{ data: project, error: pe }, { data: items, error: ie }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id,name,project_number,status,address,city,state,county,postal_code,general_contractor,architect,municipality,project_type",
      )
      .eq("id", projectId)
      .single(),
    supabase
      .from("takeoff_items")
      .select(EXPORT_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("mark"),
  ]);
  if (pe) throw pe;
  if (ie) throw ie;

  const rows = (items ?? []) as unknown as Row[];
  const withImages: ExportItem[] = await Promise.all(
    rows.map(async (row) => {
      let imageData: ArrayBuffer | null = null;
      if (row.primary_image_path) {
        try {
          const url = await signedUrl("plan-files", row.primary_image_path);
          imageData = await (await fetch(url)).arrayBuffer();
        } catch {
          imageData = null;
        }
      }
      return {
        ...row,
        page_label: row.pages?.sheet_number ?? (row.pages ? `Page ${row.pages.page_number}` : ""),
        imageData,
      };
    }),
  );

  const sheetMap = new Map<string, { sheet: string; title: string; itemCount: number }>();
  rows.forEach((r) => {
    const sheet = r.pages?.sheet_number ?? (r.pages ? `Page ${r.pages.page_number}` : "Unassigned");
    const hit = sheetMap.get(sheet);
    if (hit) hit.itemCount += 1;
    else sheetMap.set(sheet, { sheet, title: r.pages?.title ?? "", itemCount: 1 });
  });

  return {
    project: project as ExportProject,
    items: withImages,
    sourceSheets: [...sheetMap.values()],
  };
}

async function recordExport(projectId: string, type: string, filename: string, blob: Blob) {
  const path = `${projectId}/exports/${Date.now()}-${filename}`;
  const { data: userData } = await supabase.auth.getUser();
  const upload = await supabase.storage.from("project-exports").upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  const { data, error } = await supabase
    .from("exports")
    .insert({
      project_id: projectId,
      export_type: type,
      status: upload.error ? "failed" : "ready",
      storage_path: upload.error ? null : path,
      filename,
      size_bytes: blob.size,
      error_message: upload.error?.message ?? null,
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export type ApprovalRequest = NonNullable<ToolResult["approval"]>;

/** Persists an approval request so the decision is auditable. */
export async function saveApprovalRequest(opts: {
  approval: ApprovalRequest;
  conversationId: string;
  messageId: string | null;
  projectId: string | null;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("ai_action_approvals")
    .insert({
      conversation_id: opts.conversationId,
      message_id: opts.messageId,
      project_id: opts.projectId,
      requested_by: opts.userId,
      action_type: opts.approval.actionType,
      summary: opts.approval.summary,
      payload: opts.approval.payload as never,
      preview: opts.approval.preview as never,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function decideApproval(
  approvalId: string,
  status: "approved" | "rejected",
  result: Record<string, unknown> = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("ai_action_approvals")
    .update({
      status,
      decided_by: userData.user?.id ?? null,
      decided_at: new Date().toISOString(),
      result: result as never,
    })
    .eq("id", approvalId);
  if (error) throw error;
}

/** Runs the approved action for real. Never called without an approval record. */
export async function executeApprovedAction(approval: ApprovalRequest): Promise<string> {
  const payload = approval.payload as {
    projectId?: string;
    draftType?: string;
    title?: string;
    body?: string;
  };
  const projectId = payload.projectId;
  if (!projectId) throw new Error("Missing project for this action.");

  if (approval.actionType === "generate_excel_export") {
    const { project, items, sourceSheets } = await loadExportPayload(projectId);
    const blob = await buildTakeoffWorkbook({ project, items, sourceSheets });
    const filename = `${(project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-")}-Takeoff.xlsx`;
    await downloadBlob(blob, filename);
    await recordExport(projectId, "xlsx", filename, blob);
    return `Excel takeoff generated and downloaded: **${filename}** (${items.length} line items). An export-history record was saved.`;
  }

  if (approval.actionType === "generate_pdf_report") {
    const { project, items, sourceSheets } = await loadExportPayload(projectId);
    const blob = await buildTakeoffPdf({ project, items, sourceSheets });
    const filename = `${(project.name || "AWM-Takeoff").replace(/[^\w-]+/g, "-")}-Report.pdf`;
    await downloadBlob(blob, filename);
    await recordExport(projectId, "pdf", filename, blob);
    return `PDF takeoff report generated and downloaded: **${filename}** (${items.length} line items). An export-history record was saved.`;
  }

  if (approval.actionType === "create_draft_rfi" || approval.actionType === "create_draft_note") {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("ai_generated_drafts").insert({
      project_id: projectId,
      draft_type: payload.draftType ?? "note",
      title: payload.title ?? "Draft",
      body: payload.body ?? "",
      created_by: userData.user?.id ?? "",
    });
    if (error) throw error;
    return `Draft **${payload.title}** saved to the project. It is a draft recommendation and has not been issued.`;
  }

  throw new Error(`Unknown action type: ${approval.actionType}`);
}
