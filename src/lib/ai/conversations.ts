import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AiAnswer, AiSource } from "./types";

export type ConversationRow = {
  id: string;
  title: string | null;
  project_id: string | null;
  scope: string;
  archived: boolean;
  pinned: boolean;
  created_at: string;
  last_message_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  confidence: number | null;
  agent_key: string | null;
  mode: string;
  sources: AiSource[];
  tool_activity: AiAnswer["toolRuns"];
  created_at: string;
};

export function useConversations(search: string, includeArchived: boolean) {
  return useQuery({
    queryKey: ["ai-conversations", search, includeArchived],
    queryFn: async (): Promise<ConversationRow[]> => {
      let q = supabase
        .from("ai_conversations")
        .select("id,title,project_id,scope,archived,pinned,created_at,last_message_at")
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(80);
      if (!includeArchived) q = q.eq("archived", false);
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: ["ai-messages", conversationId],
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select(
          "id,conversation_id,role,content,confidence,agent_key,mode,sources,tool_activity,created_at",
        )
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MessageRow[];
    },
  });
}

export async function createConversation(opts: {
  projectId: string | null;
  title: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      title: opts.title.slice(0, 120),
      scope: opts.projectId ? "project" : "workspace",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function insertMessage(opts: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  answer?: AiAnswer;
}) {
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: opts.conversationId,
      role: opts.role,
      content: opts.content,
      confidence: opts.answer?.confidence ?? null,
      agent_key: opts.answer?.agent ?? null,
      mode: opts.answer?.mode ?? "demo",
      sources: (opts.answer?.sources ?? []) as never,
      tool_activity: (opts.answer?.toolRuns ?? []) as never,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("ai_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  if (opts.answer?.sources.length) {
    await supabase.from("ai_message_sources").insert(
      opts.answer.sources.slice(0, 40).map((s) => ({
        message_id: data.id,
        source_type: s.type,
        entity_id: s.entityId ?? null,
        label: s.label,
        detail: (s.detail ?? {}) as never,
      })),
    );
  }
  if (opts.answer?.agent) {
    await supabase.from("ai_agent_routing").insert({
      message_id: data.id,
      agent_key: opts.answer.agent,
      agent_label: opts.answer.agentLabel,
      reason: opts.answer.toolRuns.map((t) => t.toolLabel).join(", "),
      score: opts.answer.confidence,
    });
  }
  return data.id as string;
}

export function useConversationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ai-conversations"] });
  return {
    rename: useMutation({
      mutationFn: async ({ id, title }: { id: string; title: string }) => {
        const { error } = await supabase.from("ai_conversations").update({ title }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
        const { error } = await supabase.from("ai_conversations").update({ archived }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from("ai_conversations")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
  };
}
