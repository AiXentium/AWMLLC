/**
 * Branded proposal PDF generator for AWM LLC.
 *
 * Turns a verified takeoff + YKK product mapping into the bid document
 * Washington actually sends: line items with quantities and pricing,
 * alternates with deltas, Florida product approval IDs, inclusions /
 * exclusions / assumptions, validity period, and signature lines.
 *
 * Pure function of its input — every number on the page comes from the
 * caller. Nothing is computed from thin air except section layout.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ProposalCompany {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ProposalProject {
  name: string;
  address?: string | null;
  /** Display date, e.g. "October 4, 2026". Defaults to today. */
  date?: string | null;
}

export interface ProposalCustomer {
  name: string;
  company?: string | null;
}

export interface ProposalLine {
  mark: string;
  description: string;
  size?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ProposalAlternate {
  name: string;
  description?: string | null;
  /** Price delta vs the base proposal. Positive = add, negative = deduct. */
  delta: number;
}

export interface ProposalApproval {
  mark: string;
  flApprovalId: string;
}

export interface ProposalPdfInput {
  company: ProposalCompany;
  project: ProposalProject;
  customer: ProposalCustomer;
  lines: ProposalLine[];
  subtotal: number;
  tax: number;
  total: number;
  alternates?: ProposalAlternate[];
  inclusions?: string[];
  exclusions?: string[];
  /** e.g. unresolved verification items carried in as assumptions. */
  assumptions?: string[];
  approvals?: ProposalApproval[];
  validityDays: number;
  notes?: string | null;
}

const NAVY: [number, number, number] = [22, 35, 59];
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];
const MARGIN = 40;
const PAGE_W = 612; // letter portrait, pt
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 748;

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function deltaMoney(n: number): string {
  if (n > 0) return `+${money(n)}`;
  if (n < 0) return `-${money(Math.abs(n))}`;
  return money(0);
}

type FinalY = { lastAutoTable: { finalY: number } };

