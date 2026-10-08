import { supabase } from "@/integrations/supabase/client";
import { typeLabel } from "@/lib/takeoff-types";
import type { AiAgentKey, AiContext, AiSource, ToolResult } from "./types";

export type ToolDef = {
  name: string;
  label: string;
  agent: AiAgentKey;
  description: string;
  readOnly: boolean;
  run: (ctx: AiContext, args?: Record<string, unknown>) => Promise<ToolResult>;
};

const needProject = (ctx: AiContext) => {
  if (!ctx.projectId) throw new Error("Select a project first — this lookup is project-scoped.");
  return ctx.projectId;
};

const projectSource = (ctx: AiContext): AiSource => ({
  type: "project",
  label: `Project record — ${ctx.projectName ?? ctx.projectId}`,
  entityId: ctx.projectId,
});

function bullets(rows: string[], empty: string) {
  if (!rows.length) return `_${empty}_`;
  return rows.map((r) => `- ${r}`).join("\n");
}

const ITEM_COLUMNS =
  "id,mark,category,product_type,quantity,width_in,height_in,building,floor,room,unit,elevation,glass,operation,color,finish,system,frame_type,impact,status,notes,primary_image_path,page_id,pages(sheet_number,page_number,title)";

type ItemRow = {
  id: string;
  mark: string | null;
  category: string;
  product_type: string | null;
  quantity: number | null;
  width_in: number | null;
  height_in: number | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  unit: string | null;
  elevation: string | null;
  glass: string | null;
  operation: string | null;
  color: string | null;
  finish: string | null;
  system: string | null;
  frame_type: string | null;
  impact: boolean | null;
  status: string;
  notes: string | null;
  primary_image_path: string | null;
  page_id: string | null;
  pages: { sheet_number: string | null; page_number: number; title: string | null } | null;
};

async function loadItems(projectId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from("takeoff_items")
    .select(ITEM_COLUMNS)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("mark");
  if (error) throw error;
  return (data ?? []) as unknown as ItemRow[];
}

const sheetOf = (r: ItemRow) =>
  r.pages?.sheet_number ?? (r.pages ? `Page ${r.pages.page_number}` : "Unassigned");

