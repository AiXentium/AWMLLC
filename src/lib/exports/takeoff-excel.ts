/**
 * Washington-format takeoff report workbook (Takeoff.xlsx style).
 *
 * Nine worksheets: Summary, Windows, Doors_Summary, Doors_Itemized,
 * Unit_Doors, Storefront_Types, Storefront_Doors, Sliding_Doors,
 * Methodology. Additive — the legacy buildTakeoffWorkbook export in
 * ./excel-export is untouched.
 */
import ExcelJS from "exceljs";
import type { ExportProject } from "./excel-export";
import type { ScheduleEntry } from "@/lib/takeoff/promote";
import type { Row } from "@/components/app/project/useTakeoffItems";
import {
  BIDDING_NOTES,
  buildingsFromItems,
  doorsByMark,
  formatFtIn,
  leafFor,
  leafForOperation,
  METHODOLOGY_NOTES,
  SLIDING_FINDINGS,
  sortDoorItems,
  SUMMARY_CATEGORIES,
  summarizeByCategory,
  visibleSheetIndex,
  windowsByMark,
  type SheetIndexRow,
} from "@/lib/takeoff/takeoff-report";

const NAVY = "FF16233B";
const FONT = "Arial";

/** NAVY header style, matching src/lib/exports/excel-export.ts. */
function styleHeader(sheet: ExcelJS.Worksheet, row = 1): void {
  const header = sheet.getRow(row);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, name: FONT, size: 10 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;
}

function sectionTitle(sheet: ExcelJS.Worksheet, text: string): void {
  sheet.addRow([text]).font = { bold: true, size: 12, name: FONT, color: { argb: NAVY } };
}

function freezeTop(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/** 1-based column index → Excel column letters (1 → A, 27 → AA). */
function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function addressOf(project: ExportProject): string {
  return (
    [project.address, project.city, project.state, project.postal_code]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function totalUnits(items: Row[]): number {
  return items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  sheet.columns = widths.map((width) => ({ width })) as Partial<ExcelJS.Column>[];
}

function dataFont(sheet: ExcelJS.Worksheet, rowNumber: number): void {
  sheet.getRow(rowNumber).font = { name: FONT, size: 10 };
}

// ---------------------------------------------------------------------------
// 1. Summary
// ---------------------------------------------------------------------------

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  project: ExportProject,
  items: Row[],
  pageCount: number | null,
): void {
  const sheet = workbook.addWorksheet("Summary");
  sheet.addRow([project.name]).font = {
    bold: true,
    size: 16,
    name: FONT,
    color: { argb: NAVY },
  };
  sheet.addRow(["Window / Door / Sliding Door / Storefront Takeoff"]).font = {
    italic: true,
    size: 11,
    name: FONT,
  };
  sheet.addRow([]);
  sectionTitle(sheet, "PROJECT FACTS");
  const facts: [string, string][] = [
    ["Total Buildings", "— (from takeoff data)"],
    ["Total Line Items", String(items.length)],
    ["Total Units counted", String(totalUnits(items))],
    ["Architect", project.architect ?? "—"],
    ["Drawing Set Pages", pageCount === null ? "—" : String(pageCount)],
  ];
  for (const [label, value] of facts) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, name: FONT, size: 10 };
    row.getCell(2).font = { name: FONT, size: 10 };
  }
  sheet.addRow([]);
  sectionTitle(sheet, "TAKEOFF QUANTITIES — HIGH-LEVEL");
  const buildings = buildingsFromItems(items);
  const headers = ["Category", ...buildings, "Total", "Notes"];
  const headerRowNumber = sheet.rowCount + 1;
  sheet.addRow(headers);
  styleHeader(sheet, headerRowNumber);
  const summaries = summarizeByCategory(items, SUMMARY_CATEGORIES, buildings);
  for (const s of summaries) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      s.category.label,
      ...buildings.map((b) => s.perBuilding[b] ?? 0),
      s.total,
      s.category.notes,
    ]);
    dataFont(sheet, rowNumber);
  }
  sheet.addRow([]);
  sectionTitle(sheet, "IMPORTANT NOTES FOR BIDDING");
  BIDDING_NOTES.forEach((note, i) => {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([`${i + 1}. ${note}`]);
    dataFont(sheet, rowNumber);
  });
  setWidths(sheet, [26, ...buildings.map(() => 14), 12, 64]);
}