function drawHeader(doc: jsPDF, input: ProposalPdfInput, dateStr: string): void {
  const { company } = input;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(company.name, MARGIN, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contact = [company.address, company.phone, company.email].filter(Boolean).join("   |   ");
  if (contact) doc.text(contact, MARGIN, 47);
  doc.text("Windows & Patio Doors — Supplier / Distributor", MARGIN, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("PROPOSAL", PAGE_W - MARGIN, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Date: ${dateStr}`, PAGE_W - MARGIN, 56, { align: "right" });
  doc.setTextColor(...INK);
}

/** Advances y, adding a page when the next block would overflow. */
function needSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > BOTTOM) {
    doc.addPage();
    return 56;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = needSpace(doc, y, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  const label = title.toUpperCase();
  doc.text(label, MARGIN, y);
  const w = Math.max(doc.getTextWidth(label), 140);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  doc.line(MARGIN, y + 5, MARGIN + w, y + 5);
  doc.setTextColor(...INK);
  return y + 20;
}

function bulletList(doc: jsPDF, items: string[], y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, CONTENT_W - 16);
    for (let i = 0; i < lines.length; i++) {
      y = needSpace(doc, y, 14);
      doc.text(i === 0 ? "\u2022" : "", MARGIN + 4, y);
      doc.text(lines[i], MARGIN + 16, y);
      y += 13;
    }
    y += 3;
  }
  return y;
}

function paragraph(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  for (const line of lines) {
    y = needSpace(doc, y, 14);
    doc.text(line, MARGIN, y);
    y += 13;
  }
  return y + 4;
}

function infoBlock(doc: jsPDF, input: ProposalPdfInput, dateStr: string, y: number): number {
  const leftX = MARGIN;
  const rightX = PAGE_W / 2 + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("PROJECT", leftX, y);
  doc.text("PREPARED FOR", rightX, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const leftLines = [input.project.name, input.project.address ?? "", `Date: ${dateStr}`].filter(
    Boolean,
  );
  const rightLines = [input.customer.name, input.customer.company ?? ""].filter(Boolean);
  const rows = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < rows; i++) {
    y = needSpace(doc, y, 14);
    if (leftLines[i]) doc.text(leftLines[i], leftX, y);
    if (rightLines[i]) doc.text(rightLines[i], rightX, y);
    y += 13;
  }
  return y + 6;
}

export async function buildProposalPdf(input: ProposalPdfInput): Promise<Blob> {
  const dateStr =
    input.project.date ??
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  drawHeader(doc, input, dateStr);

  let y = infoBlock(doc, input, dateStr, 104);

  // ---- Line items -------------------------------------------------------
  y = sectionTitle(doc, "Scope of Work", y);
  autoTable(doc, {
    startY: y,
    head: [["Mark", "Description", "Size", "Qty", "Unit Price", "Total"]],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 52 },
      3: { halign: "right", cellWidth: 40 },
      4: { halign: "right", cellWidth: 70 },
      5: { halign: "right", cellWidth: 78 },
    },
    body:
      input.lines.length > 0
        ? input.lines.map((l) => [
            l.mark,
            l.description,
            l.size ?? "\u2014",
            String(l.quantity),
            money(l.unitPrice),
            money(l.total),
          ])
        : [[{ content: "No line items.", colSpan: 6, styles: { halign: "center" as const } }]],
  });
  y = (doc as unknown as FinalY).lastAutoTable.finalY + 16;

  // ---- Totals -------------------------------------------------------------
  y = needSpace(doc, y, 64);
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const totalRows: [string, string, boolean][] = [
    ["Subtotal", money(input.subtotal), false],
    ["Tax", money(input.tax), false],
    ["Proposal Total", money(input.total), true],
  ];
  for (const [label, value, bold] of totalRows) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    if (bold) doc.setFontSize(12);
    doc.text(label, PAGE_W - MARGIN - 120, y, { align: "right" });
    doc.text(value, PAGE_W - MARGIN, y, { align: "right" });
    y += bold ? 18 : 15;
    doc.setFontSize(10);
  }
  if (totalRows.length > 0) {
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(1);
    doc.line(PAGE_W - MARGIN - 190, y - 8, PAGE_W - MARGIN, y - 8);
  }
  y += 10;

  // ---- Alternates -----------------------------------------------------------
  const alternates = input.alternates ?? [];
  if (alternates.length > 0) {
    y = sectionTitle(doc, "Alternates", y);
    autoTable(doc, {
      startY: y,
      head: [["Alternate", "Description", "Price Delta"]],
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 150 },
        2: { halign: "right", cellWidth: 90 },
      },
      body: alternates.map((a) => [a.name, a.description ?? "\u2014", deltaMoney(a.delta)]),
    });
    y = (doc as unknown as FinalY).lastAutoTable.finalY + 14;
    y = paragraph(
      doc,
      "Alternates are priced as additions to (+) or deductions from (\u2212) the Proposal Total above and are valid for the same period.",
      y,
    );
  }

  // ---- Florida product approvals --------------------------------------------
  const approvals = input.approvals ?? [];
  if (approvals.length > 0) {
    y = sectionTitle(doc, "Florida Product Approvals", y);
    autoTable(doc, {
      startY: y,
      head: [["Mark", "Florida Product Approval ID"]],
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 120 } },
      body: approvals.map((a) => [a.mark, a.flApprovalId]),
    });
    y = (doc as unknown as FinalY).lastAutoTable.finalY + 14;
    y = paragraph(
      doc,
      "Approval IDs shown are per the configured design pressure and Florida Building Code product approval listings. Verify current approval status at floridabuilding.org prior to permit submittal.",
      y,
    );
  }

  // ---- Inclusions / Exclusions / Assumptions ---------------------------------
  const inclusions = input.inclusions ?? [];
  if (inclusions.length > 0) {
    y = sectionTitle(doc, "Inclusions", y);
    y = bulletList(doc, inclusions, y);
  }
  const exclusions = input.exclusions ?? [];
  if (exclusions.length > 0) {
    y = sectionTitle(doc, "Exclusions", y);
    y = bulletList(doc, exclusions, y);
  }
  const assumptions = input.assumptions ?? [];
  if (assumptions.length > 0) {
    y = sectionTitle(doc, "Assumptions & Open Items", y);
    y = bulletList(doc, assumptions, y);
  }

  // ---- Validity + notes -------------------------------------------------------
  y = sectionTitle(doc, "Terms", y);
  y = paragraph(
    doc,
    `This proposal is valid for ${input.validityDays} days from the date shown above. Pricing is based on the plans and specifications available at the time of takeoff; changes, addenda, or revised selections may affect pricing.`,
    y,
  );
  if (input.notes && input.notes.trim()) {
    y = paragraph(doc, input.notes.trim(), y);
  }

  // ---- Signatures ---------------------------------------------------------------
  y = needSpace(doc, y, 110);
  y = sectionTitle(doc, "Acceptance", y);
  y = paragraph(
    doc,
    "By signing below, the customer accepts this proposal and authorizes AWM LLC to proceed per the scope, terms, and pricing above.",
    y,
  );
  y = needSpace(doc, y, 80);
  const sigW = 220;
  const sigY = y + 34;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
  doc.line(PAGE_W - MARGIN - sigW, sigY, PAGE_W - MARGIN, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Customer signature", MARGIN, sigY + 14);
  doc.text("Date", MARGIN, sigY + 27);
  doc.text(`${input.company.name} — Authorized signature`, PAGE_W - MARGIN - sigW, sigY + 14);
  doc.text("Date", PAGE_W - MARGIN - sigW, sigY + 27);
  doc.setTextColor(...INK);

  // ---- Footer page numbers ----------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(input.company.name, MARGIN, 775);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, 775, { align: "right" });
  }

  return doc.output("blob");
}
