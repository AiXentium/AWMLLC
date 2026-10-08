import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "takeoff_summary",
  title: "Summarize takeoff",
  description:
    "Group a project's takeoff items by category and type and return unit totals, so an assistant can report window, door and storefront counts without pulling every row.",
  inputSchema: { project_id: z.string().uuid().describe("Project id from list_projects.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();

    const { data, error } = await supabaseForUser(ctx)
      .from("takeoff_items")
      .select("category, type_name, quantity, status")
      .eq("project_id", project_id)
      .is("deleted_at", null);
    if (error) return failed(error.message);

    const rows = data ?? [];
    const byCategory = new Map<string, { items: number; units: number }>();
    const byType = new Map<string, { category: string; items: number; units: number }>();
    const byStatus = new Map<string, number>();

    for (const row of rows) {
      const qty = Number(row.quantity ?? 0) || 0;
      const category = row.category ?? "uncategorized";
      const type = row.type_name ?? "unspecified";

      const cat = byCategory.get(category) ?? { items: 0, units: 0 };
      byCategory.set(category, { items: cat.items + 1, units: cat.units + qty });

      const key = `${category} / ${type}`;
      const t = byType.get(key) ?? { category, items: 0, units: 0 };
      byType.set(key, { category, items: t.items + 1, units: t.units + qty });

      const status = row.status ?? "unknown";
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }

    return ok({
      project_id,
      total_items: rows.length,
      total_units: rows.reduce((sum, row) => sum + (Number(row.quantity ?? 0) || 0), 0),
      by_category: Object.fromEntries(byCategory),
      by_type: Object.fromEntries(byType),
      by_status: Object.fromEntries(byStatus),
    });
  },
});
