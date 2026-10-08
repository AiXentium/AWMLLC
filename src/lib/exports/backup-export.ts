import type { ExportItem, ExportProject } from "./excel-export";
import type { CompanyInfo } from "@/lib/company-settings";

export type BackupPayload = {
  format: "awm-takeoff-backup";
  version: 1;
  generated_at: string;
  company: CompanyInfo;
  project: ExportProject;
  totals: { line_items: number; counted_units: number };
  items: Omit<ExportItem, "imageData">[];
  source_sheets: { sheet: string; title: string; itemCount: number }[];
};

/** Structured JSON snapshot of the project takeoff for recovery / portability. */
export function buildBackupJson(opts: {
  project: ExportProject;
  items: ExportItem[];
  sourceSheets: { sheet: string; title: string; itemCount: number }[];
  company: CompanyInfo;
}): Blob {
  const payload: BackupPayload = {
    format: "awm-takeoff-backup",
    version: 1,
    generated_at: new Date().toISOString(),
    company: opts.company,
    project: opts.project,
    totals: {
      line_items: opts.items.length,
      counted_units: opts.items.reduce((sum, i) => sum + (i.quantity ?? 1), 0),
    },
    items: opts.items.map(({ imageData: _imageData, ...rest }) => rest),
    source_sheets: opts.sourceSheets,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

const CSV_COLUMNS: [string, (item: ExportItem, index: number) => unknown][] = [
  ["#", (_i, index) => index + 1],
  ["id", (i) => i.id],
  ["mark", (i) => i.mark],
  ["description", (i) => i.description],
  ["category", (i) => i.category],
  ["product_type", (i) => i.product_type],
  ["system", (i) => i.system],
  ["frame_type", (i) => i.frame_type],
  ["glass", (i) => i.glass],
  ["operation", (i) => i.operation],
  ["building", (i) => i.building],
  ["floor", (i) => i.floor],
  ["unit", (i) => i.unit],
  ["room", (i) => i.room],
  ["elevation", (i) => i.elevation],
  ["quantity", (i) => i.quantity ?? 1],
  ["width_in", (i) => i.width_in],
  ["height_in", (i) => i.height_in],
  [
    "area_sf",
    (i) => (i.width_in && i.height_in ? ((i.width_in * i.height_in) / 144).toFixed(2) : ""),
  ],
  ["impact", (i) => (i.impact === null ? "" : i.impact ? "yes" : "no")],
  ["source_page", (i) => i.page_label],
  ["ai_confidence", (i) => i.ai_confidence],
  ["review_status", (i) => i.status],
  ["image_path", (i) => i.primary_image_path],
  ["notes", (i) => i.notes],
];

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Flat CSV of every takeoff line item, one row per record. */
export function buildBackupCsv(items: ExportItem[]): Blob {
  const lines = [CSV_COLUMNS.map(([header]) => header).join(",")];
  items.forEach((item, index) => {
    lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(item, index))).join(","));
  });
  return new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
}
