import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List AWM Takeoff AI projects visible to the signed-in user, newest first. Optionally filter by status or search by name, code or address.",
  inputSchema: {
    search: z.string().trim().optional().describe("Match against project name, code or address."),
    status: z
      .enum(["active", "review", "approved", "ready_for_quote", "completed", "on_hold", "archived"])
      .optional()
      .describe("Only return projects in this status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max projects to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("projects")
      .select("id, name, code, status, project_type, address, city, state, due_date, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);
    if (search) {
      const term = `%${search.replace(/[%,]/g, "")}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term},address.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) return failed(error.message);
    return ok({ count: data?.length ?? 0, projects: data ?? [] });
  },
});
