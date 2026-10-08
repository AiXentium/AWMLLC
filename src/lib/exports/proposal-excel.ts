/**
 * Proposal Excel workbook - mirrors the on-screen Proposal tab layout.
 *
 * Same column order as the screen (Mark | Description | Size | Qty |
 * Floor/Building | Status), same grouping, same totals section. Consumes
 * GroupedProposalLine[] from proposal-lines.ts - single source of truth.
 *
 * Styling follows src/lib/exports/excel-export.ts conventions:
 * navy header row, frozen header, Arial 10.
 */
import ExcelJS from "exceljs";
import type { GroupedProposalLine } from "@/components/app/proposal/proposal-lines";

const NAVY = "FF16233B";
const MUTED = "FF6E6E6E";
const AMBER = "FFB45309";

export interface ProposalExcelInput {
  company: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  project: {
    name: string;
    address?: string | null;
    date?: string | null;
    preparedFor?: string | null;
  };
  lines: GroupedProposalLine[];
  totalUnits: number;
  verifiedCount: number;
  unverifiedCount: number;
  byCategory: { category: string; units: number }[];
  validityDays: number;
  notes?: string | null;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function labelRow(sheet: ExcelJS.Worksheet, label: string, value: string) {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { bold: true, name: "Arial", size: 10 };
  row.getCell(2).font = { name: "Arial", size: 10 };
  row.alignment = { vertical: "middle", wrapText: true };
  return row;
}

export async function buildProposalWorkbook(input: ProposalExcelInput): Promise<Blob> {
  const { company, project, lines } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = company.name;
  wb.created = new Date();
  const sheet = wb.addWorksheet("Proposal");

  const dateStr =
    project.date ??
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Title block
  sheet.addRow([company.name + " - Proposal"]).font = {
    bold: true,
    size: 16,
    name: "Arial",
    color: { argb: NAVY },
  };
  const contact = [company.address, company.phone, company.email].filter(Boolean).join("  |  ");
  if (contact) {
    sheet.addRow([contact]).font = { size: 9, name: "Arial", color: { argb: MUTED } };
  }
  sheet.addRow([]);
  labelRow(sheet, "Project", project.name);
  labelRow(sheet, "Address", project.address || "-");
  labelRow(sheet, "Date", dateStr);
  labelRow(sheet, "Prepared for", project.preparedFor || "To be confirmed");
  sheet.addRow([]);

  // Line items - same column order as the on-screen table
  const HEADERS = ["Mark", "Description", "Size", "Qty", "Floor/Building", "Status"];
  const headerRowNumber = sheet.rowCount + 1;
  sheet.addRow(HEADERS);
  styleHeaderRow(sheet, headerRowNumber);
  sheet.columns = [
    { width: 14 },
    { width: 44 },
    { width: 18 },
    { width: 10 },
    { width: 26 },
    { width: 16 },
  ] as Partial<ExcelJS.Column>[];

  for (const l of lines) {
    const row = sheet.addRow([
      l.mark,
      l.description,
      l.size,
      l.quantity,
      l.locations,
      l.allApproved ? "Verified" : "Needs review",
    ]);
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle", wrapText: true };
    if (!l.allApproved) {
      row.getCell(6).font = { name: "Arial", size: 10, bold: true, color: { argb: AMBER } };
    }
  }
  if (lines.length === 0) {
    sheet.addRow(["No line items - run takeoff first."]);
  }

  sheet.addRow([]);

  // Totals section
  const t = sheet.addRow(["Total units", input.totalUnits]);
  t.getCell(1).font = { bold: true, name: "Arial", size: 11 };
  t.getCell(2).font = { bold: true, name: "Arial", size: 11 };
  sheet.addRow([]);

  const cb = sheet.addRow(["Units by category", ""]);
  cb.getCell(1).font = { bold: true, name: "Arial", size: 10 };
  for (const c of input.byCategory) {
    labelRow(sheet, c.category, String(c.units));
  }
  sheet.addRow([]);

  // Verification summary
  const vs = sheet.addRow(["Verification summary", ""]);
  vs.getCell(1).font = { bold: true, name: "Arial", size: 10 };
  labelRow(sheet, "Verified lines", String(input.verifiedCount));
  labelRow(sheet, "Needs review", String(input.unverifiedCount));
  if (input.unverifiedCount > 0) {
    sheet.addRow(["Review unverified lines in the Takeoff tab before sending."]).font = {
      italic: true,
      name: "Arial",
      size: 10,
      color: { argb: AMBER },
    };
  }
  sheet.addRow([]);

  // Terms + notes
  labelRow(
    sheet,
    "Terms",
    "Valid " +
      input.validityDays +
      " days. Unit pricing TBD - quantities auto-populated from AI takeoff.",
  );
  if (input.notes && input.notes.trim()) {
    labelRow(sheet, "Notes", input.notes.trim());
  }

  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
