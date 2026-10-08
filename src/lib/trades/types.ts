/**
 * Trade specialist agents — one expert per construction trade (CSI MasterFormat).
 *
 * Each agent carries:
 *   - domain expertise (materials, methods, assemblies)
 *   - the codes and standards that govern its work
 *   - what it takes off from plans and in which units
 *   - a system prompt so AI calls answer as that trade's specialist
 *
 * Trade agents are jurisdiction-aware: the project's geocoded location
 * (state/county/city) selects the adopted code edition, wind speed, and
 * impact requirements via src/lib/jurisdiction/requirements.ts. The
 * `regulations` below are the model-code baselines; local amendments
 * always win and unknowns are flagged for AHJ verification, never guessed.
 */

export type TradeId =
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

export interface TradeAgent {
  /** Stable id, also used as the AiAgentKey. */
  id: TradeId;
  /** Display name, e.g. "Glazing & Openings Specialist". */
  name: string;
  /** CSI MasterFormat divisions, e.g. ["08"]. */
  csiDivisions: string[];
  /** One-line role description. */
  blurb: string;
  /** What this trade covers — materials, systems, assemblies. */
  scope: string[];
  /** Domain knowledge: methods, detailing rules, estimating practice. */
  expertise: string[];
  /** Governing codes/standards (model-code baselines; AHJ amendments win). */
  regulations: string[];
  /** Takeoff units this trade estimates in. */
  takeoffUnits: string[];
  /** Plan keywords/symbols this trade looks for. */
  planKeywords: string[];
  /** System prompt for AI calls answered as this specialist. */
  systemPrompt: string;
}
