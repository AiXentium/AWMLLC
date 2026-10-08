import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { markerType, typeLabel } from "@/lib/takeoff-types";
import { DEFAULT_COMPANY, companyContactLine, type CompanyInfo } from "@/lib/company-settings";
import type { ExportItem, ExportProject } from "./excel-export";

export async function buildTakeoffPdf(opts: {
  project: ExportProject;
  items: ExportItem[];
  sourceSheets: { sheet: string; title: string; itemCount: number }[];
  company?: CompanyInfo;
}): Promise<Blob> {
  const { project, items, sourceSheets } = opts;
  const company = opts.company ?? DEFAULT_COMPANY;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(22, 35, 59);
  doc.rect(0, 0, width, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(`${company.company_name} — Takeoff Report`, 40, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${company.legal_name} · Independent supplier / distributor`, 40, 42);
  const contact = companyContactLine(company);
  if (contact) doc.text(contact, 40, 55);

  doc.setTextColor(20, 20, 20);
  const address = [project.address, project.city, project.state, project.postal_code]
    .filter(Boolean)
    .join(", ");
  const meta: [string, string][] = [
    ["Project", project.name],
    ["Project number", project.project_number ?? "—"],
    ["Address", address || "—"],
    ["County / AHJ", [project.county, project.municipality].filter(Boolean).join(" / ") || "—"],
    ["General contractor", project.general_contractor ?? "—"],
    ["Architect", project.architect ?? "—"],
    ["Estimator", company.estimator_name ?? "—"],
    ["Status", project.status],
    ["Generated", new Date().toLocaleString()],
  ];

  autoTable(doc, {
    startY: 80,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    body: meta.map(([k, v]) => [{ content: k, styles: { fontStyle: "bold" as const } }, v]),
    columnStyles: { 0: { cellWidth: 120 } },
  });

  const totalsMap = new Map<string, number>();
  items.forEach((i) => {
    const key = i.product_type ?? "unclassified";
    totalsMap.set(key, (totalsMap.get(key) ?? 0) + (i.quantity ?? 1));
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [["Color", "Type", "Category", "Quantity"]],
    headStyles: { fillColor: [22, 35, 59] },
    styles: { fontSize: 9 },
    body: [...totalsMap.entries()].map(([key, qty]) => [
      "",
      typeLabel(key),
      markerType(key)?.category ?? "—",
      String(qty),
    ]),
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const key = [...totalsMap.keys()][data.row.index];
        const hex = markerType(key)?.color ?? "#64748b";
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        doc.setFillColor(r, g, b);
        doc.rect(data.cell.x + 4, data.cell.y + 3, 12, data.cell.height - 6, "F");
      }
    },
  });

  const locationMap = new Map<string, number>();
  items.forEach((i) => {
    const key = `${i.building ?? "Unassigned"}|${i.floor ?? "Unassigned"}`;
    locationMap.set(key, (locationMap.get(key) ?? 0) + (i.quantity ?? 1));
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [["Building", "Floor", "Quantity"]],
    headStyles: { fillColor: [22, 35, 59] },
    styles: { fontSize: 9 },
    body: [...locationMap.entries()].map(([key, qty]) => {
      const [building, floor] = key.split("|");
      return [building, floor, String(qty)];
    }),
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [
      [
        "Image",
        "#",
        "Mark",
        "Type",
        "Building",
        "Floor",
        "Room",
        "Qty",
        "W (in)",
        "H (in)",
        "Source Page",
        "Review",
        "Notes",
      ],
    ],
    headStyles: { fillColor: [22, 35, 59] },
    styles: { fontSize: 8, cellPadding: 3, minCellHeight: 26 },
    columnStyles: { 0: { cellWidth: 46 } },
    body: items.map((i, index) => [
      "",
      String(index + 1),
      i.mark ?? "",
      typeLabel(i.product_type),
      i.building ?? "",
      i.floor ?? "",
      i.room ?? "",
      String(i.quantity ?? 1),
      i.width_in ?? "",
      i.height_in ?? "",
      i.page_label ?? "",
      i.status,
      i.notes ?? "",
    ]),
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const item = items[data.row.index];
      if (!item?.imageData) return;
      try {
        doc.addImage(
          new Uint8Array(item.imageData),
          "JPEG",
          data.cell.x + 2,
          data.cell.y + 2,
          42,
          data.cell.height - 4,
        );
      } catch {
        /* skip unreadable image */
      }
    },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [["Source sheet", "Title", "Marked items"]],
    headStyles: { fillColor: [22, 35, 59] },
    styles: { fontSize: 9 },
    body: sourceSheets.map((s) => [s.sheet, s.title, String(s.itemCount)]),
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  doc.setFontSize(8);
  doc.text(
    [
      ...(company.default_report_notes ? [`Notes: ${company.default_report_notes}`] : []),
      "Assumptions & exclusions: quantities reflect markers placed on the reviewed plan sheets only. Measurements are unverified unless a page scale is confirmed.",
      `${company.company_name} is an independent supplier/distributor. Product availability, performance ratings, approvals and installation requirements are subject to manufacturer confirmation.`,
      "This report is not a permit document, engineering judgment, or legal advice.",
    ],
    40,
    Math.min(finalY, doc.internal.pageSize.getHeight() - 48),
    { maxWidth: width - 80 },
  );

  return doc.output("blob");
}
