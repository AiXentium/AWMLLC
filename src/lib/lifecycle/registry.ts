/**
 * One registry describing every record type that participates in the shared
 * delete → recycle bin → restore → purge lifecycle. Every surface that offers a
 * Delete action refers to an entry here so behaviour, labels and audit detail
 * stay identical across the platform.
 */

export type LifecycleEntity =
  | "project"
  | "document"
  | "page"
  | "working_set"
  | "takeoff_item"
  | "export"
  | "incoming_file"
  | "intake_file"
  | "quote_document"
  | "address_candidate"
  | "extracted_field"
  | "contact"
  | "authority"
  | "schedule_entry"
  | "quantity_estimate";

export type LifecycleDefinition = {
  entity: LifecycleEntity;
  /** Physical table backing the record. */
  table: string;
  /** Singular label used in dialogs and the recycle bin. */
  label: string;
  /** Plural label. */
  plural: string;
  /** Column holding the human-facing name, if any. */
  titleColumn: string | null;
  /** Secondary descriptive column. */
  subtitleColumn?: string | null;
  /** Column linking the row to a project (null when reached indirectly). */
  projectColumn: string | null;
  /** Parent record column captured on delete so restore can validate it. */
  parentColumn?: string | null;
  /** Requires owner/admin to purge permanently. */
  purgeAdminOnly: boolean;
  /** Sentence shown before a permanent purge. */
  purgeWarning: string;
  /** Dependent records removed with a purge. */
  dependents?: string[];
};

export const LIFECYCLE: Record<LifecycleEntity, LifecycleDefinition> = {
  project: {
    entity: "project",
    table: "projects",
    label: "Project",
    plural: "Projects",
    titleColumn: "name",
    subtitleColumn: "project_number",
    projectColumn: "id",
    purgeAdminOnly: true,
    purgeWarning:
      "Purging a project permanently removes its documents, pages, working sets, takeoff items, exports, extracted information and history. Stored plan files are not recoverable afterwards.",
    dependents: ["documents", "pages", "working sets", "takeoff items", "exports", "extractions"],
  },
  document: {
    entity: "document",
    table: "documents",
    label: "Document",
    plural: "Documents",
    titleColumn: "name",
    subtitleColumn: "original_filename",
    projectColumn: "project_id",
    purgeAdminOnly: true,
    purgeWarning:
      "Purging a document permanently removes its extracted pages, thumbnails and any takeoff work recorded on those pages.",
    dependents: ["pages", "annotations", "takeoff items"],
  },
  page: {
    entity: "page",
    table: "pages",
    label: "Sheet",
    plural: "Sheets",
    titleColumn: "sheet_number",
    subtitleColumn: "title",
    projectColumn: "project_id",
    parentColumn: "document_id",
    purgeAdminOnly: true,
    purgeWarning:
      "Purging a sheet permanently removes its markup, calibration and takeoff items. The original PDF is never altered — the sheet can always be re-extracted from the document.",
    dependents: ["annotations", "takeoff items", "detections"],
  },
  working_set: {
    entity: "working_set",
    table: "working_sets",
    label: "Working set",
    plural: "Working sets",
    titleColumn: "name",
    subtitleColumn: "category",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging a working set permanently removes its page selection. The sheets themselves are untouched.",
    dependents: ["working set pages"],
  },
  takeoff_item: {
    entity: "takeoff_item",
    table: "takeoff_items",
    label: "Takeoff item",
    plural: "Takeoff items",
    titleColumn: "mark",
    subtitleColumn: "type_name",
    projectColumn: "project_id",
    parentColumn: "page_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging a takeoff item permanently removes its count, dimensions and captured image.",
  },
  export: {
    entity: "export",
    table: "exports",
    label: "Export",
    plural: "Exports",
    titleColumn: "filename",
    subtitleColumn: "export_type",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning: "Purging an export permanently removes the generated file record.",
  },
  incoming_file: {
    entity: "incoming_file",
    table: "incoming_files",
    label: "Incoming file",
    plural: "Incoming files",
    titleColumn: "original_filename",
    subtitleColumn: "source",
    projectColumn: "project_id",
    purgeAdminOnly: true,
    purgeWarning:
      "Purging an incoming file permanently removes the intake record and its scan history.",
  },
  intake_file: {
    entity: "intake_file",
    table: "intake_files",
    label: "Intake file",
    plural: "Intake files",
    titleColumn: "original_filename",
    subtitleColumn: "source_archive",
    projectColumn: "project_id",
    parentColumn: "parent_file_id",
    purgeAdminOnly: true,
    purgeWarning:
      "Purging an intake file permanently removes the archive-member record and its processing history.",
  },
  quote_document: {
    entity: "quote_document",
    table: "quote_request_documents",
    label: "Quote document",
    plural: "Quote documents",
    titleColumn: "original_filename",
    subtitleColumn: "classification",
    projectColumn: null,
    parentColumn: "submission_id",
    purgeAdminOnly: true,
    purgeWarning: "Purging a prospect quote document permanently removes the uploaded file record.",
  },
  address_candidate: {
    entity: "address_candidate",
    table: "project_address_candidates",
    label: "Address candidate",
    plural: "Address candidates",
    titleColumn: "raw_address",
    subtitleColumn: "role",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging an address candidate permanently removes the extracted evidence for that address.",
  },
  extracted_field: {
    entity: "extracted_field",
    table: "project_field_extractions",
    label: "Extracted value",
    plural: "Extracted values",
    titleColumn: "value",
    subtitleColumn: "field_key",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging an extracted value permanently removes the source snippet that produced it.",
  },
  contact: {
    entity: "contact",
    table: "project_contacts",
    label: "Project contact",
    plural: "Project contacts",
    titleColumn: "company",
    subtitleColumn: "role",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning: "Purging a contact permanently removes the party and its source evidence.",
  },
  authority: {
    entity: "authority",
    table: "project_authorities",
    label: "Authority",
    plural: "Authorities",
    titleColumn: "department_name",
    subtitleColumn: "department_type",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging an authority record permanently removes the department information and its source link.",
  },
  schedule_entry: {
    entity: "schedule_entry",
    table: "plan_schedule_entries",
    label: "Schedule row",
    plural: "Schedule rows",
    titleColumn: "mark",
    subtitleColumn: "schedule_type",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning: "Purging a schedule row permanently removes the read schedule line.",
  },
  quantity_estimate: {
    entity: "quantity_estimate",
    table: "project_quantity_estimates",
    label: "Quantity estimate",
    plural: "Quantity estimates",
    titleColumn: "label",
    subtitleColumn: "bucket",
    projectColumn: "project_id",
    purgeAdminOnly: false,
    purgeWarning:
      "Purging a quantity estimate permanently removes the preliminary count and its reasoning.",
  },
};

export const LIFECYCLE_ENTITIES = Object.keys(LIFECYCLE) as LifecycleEntity[];

/** Entities that appear in the recycle bin workspace, in display order. */
export const RECYCLE_BIN_ENTITIES: LifecycleEntity[] = [
  "project",
  "document",
  "page",
  "working_set",
  "takeoff_item",
  "export",
  "incoming_file",
  "intake_file",
  "quote_document",
  "address_candidate",
  "extracted_field",
  "contact",
  "authority",
];
