import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner_admin" | "estimator" | "reviewer" | "viewer";

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { role: "viewer" as AppRole, userId: null };
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const order: AppRole[] = ["owner_admin", "estimator", "reviewer", "viewer"];
      const role = order.find((r) => roles.includes(r)) ?? "viewer";
      return { role, userId: uid };
    },
  });
}

export function canEditRole(role: AppRole | undefined) {
  return role === "owner_admin" || role === "estimator";
}

export function canReviewRole(role: AppRole | undefined) {
  return role === "owner_admin" || role === "estimator" || role === "reviewer";
}
