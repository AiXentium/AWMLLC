/**
 * Draft quotes → ViewBuilder worksheet.
 *
 * Flow: approved takeoff items × YKK mapping → quote + quote_items rows
 * (existing tables) → Excel worksheet the estimator follows click-by-click
 * in the ViewBuilder portal. Portal automation fills the worksheet's steps;
 * this worksheet is the human-readable bridge in the meantime.
 *
 * Money rules:
 * - Only status='approved' items enter a quote (quote gate).
 * - Dealer price defaults to 82% of list (observed ≈18% off) and is editable.
 * - Creating a quote freezes a quote_snapshots row (bid defense).
 */
import { supabase } from "@/integrations/supabase/client";
import { quoteGate } from "@/lib/takeoff/verify";
import { logAudit } from "@/lib/audit";

export type YkkMappingInput = {
  takeoffItemId: string;
  productId: string;
  series: string;
  model: string;
  productType: string;
  floridaApproval: string | null;
  baselineListPrice: number | null;
  options?: { color?: string; glass?: string; grille?: string; dp?: string };
};

export type QuoteLineInput = {
  mark: string | null;
  description: string;
  widthIn: number | null;
  heightIn: number | null;
  quantity: number;
  mapping: YkkMappingInput;
};

const DEALER_FACTOR = 0.82;

export type DraftQuoteResult = { quoteId: string; lineCount: number; total: number };

/**
 * Builds a draft quote from approved items + their YKK mappings.
 * Throws if any item is not approved (quote gate).
 */
export async function createDraftQuote(
  projectId: string,
  name: string,
  lines: QuoteLineInput[],
  opts: { notes?: string; dealerFactor?: number; estimator?: string } = {},
): Promise<DraftQuoteResult> {
  // Quote gate: every item must be approved.
  const { data: items, error: itemsError } = await supabase
    .from("takeoff_items")
    .select("id,status,override_reason")
    .eq("project_id", projectId)
    .in(
      "id",
      lines.map((l) => l.mapping.takeoffItemId),
    );
  if (itemsError) throw itemsError;
  // The gate must see every referenced item: a line pointing at a deleted or
  // missing takeoff item is a blocker, not a silent skip.
  const foundIds = new Set(((items ?? []) as { id: string }[]).map((i) => i.id));
  const missing = lines.filter((l) => !foundIds.has(l.mapping.takeoffItemId));
  const blockers = quoteGate((items ?? []) as { id: string; status: string | null }[]);
  if (missing.length) {
    blockers.push(
      `${missing.length} quote line(s) reference takeoff items that no longer exist — remove or re-map them.`,
    );
  }
  if (blockers.length) throw new Error(blockers.join(" "));

  const factor = opts.dealerFactor ?? DEALER_FACTOR;
  let total = 0;
  const quoteRows = lines.map((l, idx) => {
    const list = Number(l.mapping.baselineListPrice ?? 0) || 0;
    const unitPrice = round2(list * factor);
    const lineTotal = round2(unitPrice * l.quantity);
    total += lineTotal;
    return {
      mark: l.mark,
      description: l.description,
      quantity: l.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      metadata: {
        sort: idx + 1,
        takeoff_item_id: l.mapping.takeoffItemId,
        product_id: l.mapping.productId,
        series: l.mapping.series,
        model: l.mapping.model,
        product_type: l.mapping.productType,
        florida_approval: l.mapping.floridaApproval,
        width_in: l.widthIn,
        height_in: l.heightIn,
        list_price: list,
        dealer_factor: factor,
        options: l.mapping.options ?? {},
      },
    };
  });

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      project_id: projectId,
      status: "draft",
      notes: opts.notes ?? null,
      total_amount: round2(total),
      snapshot: {},
    })
    .select("id")
    .single();
  if (quoteError) throw quoteError;

  const { error: linesError } = await supabase
    .from("quote_items")
    .insert(quoteRows.map((r) => ({ ...r, quote_id: quote.id })));
  if (linesError) throw linesError;

  // Freeze a bid-defense snapshot at draft creation.
  const { data: snapshotItems } = await supabase
    .from("takeoff_items")
    .select(
      "id,mark,category,type_name,quantity,multiplier,width_in,height_in,floor,building,status",
    )
    .eq("project_id", projectId)
    .eq("status", "approved");
  await supabase.from("quote_snapshots").insert({
    project_id: projectId,
    quote_id: quote.id,
    name: `Draft: ${name}`,
    estimator: opts.estimator ?? null,
    notes: opts.notes ?? null,
    totals: { line_count: quoteRows.length, total: round2(total), dealer_factor: factor },
    items: snapshotItems ?? [],
    jurisdiction: {},
    overrides: [],
  });

  await logAudit({
    projectId,
    action: "quote.draft_created",
    entityType: "quote",
    entityId: quote.id,
    detail: { name, lineCount: quoteRows.length, total: round2(total) },
  });

  return { quoteId: quote.id, lineCount: quoteRows.length, total: round2(total) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * ViewBuilder-ready worksheet: one row per quote line, columns ordered to
 * match the portal's configurator steps (Product Selection → Dimensions &
 * Performance → Options). The estimator (or future automation) follows it
 * top to bottom.
 */
export async function exportViewBuilderWorksheet(quoteId: string): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id,project_id,notes,total_amount")
    .eq("id", quoteId)
    .single();
  if (qErr) throw qErr;
  const { data: lines, error: lErr } = await supabase
    .from("quote_items")
    .select("mark,description,quantity,unit_price,line_total,metadata")
    .eq("quote_id", quoteId)
    .order("quantity", { ascending: false });
  if (lErr) throw lErr;

  const wb = new ExcelJS.Workbook();
  wb.creator = "AWM Takeoff";
  const ws = wb.addWorksheet("ViewBuilder Worksheet");
  ws.columns = [
    { header: "Line", key: "line", width: 6 },
    { header: "Mark", key: "mark", width: 10 },
    { header: "Series", key: "series", width: 18 },
    { header: "Type", key: "type", width: 20 },
    { header: "Width (in)", key: "w", width: 11 },
    { header: "Height (in)", key: "h", width: 12 },
    { header: "Qty", key: "qty", width: 6 },
    { header: "Color", key: "color", width: 12 },
    { header: "Glass", key: "glass", width: 22 },
    { header: "Grille", key: "grille", width: 14 },
    { header: "DP", key: "dp", width: 8 },
    { header: "FL Approval", key: "fl", width: 13 },
    { header: "Dealer $/ea", key: "unit", width: 12 },
    { header: "Ext. Total", key: "ext", width: 12 },
    { header: "Portal steps", key: "steps", width: 40 },
  ];
  (lines ?? []).forEach((l, idx) => {
    const m = (l.metadata ?? {}) as Record<string, unknown>;
    const o = (m.options ?? {}) as Record<string, string>;
    ws.addRow({
      line: idx + 1,
      mark: l.mark,
      series: String(m.series ?? ""),
      type: String(m.product_type ?? ""),
      w: m.width_in ?? "",
      h: m.height_in ?? "",
      qty: l.quantity,
      color: o.color ?? "",
      glass: o.glass ?? "",
      grille: o.grille ?? "",
      dp: o.dp ?? "",
      fl: m.florida_approval ?? "",
      unit: l.unit_price,
      ext: l.line_total,
      steps: `1) Product Selection: ${m.series} > ${m.product_type}  2) Dimensions & Performance: WxH, DP, FL approval  3) Options: color/glass/grille`,
    });
  });
  const totalRow = ws.addRow({ line: "", mark: "", ext: quote.total_amount });
  totalRow.getCell("ext").font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
