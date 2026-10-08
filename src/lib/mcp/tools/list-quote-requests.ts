import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, failed, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_quote_requests",
  title: "List quote requests",
  description:
    "List inbound prospect quote requests from the AWM public website, newest first, with contact, project and status fields.",
  inputSchema: {
    status: z
      .string()
      .trim()
      .optional()
      .describe("Filter by request status, e.g. new, in_review, quoted."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max requests to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();

    let query = supabaseForUser(ctx)
      .from("contact_submissions")
      .select(
        "id, name, company, email, phone, project_name, project_type, project_address, city, state, product_interest, quantities, deadline, status, priority, created_at, converted_project_id",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return failed(error.message);
    return ok({ count: data?.length ?? 0, requests: data ?? [] });
  },
});
