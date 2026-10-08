export type AiAgentKey =
  | "document"
  | "takeoff"
  | "window_glazing"
  | "door_hardware"
  | "schedule"
  | "combination_mull"
  | "jurisdiction_code"
  | "safety_egress"
  | "ykk_product"
  | "quote_readiness"
  | "quality_control"
  | "file_manager"
  | "export_report"
  | "portal_automation"
  | "installation"
  | "legal_contract"
  | "general"
  // Trade specialist agents (CSI divisions) — one expert per trade.
  | "trade_glazing"
  | "trade_roofing"
  | "trade_concrete"
  | "trade_masonry"
  | "trade_steel"
  | "trade_framing"
  | "trade_drywall"
  | "trade_fire"
  | "trade_plumbing"
  | "trade_hvac"
  | "trade_electrical"
  | "trade_earthwork"
  | "trade_exterior";

export type AiSource = {
  type:
    | "project"
    | "document"
    | "page"
    | "takeoff_item"
    | "schedule"
    | "schedule_conflict"
    | "jurisdiction"
    | "safety"
    | "quality"
    | "ykk_mapping"
    | "combination"
    | "export"
    | "audit";
  label: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
};

export type AiContext = {
  projectId: string | null;
  projectName?: string | null;
  route: string;
  routeLabel?: string;
  pageId?: string | null;
  sheetLabel?: string | null;
  itemId?: string | null;
  itemMark?: string | null;
};

export type ToolResult = {
  /** Deterministic, human-readable markdown produced straight from the database. */
  summary: string;
  data: Record<string, unknown>;
  sources: AiSource[];
  /** Set when the tool cannot run without explicit user confirmation. */
  approval?: {
    actionType: string;
    summary: string;
    preview: Record<string, unknown>;
    payload: Record<string, unknown>;
  };
};

export type ToolRunLog = {
  id?: string;
  toolName: string;
  toolLabel: string;
  agent: AiAgentKey;
  status: "completed" | "failed" | "awaiting_approval";
  durationMs: number;
  input: Record<string, unknown>;
  error?: string | null;
};

export type AiAnswer = {
  text: string;
  agent: AiAgentKey;
  agentLabel: string;
  confidence: number;
  confidenceLabel: string;
  sources: AiSource[];
  toolRuns: ToolRunLog[];
  mode: "demo" | "live";
  approval?: ToolResult["approval"] | null;
  proposedMemory?: { scope: "project" | "company"; content: string } | null;
  /** Which provider/model actually answered, when running in live mode. */
  providerInfo?: { provider: string; model: string; usedFallback: boolean } | null;
};
