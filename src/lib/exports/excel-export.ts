import ExcelJS from "exceljs";
import { markerType, typeLabel } from "@/lib/takeoff-types";
import { DEFAULT_COMPANY, companyContactLine, type CompanyInfo } from "@/lib/company-settings";

export type ExportProject = {
  id: string;
  name: string;
  project_number?: string | null;
  status: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  county?: string | null;
  postal_code?: string | null;
  general_contractor?: string | null;
  architect?: string | null;
  municipality?: string | null;
  project_type?: string | null;
};

export type ExportItem = {
  id: string;
  mark: string | null;
  description: string | null;
  category: string;
  product_type: string | null;
  system: string | null;
  frame_type: string | null;
  glass: string | null;
  operation: string | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  room: string | null;
  elevation: string | null;
  quantity: number;
  width_in: number | null;
  height_in: number | null;
  impact: boolean | null;
  status: string;
  notes: string | null;
  ai_confidence: number | null;
  primary_image_path: string | null;
  page_label?: string | null;
  imageData?: ArrayBuffer | null;
};

const NAVY = "FF16233B";
const HEADERS = [
  "Image",
  "#",
  "Mark",
  "Description",
  "Category",
  "Type",
  "System",
  "Frame",
  "Glass",
  "Operation",
  "Building",
  "Floor",
  "Unit",
  "Room",
  "Elevation",
  "Qty",
  "Width (in)",
  "Height (in)",
  "Area (sf)",
  "Perimeter (in)",
  "Impact",
  "Source Page",
  "AI Confidence",
  "Review",
  "Notes",
];

function areaSf(item: ExportItem) {
  if (!item.width_in || !item.height_in) return null;
  return Number(((item.width_in * item.height_in) / 144).toFixed(2));
}

function perimeter(item: ExportItem) {
  if (!item.width_in || !item.height_in) return null;
  return Number((2 * (item.width_in + item.height_in)).toFixed(1));
}

function styleHeader(sheet: ExcelJS.Worksheet, row = 1) {
  const header = sheet.getRow(row);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;
}

function addItemSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  items: ExportItem[],
  withImages: boolean,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(HEADERS);
  styleHeader(sheet);
  sheet.columns = HEADERS.map((h, index) => ({
    width: index === 0 ? 14 : h.length < 8 ? 10 : Math.min(28, h.length + 8),
  })) as Partial<ExcelJS.Column>[];

  items.forEach((item, index) => {
    const row = sheet.addRow([
      "",
      index + 1,
      item.mark ?? "",
      item.description ?? "",
      item.category,
      typeLabel(item.product_type),
      item.system ?? "",
      item.frame_type ?? "",
      item.glass ?? "",
      item.operation ?? "",
      item.building ?? "",
      item.floor ?? "",
      item.unit ?? "",
      item.room ?? "",
      item.elevation ?? "",
      item.quantity ?? 1,
      item.width_in ?? "",
      item.height_in ?? "",
      areaSf(item) ?? "",
      perimeter(item) ?? "",
      item.impact === null || item.impact === undefined ? "" : item.impact ? "Yes" : "No",
      item.page_label ?? "",
      item.ai_confidence ?? "",
      item.status,
      item.notes ?? "",
    ]);
    row.font = { name: "Arial", size: 10 };
    if (withImages && item.imageData) {
      row.height = 48;
      const imageId = workbook.addImage({
        buffer: item.imageData as ArrayBuffer,
        extension: "jpeg",
      });
      sheet.addImage(imageId, {
        tl: { col: 0.15, row: row.number - 0.85 },
        ext: { width: 80, height: 56 },
      });
    }
  });

  if (!items.length) sheet.addRow(["No items recorded for this category."]);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}

function addStructuredSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number)[][] = [],
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  styleHeader(sheet);
  sheet.columns = headers.map((h) => ({
    width: Math.min(34, Math.max(14, h.length + 6)),
  })) as Partial<ExcelJS.Column>[];
  rows.forEach((r) => sheet.addRow(r));
  if (!rows.length) sheet.addRow(["Module not yet used for this project."]);
  return sheet;
}

