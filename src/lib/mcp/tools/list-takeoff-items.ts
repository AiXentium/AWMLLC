import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_takeoff_items",
  title: "List takeoff items",
  description:
    "List individual takeoff items (marks) for a project, with mark, category, type, size, location and status. Optionally filter by category or mark.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project id from list_projects."),
    category: z
      .string()
      .trim()
      .optional()
      .describe("Filter by category, e.g. window, door, storefront."),
    mark: z.string().trim().optional().describe("Filter by exact schedule mark, e.g. W2."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Max items to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, category, mark, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();

    let query = supabaseForUser(ctx)
      .from("takeoff_items")
      .select(
        "id, mark, category, type_name, quantity, width_in, height_in, building, floor, room, operation, glass, status, ai_confidence",
      )
      .eq("project_id", project_id)
      .is("deleted_at", null)
      .order("mark", { ascending: true })
      .limit(limit ?? 50);

    if (category) query = query.eq("category", category);
    if (mark) query = query.eq("mark", mark);

    const { data, error } = await query;
    if (error) return failed(error.message);
    return ok({ project_id, count: data?.length ?? 0, items: data ?? [] });
  },
});
