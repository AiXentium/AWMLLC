import { supabase } from "@/integrations/supabase/client";
import { createConversation, insertMessage } from "./conversations";
import { narrateAiAnswer } from "./provider.functions";
import type { AiAnswer, AiSource } from "./types";

export type SheetAnalysisResult = {
  conversationId: string;
  text: string;
  mode: "live" | "demo";
  provider?: string;
  model?: string;
  error?: string;
};

/**
 * Sends a rendered plan sheet (or a crop of one) to the AI engine for visual
 * analysis and persists the exchange with its sources. When no provider key is
 * usable the caller receives mode "demo" and nothing is saved as if it were a
 * real answer.
 */
export async function analyzeSheetImage(opts: {
  projectId: string;
  pageId: string;
  imageDataUrl: string;
  prompt: string;
  scope: "sheet" | "crop";
}): Promise<SheetAnalysisResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Your session expired. Sign in again.");

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select(
      "id,page_number,sheet_number,title,discipline,building,floor,project_id,documents(id,name)",
    )
    .eq("id", opts.pageId)
    .maybeSingle();
  if (pageError) throw pageError;
  if (!page) throw new Error("Sheet not found.");

  const doc = page.documents as { id: string; name: string } | null;
  const sheetLabel = page.sheet_number ?? `Page ${page.page_number}`;

  const { data: items } = await supabase
    .from("takeoff_items")
    .select("category,quantity")
    .eq("page_id", opts.pageId)
    .is("deleted_at", null);

  const savedCounts = new Map<string, number>();
  for (const i of items ?? [])
    savedCounts.set(i.category, (savedCounts.get(i.category) ?? 0) + (i.quantity ?? 1));
  const countLines = [...savedCounts.entries()].map(([k, v]) => `- ${k}: ${v}`);

  const facts = [
    `**Sheet under review**`,
    `- Sheet: ${sheetLabel}${page.title ? ` — ${page.title}` : ""}`,
    `- Plan set: ${doc?.name ?? "Unknown document"}`,
    `- Discipline: ${page.discipline ?? "—"} · Building: ${page.building ?? "—"} · Floor: ${page.floor ?? "—"}`,
    ``,
    `**Verified saved takeoff on this sheet**`,
    countLines.length ? countLines.join("\n") : "- No takeoff items saved on this sheet yet.",
    ``,
    `An image of ${opts.scope === "crop" ? "a cropped region of" : ""} this sheet is attached for visual review.`,
  ].join("\n");

  const narration = await narrateAiAnswer({
    data: {
      prompt: opts.prompt,
      facts,
      agentLabel: "Plan Vision Analyst",
      taskCategory: "vision_analysis",
      projectId: opts.projectId,
      conversationId: null,
      images: [opts.imageDataUrl],
    },
  });

  if (!narration.text) {
    return {
      conversationId: "",
      text: "",
      mode: "demo",
      error:
        narration.error ??
        "No AI provider is configured for vision analysis. Add an OpenAI or Anthropic key in Project Settings → Secrets.",
    };
  }

  const sources: AiSource[] = [
    {
      type: "page",
      label: `Plan sheet — ${sheetLabel}`,
      entityId: page.id,
      detail: { pageNumber: page.page_number },
    },
  ];
  if (doc)
    sources.push({
      type: "document",
      label: `Plan document — ${doc.name}`,
      entityId: doc.id,
      detail: {},
    });

  const answer: AiAnswer = {
    text: narration.text,
    agent: "document",
    agentLabel: "Plan Vision Analyst",
    confidence: 0.5,
    confidenceLabel: "Moderate — image-derived findings require estimator confirmation",
    sources,
    toolRuns: [],
    mode: "live",
    approval: null,
    proposedMemory: null,
    providerInfo: {
      provider: narration.provider ?? "unknown",
      model: narration.model ?? "unknown",
      usedFallback: Boolean(narration.usedFallback),
    },
  };

  const conversationId = await createConversation({
    projectId: opts.projectId,
    title: `Sheet analysis — ${sheetLabel}`,
    userId,
  });
  await insertMessage({ conversationId, role: "user", content: opts.prompt });
  await insertMessage({ conversationId, role: "assistant", content: narration.text, answer });

  return {
    conversationId,
    text: narration.text,
    mode: "live",
    provider: narration.provider,
    model: narration.model,
  };
}
