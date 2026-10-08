import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type ArchiveSnapshot = {
  project: Record<string, unknown> | null;
  contacts: unknown[];
  authorities: unknown[];
  addresses: unknown[];
  documents: unknown[];
  pages: unknown[];
  workingSets: unknown[];
  workingSetPages: unknown[];
  annotations: unknown[];
  calibrations: unknown[];
  detections: unknown[];
  scheduleEntries: unknown[];
  sheetClassifications: unknown[];
  issues: unknown[];
  facts: unknown[];
  quantities: unknown[];
  takeoffItems: unknown[];
  exports: unknown[];
  audit: unknown[];
};

/**
 * Builds a versioned point-in-time snapshot of a project.
 *
 * Large binary objects are never duplicated: documents and pages are captured
 * as immutable references — storage path, checksum, size and revision — so the
 * snapshot stays small while still proving exactly which file version the
 * archive describes.
 */
export async function createArchiveSnapshot(input: {
  projectId: string;
  label?: string;
  reason?: string;
}) {
  const { projectId } = input;
  const byProject = (t: string, cols: string) =>
    sb.from(t).select(cols).eq("project_id", projectId);

  const [
    project,
    contacts,
    authorities,
    addresses,
    documents,
    pages,
    workingSets,
    annotations,
    calibrations,
    detections,
    scheduleEntries,
    classifications,
    issues,
    facts,
    quantities,
    takeoffItems,
    exportRows,
    audit,
  ] = await Promise.all([
    sb.from("projects").select("*").eq("id", projectId).maybeSingle(),
    byProject("project_contacts", "*"),
    byProject("project_authorities", "*"),
    byProject("project_address_candidates", "*"),
    byProject(
      "documents",
      "id,name,original_filename,storage_path,checksum,size_bytes,mime_type,page_count,revision,category,building,status,created_at",
    ),
    byProject(
      "pages",
      "id,document_id,page_number,sheet_number,title,discipline,building,floor,revision,classification,state,thumbnail_path,excluded_at,deleted_at",
    ),
    byProject(
      "working_sets",
      "id,name,category,description,created_at,working_set_pages(page_id,sort_order)",
    ),
    byProject("annotations", "*"),
    byProject("page_scales", "*"),
    byProject("ai_detections", "*"),
    byProject("plan_schedule_entries", "*"),
    byProject("plan_sheet_classifications", "*"),
    byProject("plan_analysis_issues", "*"),
    byProject("project_intelligence_facts", "*"),
    byProject("project_quantity_estimates", "*"),
    byProject("takeoff_items", "*"),
    byProject("exports", "*"),
    sb
      .from("audit_log")
      .select("id,action,entity_type,entity_id,detail,user_id,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const sets = (workingSets.data ?? []) as { working_set_pages?: unknown[] }[];
  const snapshot: ArchiveSnapshot = {
    project: project.data ?? null,
    contacts: contacts.data ?? [],
    authorities: authorities.data ?? [],
    addresses: addresses.data ?? [],
    documents: documents.data ?? [],
    pages: pages.data ?? [],
    workingSets: sets,
    workingSetPages: sets.flatMap((s) => s.working_set_pages ?? []),
    annotations: annotations.data ?? [],
    calibrations: calibrations.data ?? [],
    detections: detections.data ?? [],
    scheduleEntries: scheduleEntries.data ?? [],
    sheetClassifications: classifications.data ?? [],
    issues: issues.data ?? [],
    facts: facts.data ?? [],
    quantities: quantities.data ?? [],
    takeoffItems: takeoffItems.data ?? [],
    exports: exportRows.data ?? [],
    audit: audit.data ?? [],
  };

  const counts = Object.fromEntries(
    Object.entries(snapshot).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.length : value ? 1 : 0,
    ]),
  );

  const { data: last } = await sb
    .from("project_archives")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);
  const version = Number(last?.[0]?.version ?? 0) + 1;

  const { data: userData } = await supabase.auth.getUser();
  const { data: created, error } = await sb
    .from("project_archives")
    .insert({
      project_id: projectId,
      version,
      label: input.label ?? `Version ${version}`,
      reason: input.reason ?? null,
      snapshot,
      counts,
      created_by: userData.user?.id ?? null,
    })
    .select("id,version,created_at")
    .maybeSingle();
  if (error) throw error;

  await sb
    .from("projects")
    .update({ archived_at: new Date().toISOString(), archive_version: version })
    .eq("id", projectId);

  await logAudit({
    projectId,
    action: "project.archived",
    entityType: "project_archive",
    entityId: created?.id ?? null,
    detail: { version, reason: input.reason ?? null, ...counts },
  });

  return { id: created?.id ?? null, version, counts };
}

export type ArchiveDiffRow = {
  section: string;
  archived: number;
  current: number;
  delta: number;
};

/** Compares a stored snapshot with the project as it stands today. */
export async function compareWithArchive(
  projectId: string,
  snapshot: ArchiveSnapshot,
): Promise<ArchiveDiffRow[]> {
  const current = await createSnapshotCounts(projectId);
  const sections: [string, keyof ArchiveSnapshot][] = [
    ["Contacts", "contacts"],
    ["Authorities", "authorities"],
    ["Address candidates", "addresses"],
    ["Documents", "documents"],
    ["Sheets", "pages"],
    ["Working sets", "workingSets"],
    ["Annotations", "annotations"],
    ["AI detections", "detections"],
    ["Schedule rows", "scheduleEntries"],
    ["Project facts", "facts"],
    ["Quantity estimates", "quantities"],
    ["Takeoff items", "takeoffItems"],
    ["Exports", "exports"],
  ];
  return sections.map(([section, key]) => {
    const archived = Array.isArray(snapshot[key]) ? (snapshot[key] as unknown[]).length : 0;
    const now = current[key] ?? 0;
    return { section, archived, current: now, delta: now - archived };
  });
}

async function createSnapshotCounts(
  projectId: string,
): Promise<Partial<Record<keyof ArchiveSnapshot, number>>> {
  const count = async (t: string) => {
    const { count: n } = await sb
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    return n ?? 0;
  };
  const [
    contacts,
    authorities,
    addresses,
    documents,
    pages,
    workingSets,
    annotations,
    detections,
    scheduleEntries,
    facts,
    quantities,
    takeoffItems,
    exportRows,
  ] = await Promise.all([
    count("project_contacts"),
    count("project_authorities"),
    count("project_address_candidates"),
    count("documents"),
    count("pages"),
    count("working_sets"),
    count("annotations"),
    count("ai_detections"),
    count("plan_schedule_entries"),
    count("project_intelligence_facts"),
    count("project_quantity_estimates"),
    count("takeoff_items"),
    count("exports"),
  ]);
  return {
    contacts,
    authorities,
    addresses,
    documents,
    pages,
    workingSets,
    annotations,
    detections,
    scheduleEntries,
    facts,
    quantities,
    takeoffItems,
    exports: exportRows,
  };
}
