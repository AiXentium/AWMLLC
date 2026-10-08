import type { AiAgentKey } from "./types";

export const AGENTS: Record<AiAgentKey, { label: string; blurb: string }> = {
  document: { label: "Document Agent", blurb: "Plan sets, revisions, pages and sheet metadata" },
  takeoff: { label: "Takeoff Agent", blurb: "Counts, groupings, marks and missing fields" },
  window_glazing: { label: "Window & Glazing Agent", blurb: "Window types, glass and performance" },
  door_hardware: { label: "Door & Hardware Agent", blurb: "Doors, operation and hardware" },
  schedule: { label: "Schedule Agent", blurb: "Imported schedules, mapping and conflicts" },
  combination_mull: {
    label: "Combination & Mull Agent",
    blurb: "Assemblies, mulls and reinforcement",
  },
  jurisdiction_code: {
    label: "Jurisdiction & Florida Code Agent",
    blurb: "AHJ, adopted code, wind and approvals",
  },
  safety_egress: { label: "Safety & Egress Agent", blurb: "Sill heights, WOCD, guards and egress" },
  ykk_product: {
    label: "YKK Product Agent",
    blurb: "StyleView, StyleGuard and Precedence records",
  },
  quote_readiness: {
    label: "Quote Readiness Agent",
    blurb: "Blockers and warnings before quoting",
  },
  quality_control: { label: "Quality Control Agent", blurb: "Data completeness and review issues" },
  file_manager: { label: "File Manager Agent", blurb: "Incoming files, imports and connectors" },
  export_report: { label: "Export & Report Agent", blurb: "Excel takeoffs and PDF reports" },
  portal_automation: { label: "Portal Automation Agent", blurb: "Supervised YKK portal sessions" },
  installation: { label: "Installation Agent", blurb: "Installation instructions and detailing" },
  legal_contract: { label: "Legal & Contract Agent", blurb: "RFIs, scope notes and disclaimers" },
  general: { label: "AWM Construction Super Agent", blurb: "General project assistance" },
  // Trade specialists (CSI divisions) — activated 2026-10-04.
  trade_glazing: {
    label: "Glazing & Openings Specialist",
    blurb: "Windows, doors, storefront, skylights — products, codes, approvals",
  },
  trade_roofing: { label: "Roofing Specialist", blurb: "Roofing systems, waterproofing, flashing" },
  trade_concrete: {
    label: "Concrete & Foundation Specialist",
    blurb: "Foundations, slabs, reinforcement",
  },
  trade_masonry: { label: "Masonry Specialist", blurb: "CMU, brick, stone, veneers" },
  trade_steel: { label: "Structural Steel Specialist", blurb: "Beams, columns, joists, decking" },
  trade_framing: {
    label: "Framing & Carpentry Specialist",
    blurb: "Wood framing, trusses, sheathing",
  },
  trade_drywall: {
    label: "Drywall & Finishes Specialist",
    blurb: "Sheetrock, flooring, paint, tile",
  },
  trade_fire: {
    label: "Fire Suppression Specialist",
    blurb: "Sprinklers, standpipes — NFPA 13/13R/13D",
  },
  trade_plumbing: { label: "Plumbing Specialist", blurb: "Water, waste, vent, gas, fixtures" },
  trade_hvac: { label: "HVAC Specialist", blurb: "Heating, cooling, ventilation, controls" },
  trade_electrical: { label: "Electrical Specialist", blurb: "Power, lighting, fire alarm" },
  trade_earthwork: {
    label: "Earthwork & Civil Specialist",
    blurb: "Excavation, grading, site utilities",
  },
  trade_exterior: {
    label: "Exterior Improvements Specialist",
    blurb: "Paving, sidewalks, landscaping",
  },
};

/** Trade knowledge modules — all activated as specialist agents. */
export const INACTIVE_MODULES: string[] = [];

export function agentLabel(key: AiAgentKey) {
  return AGENTS[key]?.label ?? AGENTS.general.label;
}