function tally<T>(rows: T[], key: (r: T) => string, qty: (r: T) => number) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(key(r), (map.get(key(r)) ?? 0) + qty(r)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function itemSources(rows: ItemRow[], limit = 8): AiSource[] {
  return rows.slice(0, limit).map((r) => ({
    type: "takeoff_item" as const,
    label: `${r.mark ?? "Unmarked"} · ${sheetOf(r)}`,
    entityId: r.id,
  }));
}

export const TOOLS: ToolDef[] = [
  {
    name: "read_project_summary",
    label: "Read project summary",
    agent: "general",
    description: "Project record, status, location and team fields.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,name,project_number,status,project_type,address,city,state,county,postal_code,general_contractor,architect,municipality,buildings,floors,due_date,notes,created_at",
        )
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Project not found or not visible to your account.");
      const lines = [
        `**${data.name}**${data.project_number ? ` (${data.project_number})` : ""}`,
        `Status: ${data.status} · Type: ${data.project_type ?? "—"}`,
        `Location: ${[data.address, data.city, data.state, data.postal_code].filter(Boolean).join(", ") || "—"}`,
        `County / AHJ area: ${data.county ?? "—"} · Municipality: ${data.municipality ?? "—"}`,
        `GC: ${data.general_contractor ?? "—"} · Architect: ${data.architect ?? "—"}`,
        `Buildings: ${(data.buildings ?? []).join(", ") || "—"} · Floors: ${(data.floors ?? []).join(", ") || "—"}`,
      ];
      return { summary: lines.join("\n\n"), data, sources: [projectSource(ctx)] };
    },
  },
  {
    name: "read_document_pages",
    label: "Read plan documents and pages",
    agent: "document",
    description: "Plan sets, page counts, sheet numbers and processing state.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const [{ data: docs, error: de }, { data: pages, error: pe }] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,kind,status,page_count,original_filename,created_at")
          .eq("project_id", projectId)
          .order("created_at"),
        supabase
          .from("pages")
          .select(
            "id,page_number,sheet_number,title,discipline,building,floor,state,classification",
          )
          .eq("project_id", projectId)
          .order("page_number"),
      ]);
      if (de) throw de;
      if (pe) throw pe;
      const docLines = (docs ?? []).map(
        (d) => `${d.name} — ${d.kind}, ${d.status}, ${d.page_count ?? 0} pages`,
      );
      const sheetLines = (pages ?? [])
        .slice(0, 30)
        .map(
          (p) =>
            `${p.sheet_number ?? `Page ${p.page_number}`} — ${p.title ?? "Untitled"} (${p.state})`,
        );
      return {
        summary: [
          `**Plan documents (${docs?.length ?? 0})**`,
          bullets(docLines, "No plan sets uploaded yet."),
          `**Pages (${pages?.length ?? 0})**`,
          bullets(sheetLines, "No pages extracted yet."),
        ].join("\n\n"),
        data: { documents: docs ?? [], pages: pages ?? [] },
        sources: [
          projectSource(ctx),
          ...(docs ?? []).slice(0, 5).map((d) => ({
            type: "document" as const,
            label: `Plan document — ${d.name}`,
            entityId: d.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_page_markup",
    label: "Read sheet markup and measurements",
    agent: "document",
    description:
      "Highlighted areas and calibrated measurements drawn by estimators on plan sheets.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("annotations")
        .select("id,tool,label,page_id,created_at,pages(page_number,sheet_number,title)")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at")
        .limit(200);
      if (error) throw error;
      const rows = data ?? [];
      const lines = rows.slice(0, 40).map((a) => {
        const p = a.pages as {
          page_number: number;
          sheet_number: string | null;
          title: string | null;
        } | null;
        const sheet = p?.sheet_number ?? (p ? `Page ${p.page_number}` : "Unknown sheet");
        return `${sheet} — ${a.tool === "measure" ? "Measurement" : "Marked area"}: ${a.label ?? "no label"}`;
      });
      return {
        summary: [
          `**Sheet markup (${rows.length})**`,
          bullets(lines, "No markup recorded yet."),
        ].join("\n\n"),
        data: { annotations: rows },
        sources: [projectSource(ctx)],
      };
    },
  },

  {
    name: "read_takeoff_counts",
    label: "Read takeoff counts and grouped totals",
    agent: "takeoff",
    description: "Exact counts grouped by category, type, building, floor and sheet.",
    readOnly: true,
    async run(ctx, args) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const filterCategory = typeof args?.category === "string" ? (args.category as string) : null;
      const scoped = filterCategory ? rows.filter((r) => r.category === filterCategory) : rows;
      const qty = (r: ItemRow) => r.quantity ?? 1;
      const total = scoped.reduce((s, r) => s + qty(r), 0);

      const fmt = (pairs: [string, number][]) =>
        bullets(
          pairs.map(([k, v]) => `${k || "Unassigned"}: **${v}**`),
          "No data recorded.",
        );

      const summary = [
        `**${total}** counted unit${total === 1 ? "" : "s"} across **${scoped.length}** line item${scoped.length === 1 ? "" : "s"}${filterCategory ? ` in category \`${filterCategory}\`` : ""}.`,
        "**By category**",
        fmt(tally(scoped, (r) => r.category, qty)),
        "**By product type**",
        fmt(tally(scoped, (r) => typeLabel(r.product_type), qty)),
        "**By building**",
        fmt(tally(scoped, (r) => r.building ?? "Unassigned", qty)),
        "**By floor**",
        fmt(tally(scoped, (r) => r.floor ?? "Unassigned", qty)),
        "**By sheet**",
        fmt(tally(scoped, sheetOf, qty)),
        "**By review status**",
        fmt(tally(scoped, (r) => r.status, qty)),
      ].join("\n\n");

      return {
        summary,
        data: {
          total,
          lineItems: scoped.length,
          byCategory: tally(scoped, (r) => r.category, qty),
          byType: tally(scoped, (r) => typeLabel(r.product_type), qty),
          byBuilding: tally(scoped, (r) => r.building ?? "Unassigned", qty),
          byFloor: tally(scoped, (r) => r.floor ?? "Unassigned", qty),
          bySheet: tally(scoped, sheetOf, qty),
        },
        sources: [projectSource(ctx), ...itemSources(scoped)],
      };
    },
  },
  {
    name: "search_takeoff_items",
    label: "Search takeoff items",
    agent: "takeoff",
    description: "Find items by mark, type, sheet, building or floor.",
    readOnly: true,
    async run(ctx, args) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const q = String(args?.query ?? "")
        .toLowerCase()
        .trim();
      const category = typeof args?.category === "string" ? (args.category as string) : null;
      const types = Array.isArray(args?.productTypes) ? (args.productTypes as string[]) : null;
      const sheet = typeof args?.sheet === "string" ? (args.sheet as string).toLowerCase() : null;

      const hits = rows.filter((r) => {
        if (category && r.category !== category) return false;
        if (types && !types.includes(r.product_type ?? "")) return false;
        if (sheet && !sheetOf(r).toLowerCase().includes(sheet)) return false;
        if (!q) return true;
        return [r.mark, r.product_type, r.building, r.floor, r.room, r.notes, sheetOf(r)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });

      const lines = hits
        .slice(0, 40)
        .map(
          (r) =>
            `**${r.mark ?? "Unmarked"}** — ${typeLabel(r.product_type)} · qty ${r.quantity ?? 1} · ${r.width_in ?? "?"}″×${r.height_in ?? "?"}″ · ${r.building ?? "—"}/${r.floor ?? "—"} · ${sheetOf(r)} · ${r.status}`,
        );

      return {
        summary: [
          `Found **${hits.length}** matching item${hits.length === 1 ? "" : "s"}.`,
          bullets(lines, "No matches."),
        ].join("\n\n"),
        data: { count: hits.length, items: hits.slice(0, 40) },
        sources: [projectSource(ctx), ...itemSources(hits)],
      };
    },
  },
  {
    name: "read_selected_item",
    label: "Read selected item details",
    agent: "takeoff",
    description: "Full record for the currently selected takeoff item.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      if (!ctx.itemId) throw new Error("No takeoff item is selected in the workspace right now.");
      const rows = await loadItems(projectId);
      const item = rows.find((r) => r.id === ctx.itemId);
      if (!item) throw new Error("The selected item is no longer available.");
      const lines = Object.entries({
        Mark: item.mark,
        Category: item.category,
        Type: typeLabel(item.product_type),
        Quantity: item.quantity,
        Width: item.width_in,
        Height: item.height_in,
        Building: item.building,
        Floor: item.floor,
        Room: item.room,
        Elevation: item.elevation,
        Glass: item.glass,
        Operation: item.operation,
        Color: item.color,
        Finish: item.finish,
        System: item.system,
        Frame: item.frame_type,
        Impact: item.impact,
        Status: item.status,
        Sheet: sheetOf(item),
        Image: item.primary_image_path ? "saved crop" : "none",
      }).map(([k, v]) => `${k}: **${v ?? "—"}**`);
      return {
        summary: bullets(lines, "No detail."),
        data: item as unknown as Record<string, unknown>,
        sources: [
          projectSource(ctx),
          {
            type: "takeoff_item",
            label: `Takeoff item ${item.mark ?? item.id}`,
            entityId: item.id,
          },
        ],
      };
    },
  },
  {
    name: "read_missing_fields",
    label: "Find items with missing fields",
    agent: "quality_control",
    description: "Items missing width, height, image, location, mark or type.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const problems = rows
        .map((r) => {
          const missing: string[] = [];
          if (!r.mark) missing.push("mark");
          if (!r.product_type) missing.push("type");
          if (r.width_in == null) missing.push("width");
          if (r.height_in == null) missing.push("height");
          if (!r.primary_image_path) missing.push("image");
          if (!r.building && !r.floor && !r.room) missing.push("location");
          if (!r.page_id) missing.push("source sheet");
          return { row: r, missing };
        })
        .filter((p) => p.missing.length);

      const lines = problems
        .slice(0, 40)
        .map(
          (p) =>
            `**${p.row.mark ?? "Unmarked"}** (${sheetOf(p.row)}) — missing ${p.missing.join(", ")}`,
        );

      return {
        summary: [
          `**${problems.length}** of ${rows.length} item${rows.length === 1 ? "" : "s"} have missing fields.`,
          bullets(lines, "Every item has the required fields."),
        ].join("\n\n"),
        data: {
          count: problems.length,
          problems: problems
            .slice(0, 40)
            .map((p) => ({ id: p.row.id, mark: p.row.mark, missing: p.missing })),
        },
        sources: [projectSource(ctx), ...itemSources(problems.map((p) => p.row))],
      };
    },
  },
  {
    name: "read_duplicate_marks",
    label: "Find duplicate marks",
    agent: "quality_control",
    description: "Marks used by more than one takeoff item with differing dimensions.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const byMark = new Map<string, ItemRow[]>();
      rows.forEach((r) => {
        if (!r.mark) return;
        byMark.set(r.mark, [...(byMark.get(r.mark) ?? []), r]);
      });
      const dupes = [...byMark.entries()].filter(([, list]) => list.length > 1);
      const conflicting = dupes.filter(([, list]) => {
        const sig = new Set(list.map((r) => `${r.product_type}|${r.width_in}|${r.height_in}`));
        return sig.size > 1;
      });
      const lines = dupes.map(([mark, list]) => {
        const sig = new Set(
          list.map(
            (r) => `${typeLabel(r.product_type)} ${r.width_in ?? "?"}×${r.height_in ?? "?"}`,
          ),
        );
        const flag = sig.size > 1 ? " ⚠️ **conflicting dimensions/type**" : " (consistent repeat)";
        return `**${mark}** — ${list.length} records on ${[...new Set(list.map(sheetOf))].join(", ")}${flag}`;
      });
      return {
        summary: [
          `**${dupes.length}** repeated mark${dupes.length === 1 ? "" : "s"}, of which **${conflicting.length}** have conflicting dimensions or types.`,
          bullets(lines, "No duplicate marks found."),
        ].join("\n\n"),
        data: { repeated: dupes.length, conflicting: conflicting.length },
        sources: [projectSource(ctx), ...itemSources(dupes.flatMap(([, l]) => l))],
      };
    },
  },
  {
    name: "read_schedules",
    label: "Read imported schedules",
    agent: "schedule",
    description: "Imported window/door schedules and their rows.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data: schedules, error } = await supabase
        .from("schedules")
        .select(
          "id,name,schedule_type,source,created_at,schedule_rows(id,mark,quantity,width_in,height_in,material,glass,operation,remarks)",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      const list = schedules ?? [];
      const lines = list.map(
        (s) =>
          `**${s.name}** — ${s.schedule_type}, source ${s.source}, ${(s.schedule_rows ?? []).length} rows`,
      );
      return {
        summary: [
          `**${list.length}** schedule${list.length === 1 ? "" : "s"} imported.`,
          bullets(lines, "No schedules imported yet."),
        ].join("\n\n"),
        data: { schedules: list },
        sources: [
          projectSource(ctx),
          ...list.map((s) => ({
            type: "schedule" as const,
            label: `Schedule — ${s.name}`,
            entityId: s.id,
          })),
        ],
      };
    },
  },
  {
    name: "compare_takeoff_to_schedule",
    label: "Compare takeoff with imported schedule",
    agent: "schedule",
    description: "Mark-by-mark quantity and dimension comparison.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const { data: schedules, error } = await supabase
        .from("schedules")
        .select("id,name,schedule_rows(id,mark,quantity,width_in,height_in,material,glass)")
        .eq("project_id", projectId);
      if (error) throw error;
      const scheduleRows = (schedules ?? []).flatMap((s) =>
        (s.schedule_rows ?? []).map((r) => ({ ...r, scheduleName: s.name, scheduleId: s.id })),
      );
      if (!scheduleRows.length) {
        return {
          summary:
            "No schedule rows are imported for this project, so there is nothing to compare yet.",
          data: { comparisons: [] },
          sources: [projectSource(ctx)],
        };
      }
      const takeoffByMark = new Map<string, { qty: number; w: number | null; h: number | null }>();
      rows.forEach((r) => {
        if (!r.mark) return;
        const hit = takeoffByMark.get(r.mark);
        if (hit) hit.qty += r.quantity ?? 1;
        else takeoffByMark.set(r.mark, { qty: r.quantity ?? 1, w: r.width_in, h: r.height_in });
      });

      const diffs: string[] = [];
      scheduleRows.forEach((sr) => {
        const mark = sr.mark ?? "";
        const t = takeoffByMark.get(mark);
        if (!t) {
          diffs.push(
            `**${mark || "(blank)"}** — in ${sr.scheduleName} schedule but **not in the takeoff**`,
          );
          return;
        }
        if (sr.quantity != null && sr.quantity !== t.qty) {
          diffs.push(`**${mark}** — schedule qty ${sr.quantity} vs takeoff qty **${t.qty}**`);
        }
        if (sr.width_in != null && t.w != null && Number(sr.width_in) !== Number(t.w)) {
          diffs.push(`**${mark}** — schedule width ${sr.width_in}″ vs takeoff **${t.w}″**`);
        }
        if (sr.height_in != null && t.h != null && Number(sr.height_in) !== Number(t.h)) {
          diffs.push(`**${mark}** — schedule height ${sr.height_in}″ vs takeoff **${t.h}″**`);
        }
      });
      const scheduleMarks = new Set(scheduleRows.map((r) => r.mark));
      [...takeoffByMark.keys()].forEach((mark) => {
        if (!scheduleMarks.has(mark))
          diffs.push(`**${mark}** — counted in the takeoff but **missing from the schedule**`);
      });

      return {
        summary: [
          `Compared **${takeoffByMark.size}** takeoff marks against **${scheduleRows.length}** schedule rows.`,
          `**${diffs.length}** discrepanc${diffs.length === 1 ? "y" : "ies"} found.`,
          bullets(diffs.slice(0, 40), "Takeoff and schedule agree on every mark."),
        ].join("\n\n"),
        data: { discrepancies: diffs.length },
        sources: [
          projectSource(ctx),
          ...(schedules ?? []).map((s) => ({
            type: "schedule" as const,
            label: `Schedule — ${s.name}`,
            entityId: s.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_schedule_conflicts",
    label: "Read schedule conflicts",
    agent: "schedule",
    description: "Recorded conflicts between schedule and takeoff data.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("schedule_conflicts")
        .select("id,mark,conflict_type,severity,detail,resolved,created_at")
        .eq("project_id", projectId)
        .order("severity");
      if (error) throw error;
      const list = data ?? [];
      const open = list.filter((c) => !c.resolved);
      const lines = open.map(
        (c) => `**${c.mark ?? "—"}** · ${c.conflict_type} · _${c.severity}_ — ${c.detail ?? ""}`,
      );
      return {
        summary: [
          `**${open.length}** open conflict${open.length === 1 ? "" : "s"} (${list.length} recorded in total).`,
          bullets(lines, "No open schedule conflicts."),
        ].join("\n\n"),
        data: { open: open.length, total: list.length, conflicts: open },
        sources: [
          projectSource(ctx),
          ...open.slice(0, 8).map((c) => ({
            type: "schedule_conflict" as const,
            label: `Conflict — ${c.mark ?? c.conflict_type}`,
            entityId: c.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_combinations",
    label: "Read combinations and mulls",
    agent: "combination_mull",
    description: "Combination assemblies, layouts and reinforcement.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("combinations")
        .select(
          "id,mark,layout,mull_type,reinforcement,status,notes,combination_members(id,quantity,position)",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      const list = data ?? [];
      const lines = list.map(
        (c) =>
          `**${c.mark ?? "—"}** — ${c.layout}, ${c.mull_type ?? "mull n/a"}, reinforcement ${c.reinforcement ?? "—"}, ${(c.combination_members ?? []).length} members, status ${c.status}`,
      );
      return {
        summary: [
          `**${list.length}** combination${list.length === 1 ? "" : "s"} in the library.`,
          bullets(lines, "No combinations created yet."),
        ].join("\n\n"),
        data: { combinations: list },
        sources: [
          projectSource(ctx),
          ...list.map((c) => ({
            type: "combination" as const,
            label: `Combination ${c.mark ?? c.id}`,
            entityId: c.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_jurisdiction",
    label: "Read jurisdiction findings",
    agent: "jurisdiction_code",
    description: "AHJ, adopted code, wind speed, debris region and impact requirements.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("jurisdiction_records")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = data ?? [];
      if (!list.length) {
        return {
          summary:
            "No jurisdiction record has been created for this project yet. Nothing to report — I will not infer code requirements without a source record.",
          data: { records: [] },
          sources: [projectSource(ctx)],
        };
      }
      const r = list[0];
      const lines = [
        `AHJ: **${r.ahj_name ?? "—"}**`,
        `Adopted code: **${r.adopted_code ?? "—"}**`,
        `Local amendments: ${r.amendments ?? "—"}`,
        `Design wind speed: **${r.design_wind_speed ?? "—"}**`,
        `Wind-borne debris region: **${r.debris_region ?? "—"}**`,
        `Impact protection required: **${r.impact_required == null ? "unverified" : r.impact_required ? "yes" : "no"}**`,
        `Energy: ${r.energy_requirements ?? "—"}`,
        `Egress: ${r.egress_requirements ?? "—"}`,
        `Safety glazing: ${r.safety_glazing_notes ?? "—"}`,
        `Upper-floor restrictions: ${r.upper_floor_restrictions ?? "—"}`,
        `Permit notes: ${r.permit_notes ?? "—"}`,
        `Source: ${r.source_url ?? "not recorded"} · Verified: ${r.verified_at ? new Date(r.verified_at).toLocaleDateString() : "**not verified**"}`,
      ];
      return {
        summary: bullets(lines, "No detail."),
        data: r as unknown as Record<string, unknown>,
        sources: [
          projectSource(ctx),
          {
            type: "jurisdiction",
            label: `Jurisdiction record — ${r.ahj_name ?? "unnamed AHJ"}`,
            entityId: r.id,
          },
        ],
      };
    },
  },
  {
    name: "read_safety_findings",
    label: "Read safety and egress findings",
    agent: "safety_egress",
    description: "Sill heights, WOCD, guards, safety glazing and egress checks.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("safety_checks")
        .select(
          "id,check_type,sill_height_in,exterior_drop_in,requires_wocd,requires_guard,requires_safety_glazing,meets_egress,status,notes,takeoff_item_id",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      const list = data ?? [];
      const flags = list.filter(
        (c) =>
          c.requires_wocd ||
          c.requires_guard ||
          c.requires_safety_glazing ||
          c.meets_egress === false,
      );
      const lines = list.map((c) => {
        const tags = [
          c.requires_wocd ? "WOCD" : null,
          c.requires_guard ? "guard" : null,
          c.requires_safety_glazing ? "safety glazing" : null,
          c.meets_egress === false ? "**does not meet egress**" : null,
        ].filter(Boolean);
        return `${c.check_type} — sill ${c.sill_height_in ?? "?"}″, drop ${c.exterior_drop_in ?? "?"}″ · ${tags.join(", ") || "no flags"} · ${c.status}`;
      });
      return {
        summary: [
          `**${list.length}** safety check${list.length === 1 ? "" : "s"}, **${flags.length}** with an active requirement or failure.`,
          bullets(lines, "No safety checks recorded yet."),
        ].join("\n\n"),
        data: { total: list.length, flagged: flags.length, checks: list },
        sources: [
          projectSource(ctx),
          ...list.slice(0, 8).map((c) => ({
            type: "safety" as const,
            label: `Safety check — ${c.check_type}`,
            entityId: c.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_quality_issues",
    label: "Read quality issues",
    agent: "quality_control",
    description: "Recorded quality-review issues for this project.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("quality_issues")
        .select("id,area,severity,message,resolved,created_at")
        .eq("project_id", projectId)
        .order("severity");
      if (error) throw error;
      const list = data ?? [];
      const open = list.filter((i) => !i.resolved);
      return {
        summary: [
          `**${open.length}** open quality issue${open.length === 1 ? "" : "s"} of ${list.length} recorded.`,
          bullets(
            open.map((i) => `_${i.severity}_ · ${i.area} — ${i.message}`),
            "No open quality issues.",
          ),
        ].join("\n\n"),
        data: { open: open.length, total: list.length, issues: open },
        sources: [
          projectSource(ctx),
          ...open.slice(0, 8).map((i) => ({
            type: "quality" as const,
            label: `Quality issue — ${i.area}`,
            entityId: i.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_ykk_mappings",
    label: "Read YKK product mappings",
    agent: "ykk_product",
    description: "Mapped, unmapped and invalid YKK product assignments.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const { data, error } = await supabase
        .from("ykk_mappings")
        .select(
          "id,takeoff_item_id,combination_id,status,confidence,notes,ykk_products(family,series,model,product_type)",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      const list = data ?? [];
      const mappedIds = new Set(
        list
          .filter((m) => m.status === "confirmed" && m.takeoff_item_id)
          .map((m) => m.takeoff_item_id),
      );
      const unmapped = rows.filter((r) => !mappedIds.has(r.id));
      const byStatus = tally(
        list,
        (m) => m.status,
        () => 1,
      );
      return {
        summary: [
          `**${mappedIds.size}** of ${rows.length} takeoff items have a confirmed YKK product mapping. **${unmapped.length}** remain unmapped.`,
          "**Mapping records by status**",
          bullets(
            byStatus.map(([k, v]) => `${k}: **${v}**`),
            "No mapping records yet.",
          ),
          "**Unmapped items**",
          bullets(
            unmapped
              .slice(0, 30)
              .map(
                (r) => `**${r.mark ?? "Unmarked"}** — ${typeLabel(r.product_type)} · ${sheetOf(r)}`,
              ),
            "Every item is mapped.",
          ),
        ].join("\n\n"),
        data: { mapped: mappedIds.size, unmapped: unmapped.length, total: rows.length },
        sources: [
          projectSource(ctx),
          ...list.slice(0, 8).map((m) => ({
            type: "ykk_mapping" as const,
            label:
              `YKK mapping — ${m.ykk_products?.family ?? "unassigned"} ${m.ykk_products?.model ?? ""}`.trim(),
            entityId: m.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_quote_readiness",
    label: "Read quote-readiness blockers",
    agent: "quote_readiness",
    description:
      "Deterministic gate check across takeoff, mapping, jurisdiction, safety and quality.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const [mappings, conflicts, jurisdiction, safety, quality] = await Promise.all([
        supabase.from("ykk_mappings").select("takeoff_item_id,status").eq("project_id", projectId),
        supabase.from("schedule_conflicts").select("id,resolved").eq("project_id", projectId),
        supabase
          .from("jurisdiction_records")
          .select("id,verified_at,impact_required")
          .eq("project_id", projectId),
        supabase.from("safety_checks").select("id,status,meets_egress").eq("project_id", projectId),
        supabase.from("quality_issues").select("id,severity,resolved").eq("project_id", projectId),
      ]);

      const mappedIds = new Set(
        (mappings.data ?? []).filter((m) => m.status === "confirmed").map((m) => m.takeoff_item_id),
      );
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (!rows.length) blockers.push("No takeoff items have been counted.");
      const unreviewed = rows.filter((r) => r.status !== "approved");
      if (unreviewed.length)
        blockers.push(`**${unreviewed.length}** takeoff item(s) are not approved.`);
      const missingDims = rows.filter((r) => r.width_in == null || r.height_in == null);
      if (missingDims.length)
        blockers.push(`**${missingDims.length}** item(s) are missing width or height.`);
      const unmapped = rows.filter((r) => !mappedIds.has(r.id));
      if (unmapped.length)
        blockers.push(`**${unmapped.length}** item(s) have no confirmed YKK product mapping.`);
      const openConflicts = (conflicts.data ?? []).filter((c) => !c.resolved);
      if (openConflicts.length)
        blockers.push(`**${openConflicts.length}** unresolved schedule conflict(s).`);
      const jr = (jurisdiction.data ?? [])[0];
      if (!jr) blockers.push("No jurisdiction record has been created.");
      else if (!jr.verified_at)
        blockers.push("The jurisdiction record has not been verified against an official source.");
      const failedEgress = (safety.data ?? []).filter((s) => s.meets_egress === false);
      if (failedEgress.length)
        blockers.push(`**${failedEgress.length}** opening(s) fail the egress check.`);
      const pendingSafety = (safety.data ?? []).filter((s) => s.status !== "approved");
      if (pendingSafety.length)
        warnings.push(`**${pendingSafety.length}** safety check(s) are not yet approved.`);
      const openQuality = (quality.data ?? []).filter((q) => !q.resolved);
      if (openQuality.length) warnings.push(`**${openQuality.length}** open quality issue(s).`);
      const missingImages = rows.filter((r) => !r.primary_image_path);
      if (missingImages.length)
        warnings.push(`**${missingImages.length}** item(s) have no representative image.`);

      const ready = blockers.length === 0;
      return {
        summary: [
          ready
            ? "✅ **Ready for quote** — no blockers detected."
            : `⛔️ **Not ready for quote** — ${blockers.length} blocker${blockers.length === 1 ? "" : "s"}.`,
          "**Blockers**",
          bullets(blockers, "None."),
          "**Warnings**",
          bullets(warnings, "None."),
        ].join("\n\n"),
        data: { ready, blockers, warnings },
        sources: [projectSource(ctx)],
      };
    },
  },
  {
    name: "read_export_history",
    label: "Read export history",
    agent: "export_report",
    description: "Previously generated exports for this project.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("exports")
        .select("id,export_type,status,filename,size_bytes,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const list = data ?? [];
      return {
        summary: [
          `**${list.length}** export${list.length === 1 ? "" : "s"} on record.`,
          bullets(
            list.map(
              (e) =>
                `${e.filename ?? e.export_type} — ${e.export_type.toUpperCase()}, ${e.status}, ${new Date(e.created_at).toLocaleString()}`,
            ),
            "No exports generated yet.",
          ),
        ].join("\n\n"),
        data: { exports: list },
        sources: [
          projectSource(ctx),
          ...list.slice(0, 5).map((e) => ({
            type: "export" as const,
            label: `Export — ${e.filename ?? e.export_type}`,
            entityId: e.id,
          })),
        ],
      };
    },
  },
  {
    name: "read_audit_history",
    label: "Read recent project activity",
    agent: "document",
    description: "Recent audit-log entries for this project.",
    readOnly: true,
    async run(ctx) {
      const projectId = needProject(ctx);
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,entity_type,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      const list = data ?? [];
      return {
        summary: bullets(
          list.map(
            (a) =>
              `${new Date(a.created_at).toLocaleString()} — ${a.action}${a.entity_type ? ` (${a.entity_type})` : ""}`,
          ),
          "No activity recorded yet.",
        ),
        data: { activity: list },
        sources: [projectSource(ctx)],
      };
    },
  },
  // ---- Actions requiring explicit approval ----
  {
    name: "generate_excel_export",
    label: "Generate Excel takeoff",
    agent: "export_report",
    description: "Builds the real .xlsx takeoff workbook with embedded item images.",
    readOnly: false,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const withImages = rows.filter((r) => r.primary_image_path).length;
      return {
        summary: [
          "**Export preview — Excel takeoff (.xlsx)**",
          bullets(
            [
              `Project: **${ctx.projectName ?? projectId}**`,
              `Line items: **${rows.length}** · counted units: **${rows.reduce((s, r) => s + (r.quantity ?? 1), 0)}**`,
              `Items with a representative image: **${withImages}**`,
              `Sheets: Project Summary + grouped quantities + item detail + module sheets`,
            ],
            "",
          ),
          "Confirm below to generate and download the real workbook and save an export-history record.",
        ].join("\n\n"),
        data: { itemCount: rows.length },
        sources: [projectSource(ctx), ...itemSources(rows)],
        approval: {
          actionType: "generate_excel_export",
          summary: `Generate Excel takeoff for ${ctx.projectName ?? "this project"} (${rows.length} line items)`,
          preview: { itemCount: rows.length, withImages },
          payload: { projectId, format: "xlsx" },
        },
      };
    },
  },
  {
    name: "generate_pdf_report",
    label: "Generate PDF takeoff report",
    agent: "export_report",
    description: "Builds the real branded PDF takeoff report.",
    readOnly: false,
    async run(ctx) {
      const projectId = needProject(ctx);
      const rows = await loadItems(projectId);
      const sheets = [...new Set(rows.map(sheetOf))];
      return {
        summary: [
          "**Export preview — PDF takeoff report**",
          bullets(
            [
              `Project: **${ctx.projectName ?? projectId}**`,
              `Cover page, project summary, grouped totals and item detail table`,
              `Line items: **${rows.length}**`,
              `Source sheets: ${sheets.join(", ") || "—"}`,
            ],
            "",
          ),
          "Confirm below to generate and download the real PDF and save an export-history record.",
        ].join("\n\n"),
        data: { itemCount: rows.length, sheets },
        sources: [projectSource(ctx), ...itemSources(rows)],
        approval: {
          actionType: "generate_pdf_report",
          summary: `Generate PDF takeoff report for ${ctx.projectName ?? "this project"} (${rows.length} line items)`,
          preview: { itemCount: rows.length, sheets },
          payload: { projectId, format: "pdf" },
        },
      };
    },
  },
  {
    name: "create_draft_rfi",
    label: "Draft an RFI",
    agent: "legal_contract",
    description: "Drafts an RFI from recorded discrepancies. Saved only after approval.",
    readOnly: false,
    async run(ctx, args) {
      const projectId = needProject(ctx);
      const subject = String(args?.subject ?? "Conflicting window quantities");
      const rows = await loadItems(projectId);
      const { data: schedules } = await supabase
        .from("schedules")
        .select("name,schedule_rows(mark,quantity)")
        .eq("project_id", projectId);
      const scheduleRows = (schedules ?? []).flatMap((s) =>
        (s.schedule_rows ?? []).map((r) => ({ ...r, name: s.name })),
      );
      const takeoffByMark = new Map<string, number>();
      rows.forEach(
        (r) =>
          r.mark && takeoffByMark.set(r.mark, (takeoffByMark.get(r.mark) ?? 0) + (r.quantity ?? 1)),
      );
      const conflictLines = scheduleRows
        .filter(
          (sr) =>
            sr.mark != null && sr.quantity != null && takeoffByMark.get(sr.mark) !== sr.quantity,
        )
        .map(
          (sr) =>
            `- Mark ${sr.mark}: ${sr.name} schedule shows ${sr.quantity}; plan takeoff shows ${takeoffByMark.get(sr.mark as string) ?? 0}.`,
        );

      const body = [
        `RFI — ${subject}`,
        ``,
        `Project: ${ctx.projectName ?? projectId}`,
        `Date: ${new Date().toLocaleDateString()}`,
        ``,
        `AWM LLC's plan takeoff does not reconcile with the issued schedule for the following marks:`,
        conflictLines.length
          ? conflictLines.join("\n")
          : "- (No quantity discrepancies were recorded at the time of drafting.)",
        ``,
        `Request: please confirm the governing quantities and dimensions for the marks listed above, and advise whether the schedule or the plan elevations control.`,
        ``,
        `AWM LLC is an independent supplier/distributor. Product availability and specifications are subject to manufacturer confirmation.`,
      ].join("\n");

      return {
        summary: [
          "**Draft RFI preview**",
          "```text\n" + body + "\n```",
          "Confirm below to save this draft to the project.",
        ].join("\n\n"),
        data: { body },
        sources: [projectSource(ctx)],
        approval: {
          actionType: "create_draft_rfi",
          summary: `Save draft RFI "${subject}" to ${ctx.projectName ?? "this project"}`,
          preview: { subject, lines: conflictLines.length },
          payload: { projectId, draftType: "rfi", title: subject, body },
        },
      };
    },
  },
  {
    name: "create_draft_note",
    label: "Draft a project note",
    agent: "general",
    description: "Drafts a project note. Saved only after approval.",
    readOnly: false,
    async run(ctx, args) {
      const projectId = needProject(ctx);
      const title = String(args?.title ?? "Project note");
      const body =
        String(args?.body ?? "").trim() || "Note drafted by the AWM Construction Super Agent.";
      return {
        summary: [
          "**Draft note preview**",
          "```text\n" + body + "\n```",
          "Confirm below to save this note.",
        ].join("\n\n"),
        data: { title, body },
        sources: [projectSource(ctx)],
        approval: {
          actionType: "create_draft_note",
          summary: `Save project note "${title}"`,
          preview: { title },
          payload: { projectId, draftType: "note", title, body },
        },
      };
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
