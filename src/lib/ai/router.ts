import type { AiAgentKey } from "./types";

export type Intent = {
  agent: AiAgentKey;
  tools: { name: string; args?: Record<string, unknown> }[];
  reason: string;
};

type Rule = {
  match: RegExp;
  agent: AiAgentKey;
  tools: (
    m: RegExpMatchArray,
    prompt: string,
  ) => { name: string; args?: Record<string, unknown> }[];
  reason: string;
};

const RULES: Rule[] = [
  {
    match: /\b(excel|xlsx|spreadsheet|workbook)\b/i,
    agent: "export_report",
    tools: () => [{ name: "generate_excel_export" }],
    reason: "The request asks for an Excel takeoff.",
  },
  {
    match: /\b(pdf report|pdf takeoff|pdf)\b/i,
    agent: "export_report",
    tools: () => [{ name: "generate_pdf_report" }],
    reason: "The request asks for a PDF takeoff report.",
  },
  {
    match: /\b(rfi)\b/i,
    agent: "legal_contract",
    tools: (_m, prompt) => [
      {
        name: "create_draft_rfi",
        args: {
          subject:
            prompt.replace(/^.*rfi\s*(for|about|on)?\s*/i, "").trim() ||
            "Conflicting window quantities",
        },
      },
    ],
    reason: "The request asks for an RFI draft.",
  },
  // Trade specialists — matched before generic takeoff rules so trade-domain
  // questions reach the right expert.
  {
    match: /\b(roofing|roof\s+plan|shingle|TPO|EPDM|modified\s+bitumen|roof\s+membrane)\b/i,
    agent: "trade_roofing",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns roofing.",
  },
  {
    match: /\b(drywall|sheetrock|gypsum\s+board)\b/i,
    agent: "trade_drywall",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns drywall and finishes.",
  },
  {
    match: /\b(concrete|foundation|footing|rebar)\b/i,
    agent: "trade_concrete",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns concrete and foundations.",
  },
  {
    match: /\b(masonry|\bCMU\b|brick\s+veneer)\b/i,
    agent: "trade_masonry",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns masonry.",
  },
  {
    match: /\bstructural\s+steel|\bsteel\s+framing\b/i,
    agent: "trade_steel",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns structural steel.",
  },
  {
    match: /\b(framing|roof\s+truss|floor\s+truss|\blumber\b|stud\s+wall)\b/i,
    agent: "trade_framing",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns wood framing.",
  },
  {
    match: /\b(sprinkler|fire\s+suppression|standpipe)\b/i,
    agent: "trade_fire",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns fire suppression.",
  },
  {
    match: /\b(plumbing|plumber)\b/i,
    agent: "trade_plumbing",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns plumbing.",
  },
  {
    match: /\bHVAC\b|\bductwork\b|air\s+conditioning/i,
    agent: "trade_hvac",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns HVAC.",
  },
  {
    match: /\belectrical\b|\belectrician\b/i,
    agent: "trade_electrical",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns electrical.",
  },
  {
    match: /\b(excavation|earthwork|grading\s+plan)\b/i,
    agent: "trade_earthwork",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns earthwork.",
  },
  {
    match: /\b(landscaping|landscape\s+plan|irrigation)\b/i,
    agent: "trade_exterior",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns exterior improvements.",
  },
  {
    match: /\bglazing\s+(code|requirement|approval)|curtain\s+wall\s+(system|code)/i,
    agent: "trade_glazing",
    tools: () => [{ name: "read_takeoff_counts", args: { category: "window" } }],
    reason: "The request concerns glazing systems and codes.",
  },
  {
    match: /\b(export history|previous exports|past exports)\b/i,
    agent: "export_report",
    tools: () => [{ name: "read_export_history" }],
    reason: "The request asks about generated exports.",
  },
  {
    match: /\b(ready for quote|quote readiness|quote ready|blocker)/i,
    agent: "quote_readiness",
    tools: () => [{ name: "read_quote_readiness" }],
    reason: "The request asks about readiness to quote.",
  },
  {
    match: /\b(ykk|mapped|unmapped|mapping|styleview|styleguard|precedence)\b/i,
    agent: "ykk_product",
    tools: () => [{ name: "read_ykk_mappings" }],
    reason: "The request concerns YKK product mapping.",
  },
  {
    match: /\b(duplicate|repeated mark)/i,
    agent: "quality_control",
    tools: () => [{ name: "read_duplicate_marks" }],
    reason: "The request asks about duplicate marks.",
  },
  {
    match: /\b(missing|incomplete|blank field)/i,
    agent: "quality_control",
    tools: () => [{ name: "read_missing_fields" }],
    reason: "The request asks about incomplete records.",
  },
  {
    match: /\b(quality|qa|qc issue)/i,
    agent: "quality_control",
    tools: () => [{ name: "read_quality_issues" }, { name: "read_missing_fields" }],
    reason: "The request asks about quality review.",
  },
  {
    match: /\b(schedule conflict|conflicts)\b/i,
    agent: "schedule",
    tools: () => [{ name: "read_schedule_conflicts" }],
    reason: "The request asks about schedule conflicts.",
  },
  {
    match:
      /\b(compare|reconcile|reconciliation|versus|vs\.?)\b.*\bschedule\b|\bschedule\b.*\b(compare|reconcile)\b/i,
    agent: "schedule",
    tools: () => [{ name: "compare_takeoff_to_schedule" }],
    reason: "The request asks to compare the takeoff with the schedule.",
  },
  {
    match: /\bschedule/i,
    agent: "schedule",
    tools: () => [{ name: "read_schedules" }],
    reason: "The request concerns imported schedules.",
  },
  {
    match: /\b(combination|mull|assembly|twin|triple)\b/i,
    agent: "combination_mull",
    tools: () => [{ name: "read_combinations" }],
    reason: "The request concerns combinations and mulls.",
  },
  {
    match: /\b(jurisdiction|ahj|code|wind|debris|noa|florida approval|permit)\b/i,
    agent: "jurisdiction_code",
    tools: () => [{ name: "read_jurisdiction" }],
    reason: "The request concerns jurisdiction and code requirements.",
  },
  {
    match: /\b(safety|egress|sill|wocd|guard|safety glazing|fall)\b/i,
    agent: "safety_egress",
    tools: () => [{ name: "read_safety_findings" }],
    reason: "The request concerns safety and egress.",
  },
  {
    match: /\b(revision|change between|what changed|activity|history)\b/i,
    agent: "document",
    tools: () => [{ name: "read_audit_history" }, { name: "read_document_pages" }],
    reason: "The request concerns document revisions and activity.",
  },
  {
    match: /\b(sheet|page|plan set|document|drawing)\b/i,
    agent: "document",
    tools: (_m, prompt) => {
      const sheet = prompt.match(/\b([A-Z]{1,3}-?\d{2,4}(?:\.\d+)?)\b/);
      return sheet
        ? [
            { name: "search_takeoff_items", args: { sheet: sheet[1] } },
            { name: "read_document_pages" },
          ]
        : [{ name: "read_document_pages" }];
    },
    reason: "The request concerns plan documents or sheets.",
  },
  {
    match: /\b(storefront|curtain ?wall)\b/i,
    agent: "window_glazing",
    tools: () => [
      {
        name: "search_takeoff_items",
        args: { productTypes: ["storefront", "curtain_wall", "curtainwall"] },
      },
    ],
    reason: "The request concerns storefront and curtain-wall items.",
  },
  {
    match: /\b(door|sliding|hardware)\b/i,
    agent: "door_hardware",
    tools: (_m, prompt) => {
      const sheet = prompt.match(/\b([A-Z]{1,3}-?\d{2,4}(?:\.\d+)?)\b/);
      return [
        {
          name: "search_takeoff_items",
          args: { category: "door", ...(sheet ? { sheet: sheet[1] } : {}) },
        },
      ];
    },
    reason: "The request concerns doors and hardware.",
  },
  {
    match: /\b(glass|glazing|impact|low-?e)\b/i,
    agent: "window_glazing",
    tools: () => [{ name: "read_takeoff_counts", args: { category: "window" } }],
    reason: "The request concerns window glazing.",
  },
  {
    match:
      /\b(how many|count|total|quantity|quantities|break ?down|grouped|group by|by type|by building|by floor|by sheet)\b/i,
    agent: "takeoff",
    tools: (_m, prompt) =>
      /\bwindow/i.test(prompt)
        ? [{ name: "read_takeoff_counts", args: { category: "window" } }]
        : [{ name: "read_takeoff_counts" }],
    reason: "The request asks for counts or grouped totals.",
  },
  {
    match: /\b(selected item|this item|current item)\b/i,
    agent: "takeoff",
    tools: () => [{ name: "read_selected_item" }],
    reason: "The request concerns the currently selected item.",
  },
  {
    match: /\b(install|installation|flashing|anchor)\b/i,
    agent: "installation",
    tools: () => [{ name: "read_takeoff_counts" }],
    reason: "The request concerns installation guidance.",
  },
  {
    match: /\b(portal|automation|supervised session)\b/i,
    agent: "portal_automation",
    tools: () => [{ name: "read_quote_readiness" }],
    reason: "The request concerns portal automation.",
  },
  {
    match: /\b(incoming file|import|connector|upload)\b/i,
    agent: "file_manager",
    tools: () => [{ name: "read_document_pages" }],
    reason: "The request concerns file management.",
  },
];

