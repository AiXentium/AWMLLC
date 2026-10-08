/**
 * Bid board data layer.
 *
 * Backed by the `bids` table (migration 20261004200000_commercial_grade.sql).
 * The generated Supabase Database types may not include the newest tables
 * yet, so this module talks through an untyped client handle and casts
 * rows to the local `Bid` interface at the boundary.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type BidStage = "lead" | "takeoff" | "quoting" | "submitted" | "followup" | "won" | "lost";

export const BID_STAGES: { value: BidStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "takeoff", label: "Takeoff" },
  { value: "quoting", label: "Quoting" },
  { value: "submitted", label: "Submitted" },
  { value: "followup", label: "Follow-up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export interface BidProject {
  id: string;
  name: string | null;
}

export interface Bid {
  id: string;
  project_id: string | null;
  quote_id: string | null;
  stage: BidStage;
  gc_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  /** ISO date (yyyy-mm-dd) or null. */
  due_date: string | null;
  notes: string | null;
  win_loss_reason: string | null;
  created_at: string;
  updated_at: string;
  projects?: BidProject | null;
}

export interface BidInput {
  project_id: string | null;
  stage: BidStage;
  gc_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  due_date: string | null;
  notes: string | null;
  win_loss_reason: string | null;
}

export const BIDS_QUERY_KEY = ["bids"] as const;

export function useBids() {
  return useQuery({
    queryKey: BIDS_QUERY_KEY,
    queryFn: async (): Promise<Bid[]> => {
      const { data, error } = await db
        .from("bids")
        .select("*, projects(id,name)")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Bid[];
    },
  });
}

export function useSaveBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: BidInput }) => {
      if (id) {
        const { error } = await db.from("bids").update(input).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("bids").insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BIDS_QUERY_KEY });
    },
  });
}

export function useMoveBidStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: BidStage }) => {
      const { error } = await db.from("bids").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BIDS_QUERY_KEY });
    },
  });
}

export function useDeleteBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("bids").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BIDS_QUERY_KEY });
    },
  });
}

const DAY_MS = 86_400_000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole days from today until the due date. Negative = overdue. Null = no due date. */
export function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - startOfToday()) / DAY_MS);
}

/** Whole days since updated_at. Null when unknown. */
export function daysSinceUpdate(updatedAt: string | null | undefined): number | null {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

/** Short display for an ISO date, e.g. "Oct 12". Empty string when invalid. */
export function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
