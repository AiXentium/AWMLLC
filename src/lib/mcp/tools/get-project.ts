import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Get project detail",
  description:
    "Return the full record for one AWM project — address, jurisdiction and code data, schedule dates and team — plus counts of pages, takeoff items and documents.",
  inputSchema: { project_id: z.string().uuid().describe("Project id from list_projects.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return failed(error.message);
    if (!project) return failed("Project not found, or you do not have access to it.");

    const counted = async (table: string) => {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);
      return count ?? 0;
    };

    const [pages, takeoffItems, documents] = await Promise.all([
      counted("pages"),
      counted("takeoff_items"),
      counted("documents"),
    ]);

    return ok({ project, counts: { pages, takeoff_items: takeoffItems, documents } });
  },
});
