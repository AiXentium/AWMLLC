import type { TradeAgent, TradeId } from "./types";
import { glazingAgent } from "./glazing";
import { roofingAgent } from "./roofing";
import { concreteAgent, masonryAgent, steelAgent, framingAgent } from "./structure";
import { drywallAgent } from "./finishes";
import { fireAgent, plumbingAgent, hvacAgent, electricalAgent } from "./mep";
import { earthworkAgent, exteriorAgent } from "./civil";

export type { TradeAgent, TradeId };

/** All trade specialist agents, in CSI division order. */
export const TRADE_AGENTS: TradeAgent[] = [
  concreteAgent, // 03
  masonryAgent, // 04
  steelAgent, // 05
  framingAgent, // 06
  roofingAgent, // 07
  glazingAgent, // 08
  drywallAgent, // 09
  fireAgent, // 21
  plumbingAgent, // 22
  hvacAgent, // 23
  electricalAgent, // 26
  earthworkAgent, // 31
  exteriorAgent, // 32
];

export const TRADE_AGENT_MAP: Record<TradeId, TradeAgent> = Object.fromEntries(
  TRADE_AGENTS.map((a) => [a.id, a]),
) as Record<TradeId, TradeAgent>;

export function tradeAgent(id: TradeId): TradeAgent {
  return TRADE_AGENT_MAP[id];
}

/** Finds the trade agent whose keywords best match a piece of plan text. */
export function tradeAgentForText(text: string): TradeAgent | null {
  const hay = text.toLowerCase();
  let best: TradeAgent | null = null;
  let bestScore = 0;
  for (const agent of TRADE_AGENTS) {
    let score = 0;
    for (const kw of agent.planKeywords) {
      if (hay.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Maps a takeoff shortcut category to its trade specialist. */
export function tradeAgentForTakeoffCategory(category: string): TradeAgent {
  switch (category) {
    case "windows":
    case "doors":
    case "sliding_doors":
    case "storefront_curtainwall":
    case "louvers":
    case "skylights":
      return glazingAgent;
    default:
      return glazingAgent;
  }
}
