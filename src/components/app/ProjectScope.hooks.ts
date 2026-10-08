import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePersistentState } from "@/lib/workspace-state";

export type ScopeProject = {
  id: string;
  name: string;
  status: string;
  project_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  postal_code: string | null;
};

const SCOPE_COLUMNS = "id,name,status,project_number,address,city,state,county,postal_code";

export function useScopeProjects() {
  return useQuery({
    queryKey: ["scope-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(SCOPE_COLUMNS)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ScopeProject[];
    },
  });
}

/**
 * Shared workspace-wide project selection. The standalone routes
 * (/app/pages, /app/viewer, /app/schedules, /app/jurisdiction) all read and
 * write the same persisted value so switching project on one screen carries
 * across the whole workspace.
 */
export function useProjectScope() {
  const { data: projects = [], isLoading, error } = useScopeProjects();
  const [projectId, setProjectId] = usePersistentState<string | null>(
    "awm.workspace.project",
    null,
  );
  const project = projects.find((p) => p.id === projectId) ?? null;
  // A stored id that no longer resolves (deleted project) behaves as "none selected".
  return {
    projects,
    isLoading,
    error: error as Error | null,
    projectId: project ? projectId : null,
    project,
    setProjectId,
  };
}