export function routeIntent(prompt: string): Intent {
  for (const rule of RULES) {
    const m = prompt.match(rule.match);
    if (m) return { agent: rule.agent, tools: rule.tools(m, prompt), reason: rule.reason };
  }
  return {
    agent: "general",
    tools: [{ name: "read_project_summary" }, { name: "read_takeoff_counts" }],
    reason: "No specialist keyword matched, so the super agent answered with the project overview.",
  };
}

export const SUGGESTIONS_BY_ROUTE: { match: RegExp; prompts: string[] }[] = [
  {
    match: /\/app\/projects\/[^/]+/,
    prompts: [
      "How many windows are currently counted?",
      "Break the count down by type, building, floor, and sheet.",
      "List items missing width, height, image, location, or type.",
      "Why is this project not ready for quote?",
      "Prepare an Excel takeoff.",
    ],
  },
  {
    match: /\/app\/schedules/,
    prompts: [
      "Compare the takeoff with the imported schedule.",
      "Summarize schedule conflicts.",
      "Find duplicate marks.",
      "Draft an RFI for conflicting window quantities.",
    ],
  },
  {
    match: /\/app\/viewer|\/app\/pages/,
    prompts: [
      "Show all doors on Sheet A201.",
      "Show every storefront and curtain-wall item.",
      "Which sheets have takeoff items?",
      "Summarize changes between revisions.",
    ],
  },
  {
    match: /\/app\/jurisdiction/,
    prompts: [
      "Summarize jurisdiction and safety findings.",
      "What adopted code and wind speed are on record?",
      "Which openings require WOCD or safety glazing?",
    ],
  },
  {
    match: /\/app\/ykk/,
    prompts: [
      "Which items are not mapped to a YKK product?",
      "Summarize YKK mapping status.",
      "Why is this project not ready for quote?",
    ],
  },
  {
    match: /.*/,
    prompts: [
      "How many windows are counted?",
      "Break the count down by type, building, floor, and sheet.",
      "Why is this project not ready for quote?",
      "Summarize jurisdiction and safety findings.",
      "Prepare a PDF takeoff report.",
    ],
  },
];

export function suggestionsForRoute(pathname: string) {
  return SUGGESTIONS_BY_ROUTE.find((s) => s.match.test(pathname))?.prompts ?? [];
}
