import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProject from "./tools/get-project";
import takeoffSummary from "./tools/takeoff-summary";
import listTakeoffItems from "./tools/list-takeoff-items";
import listQuoteRequests from "./tools/list-quote-requests";
import createProject from "./tools/create-project";

// Direct Supabase host is required as the OAuth issuer; the project ref is the only
// Supabase value that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "awm-takeoff-mcp",
  title: "AWM Takeoff AI",
  version: "0.1.0",
  instructions:
    "Tools for the AWM Takeoff AI workspace (American Windows Manufacturer LLC). Use list_projects to find a project, get_project for its full record and counts, takeoff_summary for window/door/storefront quantities, list_takeoff_items for individual marks, list_quote_requests for inbound prospect requests, and create_project to start a new estimate. All calls run as the signed-in AWM user and respect their access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjects,
    getProject,
    takeoffSummary,
    listTakeoffItems,
    listQuoteRequests,
    createProject,
  ],
});
