import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Create project",
  description:
    "Create a new AWM Takeoff AI project owned by the signed-in user. Use for intake of a new estimate; plans are uploaded in the app afterwards.",
  inputSchema: {
    name: z.string().trim().min(1).max(200).describe("Project name."),
    code: z.string().trim().max(60).optional().describe("Internal project code or number."),
    project_type: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("e.g. multifamily, single family, commercial."),
    address: z.string().trim().max(300).optional().describe("Street address of the jobsite."),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(60).optional(),
    postal_code: z.string().trim().max(20).optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe("Scope notes for the estimating team."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();

    const { data, error } = await supabaseForUser(ctx)
      .from("projects")
      .insert({
        name: input.name,
        code: input.code || null,
        project_type: input.project_type || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        postal_code: input.postal_code || null,
        description: input.description || null,
        owner_id: ctx.getUserId(),
        status: "active",
      })
      .select("id, name, code, status, created_at")
      .single();

    if (error) return failed(error.message);
    return ok({ project: data });
  },
});
