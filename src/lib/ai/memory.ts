import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MemoryRow = {
  id: string;
  scope: string;
  project_id: string | null;
  user_id: string | null;
  title: string | null;
  content: string;
  approved: boolean;
  disabled: boolean;
  approved_at: string | null;
  created_at: string;
};

export function useMemories(
  scope: "all" | "conversation" | "project" | "company",
  projectId?: string | null,
) {
  return useQuery({
    queryKey: ["ai-memory", scope, projectId ?? null],
    queryFn: async (): Promise<MemoryRow[]> => {
      let q = supabase
        .from("ai_memory")
        .select(
          "id,scope,project_id,user_id,title,content,approved,disabled,approved_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (scope !== "all") q = q.eq("scope", scope);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MemoryRow[];
    },
  });
}

export function useMemoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ai-memory"] });
  return {
    propose: useMutation({
      mutationFn: async (input: {
        scope: "conversation" | "project" | "company";
        content: string;
        title?: string;
        projectId?: string | null;
      }) => {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("ai_memory").insert({
          scope: input.scope,
          project_id: input.projectId ?? null,
          user_id: userData.user?.id ?? null,
          title: input.title ?? null,
          content: input.content,
          // Conversation scope is automatic; project/company memory needs approval.
          approved: input.scope === "conversation",
        });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: async ({ id, content }: { id: string; content?: string }) => {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("ai_memory")
          .update({
            approved: true,
            approved_by: userData.user?.id ?? null,
            approved_at: new Date().toISOString(),
            ...(content ? { content } : {}),
          })
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    setDisabled: useMutation({
      mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
        const { error } = await supabase.from("ai_memory").update({ disabled }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, content }: { id: string; content: string }) => {
        const { error } = await supabase.from("ai_memory").update({ content }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from("ai_memory").delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
  };
}