// ---------------------------------------------------------------------------
// 2. Windows
// ---------------------------------------------------------------------------

function addWindowsSheet(workbook: ExcelJS.Workbook, items: Row[]): void {
  const buildings = buildingsFromItems(items);
  const rows = windowsByMark(items);
  const sheet = workbook.addWorksheet("Windows");
  const headers = [
    "Type",
    "Width",
    "Height",
    "Total Ht",
    "Style / Notes",
    ...buildings,
    "TOTAL",
    "Source",
  ];
  sheet.addRow(headers);
  styleHeader(sheet);
  const firstDataRow = 2;
  for (const r of rows) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      r.mark,
      formatFtIn(r.widthIn),
      formatFtIn(r.heightIn),
      formatFtIn(r.heightIn),
      r.styleNotes,
      ...buildings.map((b) => r.perBuilding[b] ?? 0),
      r.total,
      r.sources.join(", "),
    ]);
    dataFont(sheet, rowNumber);
  }
  // TOTAL row — =SUM() formulas per building column, grand total across them.
  const totalRowNumber = sheet.rowCount + 1;
  const firstBuildingCol = 6; // A–E fixed, buildings start at F
  const values: ExcelJS.CellValue[] = ["TOTAL", "", "", "", ""];
  for (let i = 0; i < buildings.length; i++) {
    const col = colLetter(firstBuildingCol + i);
    values.push(
      rows.length > 0 ? { formula: `SUM(${col}${firstDataRow}:${col}${totalRowNumber - 1})` } : 0,
    );
  }
  const firstCol = colLetter(firstBuildingCol);
  const lastCol = colLetter(firstBuildingCol + buildings.length - 1);
  values.push(
    rows.length > 0
      ? { formula: `SUM(${firstCol}${totalRowNumber}:${lastCol}${totalRowNumber})` }
      : 0,
  );
  values.push("");
  const totalRow = sheet.addRow(values);
  totalRow.font = { bold: true, name: FONT, size: 10 };
  setWidths(sheet, [14, 10, 10, 10, 30, ...buildings.map(() => 12), 10, 30]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 3. Doors_Summary
// ---------------------------------------------------------------------------

function addDoorsSummarySheet(workbook: ExcelJS.Workbook, items: Row[]): void {
  const buildings = buildingsFromItems(items);
  const rows = doorsByMark(items);
  const sheet = workbook.addWorksheet("Doors_Summary");
  const headers = ["Door Type", "Description", ...buildings, "Total"];
  sheet.addRow(headers);
  styleHeader(sheet);
  const firstDataRow = 2;
  for (const r of rows) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([r.mark, r.description, ...buildings.map((b) => r.perBuilding[b] ?? 0), r.total]);
    dataFont(sheet, rowNumber);
  }
  const totalRowNumber = sheet.rowCount + 1;
  const firstBuildingCol = 3; // A–B fixed, buildings start at C
  const values: ExcelJS.CellValue[] = ["TOTAL", ""];
  for (let i = 0; i < buildings.length; i++) {
    const col = colLetter(firstBuildingCol + i);
    values.push(
      rows.length > 0 ? { formula: `SUM(${col}${firstDataRow}:${col}${totalRowNumber - 1})` } : 0,
    );
  }
  const firstCol = colLetter(firstBuildingCol);
  const lastCol = colLetter(firstBuildingCol + buildings.length - 1);
  values.push(
    rows.length > 0
      ? { formula: `SUM(${firstCol}${totalRowNumber}:${lastCol}${totalRowNumber})` }
      : 0,
  );
  const totalRow = sheet.addRow(values);
  totalRow.font = { bold: true, name: FONT, size: 10 };
  setWidths(sheet, [14, 36, ...buildings.map(() => 12), 10]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 4. Doors_Itemized
// ---------------------------------------------------------------------------

function addDoorsItemizedSheet(workbook: ExcelJS.Workbook, items: Row[]): void {
  const sheet = workbook.addWorksheet("Doors_Itemized");
  const headers = [
    "Building",
    "Level",
    "Door No.",
    "Room Name",
    "Leaf",
    "Width",
    "Height",
    "Door Type",
  ];
  sheet.addRow(headers);
  styleHeader(sheet);
  const doors = sortDoorItems(items);
  for (const d of doors) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      d.building ?? "—",
      d.floor ?? "—",
      d.mark ?? "—",
      d.room ?? "—",
      leafFor(d),
      formatFtIn(d.width_in),
      formatFtIn(d.height_in),
      d.mark ?? "—",
    ]);
    dataFont(sheet, rowNumber);
  }
  if (!doors.length) sheet.addRow(["No doors in the takeoff."]);
  setWidths(sheet, [16, 12, 12, 24, 8, 10, 10, 12]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 5. Unit_Doors (from schedule entries)
// ---------------------------------------------------------------------------

function addUnitDoorsSheet(workbook: ExcelJS.Workbook, scheduleEntries: ScheduleEntry[]): void {
  const sheet = workbook.addWorksheet("Unit_Doors");
  const headers = [
    "Unit Door No.",
    "Room Use",
    "Leaf",
    "Width",
    "Height",
    "Thickness",
    "Door Type",
    "Material",
    "Notes",
  ];
  sheet.addRow(headers);
  styleHeader(sheet);
  const entries = scheduleEntries
    .filter((e) => /^U\d/i.test(e.mark ?? ""))
    .sort((a, b) => (a.mark ?? "").localeCompare(b.mark ?? ""));
  for (const e of entries) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      e.mark ?? "",
      e.type_label ?? "",
      leafForOperation(e.operation),
      e.width ?? "",
      e.height ?? "",
      "",
      e.mark ?? "",
      e.material ?? "",
      "",
    ]);
    dataFont(sheet, rowNumber);
  }
  if (!entries.length) sheet.addRow(["No unit doors found in the schedule."]);
  setWidths(sheet, [14, 28, 8, 12, 12, 10, 14, 20, 30]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 6. Storefront_Types (from schedule entries)
// ---------------------------------------------------------------------------

function addStorefrontTypesSheet(
  workbook: ExcelJS.Workbook,
  scheduleEntries: ScheduleEntry[],
): void {
  const sheet = workbook.addWorksheet("Storefront_Types");
  const headers = ["Mark", "Length", "Height", "Material", "Finish", "Manufacturer"];
  sheet.addRow(headers);
  styleHeader(sheet);
  const entries = scheduleEntries
    .filter((e) => /^SF/i.test(e.mark ?? ""))
    .sort((a, b) => (a.mark ?? "").localeCompare(b.mark ?? ""));
  for (const e of entries) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      e.mark ?? "",
      e.width ?? "",
      e.height ?? "",
      e.material ?? "",
      "By Manufacturer",
      "See Spec Manual",
    ]);
    dataFont(sheet, rowNumber);
  }
  if (!entries.length) sheet.addRow(["No storefront types found in the schedule."]);
  setWidths(sheet, [12, 12, 12, 24, 20, 20]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 7. Storefront_Doors
// ---------------------------------------------------------------------------

function addStorefrontDoorsSheet(workbook: ExcelJS.Workbook, items: Row[]): void {
  const sheet = workbook.addWorksheet("Storefront_Doors");
  const headers = [
    "Building",
    "Door No.",
    "Room Name",
    "Leaf",
    "Width",
    "Height",
    "Door Type",
    "Description",
  ];
  sheet.addRow(headers);
  styleHeader(sheet);
  const category = SUMMARY_CATEGORIES.find((c) => c.key === "storefront_doors");
  const doors = sortDoorItems(items.filter((i) => (category ? category.matches(i) : false)));
  for (const d of doors) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([
      d.building ?? "—",
      d.mark ?? "—",
      d.room ?? "—",
      leafFor(d),
      formatFtIn(d.width_in),
      formatFtIn(d.height_in),
      d.mark ?? "—",
      d.description ?? "",
    ]);
    dataFont(sheet, rowNumber);
  }
  if (!doors.length) sheet.addRow(["No storefront doors in the takeoff."]);
  setWidths(sheet, [16, 12, 24, 8, 10, 10, 12, 36]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 8. Sliding_Doors
// ---------------------------------------------------------------------------

function addSlidingDoorsSheet(workbook: ExcelJS.Workbook, items: Row[]): void {
  const sheet = workbook.addWorksheet("Sliding_Doors");
  sectionTitle(sheet, "SLIDING DOORS — FINDINGS");
  const category = SUMMARY_CATEGORIES.find((c) => c.key === "sliding_doors");
  const count = category
    ? items.filter((i) => category.matches(i)).reduce((sum, i) => sum + (i.quantity ?? 1), 0)
    : 0;
  const resultRow = sheet.addRow([
    "Result",
    count > 0 ? `${count} sliding doors counted — see Doors tab.` : "No sliding doors found.",
  ]);
  resultRow.getCell(1).font = { bold: true, name: FONT, size: 10 };
  resultRow.getCell(2).font = { name: FONT, size: 10 };
  sheet.addRow([]);
  sheet.addRow(["Findings"]).font = { bold: true, name: FONT, size: 10 };
  SLIDING_FINDINGS.forEach((finding, i) => {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([`${i + 1}.`, finding]);
    dataFont(sheet, rowNumber);
  });
  setWidths(sheet, [10, 90]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// 9. Methodology
// ---------------------------------------------------------------------------

function addMethodologySheet(
  workbook: ExcelJS.Workbook,
  project: ExportProject,
  pageCount: number | null,
  sheetIndex: SheetIndexRow[],
): void {
  const sheet = workbook.addWorksheet("Methodology");
  sectionTitle(sheet, "SOURCE DOCUMENT");
  const info: [string, string][] = [
    ["Project", project.name],
    ["Architect", project.architect ?? "—"],
    ["Address", addressOf(project)],
    ["Total pages", pageCount === null ? "—" : String(pageCount)],
  ];
  for (const [label, value] of info) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, name: FONT, size: 10 };
    row.getCell(2).font = { name: FONT, size: 10 };
  }
  sheet.addRow([]);
  sectionTitle(sheet, "SHEET INDEX");
  const headers = ["Sheet", "Title", "PDF Page", "Used For"];
  const headerRowNumber = sheet.rowCount + 1;
  sheet.addRow(headers);
  styleHeader(sheet, headerRowNumber);
  const shown = visibleSheetIndex(sheetIndex);
  for (const s of shown) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([s.sheet_number ?? "", s.title ?? "", s.page_number, s.category ?? "—"]);
    dataFont(sheet, rowNumber);
  }
  if (!shown.length) sheet.addRow(["No sheet classifications recorded for this project."]);
  sheet.addRow([]);
  sectionTitle(sheet, "METHODOLOGY NOTES");
  METHODOLOGY_NOTES.forEach((note, i) => {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([`${i + 1}. ${note}`]);
    dataFont(sheet, rowNumber);
  });
  setWidths(sheet, [26, 64]);
  freezeTop(sheet);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildTakeoffReportWorkbook(opts: {
  project: ExportProject;
  items: Row[];
  scheduleEntries: ScheduleEntry[];
  sheetIndex: SheetIndexRow[];
  pageCount: number | null;
}): Promise<Blob> {
  const { project, items, scheduleEntries, sheetIndex, pageCount } = opts;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AWM LLC";
  workbook.created = new Date();

  addSummarySheet(workbook, project, items, pageCount);
  addWindowsSheet(workbook, items);
  addDoorsSummarySheet(workbook, items);
  addDoorsItemizedSheet(workbook, items);
  addUnitDoorsSheet(workbook, scheduleEntries);
  addStorefrontTypesSheet(workbook, scheduleEntries);
  addStorefrontDoorsSheet(workbook, items);
  addSlidingDoorsSheet(workbook, items);
  addMethodologySheet(workbook, project, pageCount, sheetIndex);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