export async function buildTakeoffWorkbook(opts: {
  project: ExportProject;
  items: ExportItem[];
  sourceSheets: { sheet: string; title: string; itemCount: number }[];
  company?: CompanyInfo;
}): Promise<Blob> {
  const { project, items, sourceSheets } = opts;
  const company = opts.company ?? DEFAULT_COMPANY;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${company.company_name} — ${company.legal_name}`;
  workbook.created = new Date();

  // 1. Project Summary
  const summary = workbook.addWorksheet("Project Summary");
  summary.columns = [{ width: 30 }, { width: 52 }];
  summary.addRow([`${company.company_name} — Takeoff Package`]).font = {
    bold: true,
    size: 16,
    name: "Arial",
    color: { argb: NAVY },
  };
  summary.addRow([`${company.legal_name} — independent supplier/distributor`]).font = {
    italic: true,
    size: 10,
    name: "Arial",
  };
  const contact = companyContactLine(company);
  if (contact) summary.addRow([contact]).font = { size: 9, name: "Arial" };
  summary.addRow([]);
  const info: [string, string][] = [
    ["Project", project.name],
    ["Project number", project.project_number ?? "—"],
    ["Status", project.status],
    ["Project type", project.project_type ?? "—"],
    [
      "Address",
      [project.address, project.city, project.state, project.postal_code]
        .filter(Boolean)
        .join(", ") || "—",
    ],
    ["County", project.county ?? "—"],
    ["Municipality / AHJ", project.municipality ?? "—"],
    ["General contractor", project.general_contractor ?? "—"],
    ["Architect", project.architect ?? "—"],
    ["Estimator", company.estimator_name ?? "—"],
    ["Generated", new Date().toLocaleString()],
    ["Total line items", String(items.length)],
    ["Total quantity", String(items.reduce((sum, i) => sum + (i.quantity ?? 1), 0))],
  ];

  info.forEach(([label, value]) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true, name: "Arial", size: 10 };
    row.getCell(2).font = { name: "Arial", size: 10 };
  });
  summary.addRow([]);
  summary.addRow(["Color legend"]).font = { bold: true, name: "Arial" };
  const usedTypes = [...new Set(items.map((i) => i.product_type).filter(Boolean))] as string[];
  usedTypes.forEach((key) => {
    const type = markerType(key);
    const row = summary.addRow([typeLabel(key), ""]);
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${(type?.color ?? "#64748b").replace("#", "").toUpperCase()}` },
    };
  });
  summary.addRow([]);
  if (company.default_report_notes) summary.addRow(["Report notes", company.default_report_notes]);
  summary.addRow([
    "Notice",
    "Quantities are derived from marked plan counts. Availability, performance, approvals and installation requirements are subject to manufacturer confirmation.",
  ]);

  // 2-6 item sheets
  addItemSheet(workbook, "Detailed Takeoff", items, true);
  addItemSheet(
    workbook,
    "Windows",
    items.filter((i) => i.category === "window"),
    true,
  );
  addItemSheet(
    workbook,
    "Doors",
    items.filter((i) => i.category === "door"),
    true,
  );
  addItemSheet(
    workbook,
    "Storefront & Curtain Wall",
    items.filter((i) => i.product_type === "storefront" || i.product_type === "curtain_wall"),
    true,
  );
  addItemSheet(
    workbook,
    "Glass & Glazing",
    items.filter((i) => i.category === "glazing"),
    true,
  );

  // 7-8 combinations
  addStructuredSheet(workbook, "Combination Assemblies", [
    "Assembly Mark",
    "Layout",
    "Mull Type",
    "Reinforcement",
    "Assembly Qty",
    "Status",
    "Notes",
  ]);
  addStructuredSheet(workbook, "Component Quantities", [
    "Assembly Mark",
    "Component Mark",
    "Type",
    "Width (in)",
    "Height (in)",
    "Qty per Assembly",
    "Total Qty",
  ]);

  // 9a Type summary
  const typeMap = new Map<string, { qty: number; lines: number }>();
  items.forEach((i) => {
    const key = `${typeLabel(i.product_type)}|${i.building ?? "Unassigned"}|${i.floor ?? "Unassigned"}`;
    const hit = typeMap.get(key) ?? { qty: 0, lines: 0 };
    hit.qty += i.quantity ?? 1;
    hit.lines += 1;
    typeMap.set(key, hit);
  });
  addStructuredSheet(
    workbook,
    "Type Summary",
    ["Type", "Building", "Floor", "Quantity", "Line Items"],
    [...typeMap.entries()].map(([key, value]) => {
      const [type, building, floor] = key.split("|");
      return [type, building, floor, value.qty, value.lines];
    }),
  );

  // 9 Floor summary
  const floorMap = new Map<string, number>();
  items.forEach((i) => {
    const key = `${i.building ?? "Unassigned"}|${i.floor ?? "Unassigned"}|${i.category}`;
    floorMap.set(key, (floorMap.get(key) ?? 0) + (i.quantity ?? 1));
  });
  addStructuredSheet(
    workbook,
    "Floor Summary",
    ["Building", "Floor", "Category", "Quantity"],
    [...floorMap.entries()].map(([key, qty]) => {
      const [building, floor, category] = key.split("|");
      return [building, floor, category, qty];
    }),
  );

  // 10-14 placeholders
  addStructuredSheet(workbook, "Schedule Comparison", [
    "Mark",
    "Schedule Qty",
    "Plan Count",
    "Difference",
    "Dimension Conflict",
    "Material Conflict",
    "Status",
  ]);
  addStructuredSheet(workbook, "Safety Review", [
    "Mark",
    "Building",
    "Floor",
    "Sill Height (in)",
    "Exterior Drop (in)",
    "WOCD",
    "Guard",
    "Safety Glazing",
    "Egress",
    "Status",
  ]);
  addStructuredSheet(workbook, "Jurisdiction Requirements", [
    "AHJ",
    "Adopted Code",
    "Amendments",
    "Design Wind Speed",
    "Debris Region",
    "Impact Required",
    "Source URL",
    "Verified",
  ]);
  addStructuredSheet(workbook, "YKK Product Mapping", [
    "Mark",
    "Takeoff Type",
    "Mapped Family",
    "Series",
    "Model",
    "Confidence",
    "Status",
    "Notes",
  ]);
  addStructuredSheet(workbook, "YKK Quote Package", [
    "Line",
    "Mark",
    "Product",
    "Configuration",
    "Qty",
    "Width (in)",
    "Height (in)",
    "Color",
    "Glass",
    "Notes",
  ]);

  // 15 Source sheets
  addStructuredSheet(
    workbook,
    "Source Sheets",
    ["Sheet", "Title", "Marked Items"],
    sourceSheets.map((s) => [s.sheet, s.title, s.itemCount]),
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
