/**
 * Shared data access for the Takeoff Control Center.
 *
 * Every value rendered by the Control Center comes from these queries — no
 * placeholder counts, no invented project attributes. When a field is null in
 * the database it stays null and the UI flags it as missing.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePersistentState } from "@/lib/workspace-state";

export type TakeoffItemRow = {
  id: string;
  page_id: string | null;
  mark: string | null;
  category: string | null;
  type_name: string | null;
  product_type: string | null;
  quantity: number | null;
  /** Typical multiplier (e.g. 8 identical floors) — effective qty = quantity × multiplier. */
  multiplier: number | null;
  width_in: number | null;
  height_in: number | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  room: string | null;
  elevation: string | null;
  status: string | null;
  ai_confidence: number | null;
  primary_image_path: string | null;
  source_x: number | null;
  source_y: number | null;
};

const ITEM_COLUMNS =
  "id,page_id,mark,category,type_name,product_type,quantity,multiplier,width_in,height_in,building,floor,unit,room,elevation,status,ai_confidence,primary_image_path,source_x,source_y";

export function useTakeoffItems(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["takeoff-cc", "items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takeoff_items")
        .select(ITEM_COLUMNS)
        .eq("project_id", projectId!)
        .is("deleted_at", null)
        .order("mark", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as TakeoffItemRow[];
    },
  });
}

export type ControlCenterCounts = {
  documents: number;
  pages: number;
  pagesClassified: number;
  scheduleEntries: number;
  openIssues: number;
  exports: number;
};

/** Head-only counts so the overview stays cheap on large plan sets. */
export function useControlCenterCounts(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["takeoff-cc", "counts", projectId],
    queryFn: async (): Promise<ControlCenterCounts> => {
      const pid = projectId!;
      const head = { count: "exact" as const, head: true };
      const unwrap = async <T extends { count: number | null; error: unknown }>(
        p: PromiseLike<T>,
      ) => {
        const { count, error } = await p;
        if (error) throw error;
        return count ?? 0;
      };

      const [documents, pages, pagesClassified, scheduleEntries, openIssues, exportsCount] =
        await Promise.all([
          unwrap(supabase.from("documents").select("id", head).eq("project_id", pid)),
          unwrap(supabase.from("pages").select("id", head).eq("project_id", pid)),
          unwrap(
            supabase
              .from("pages")
              .select("id", head)
              .eq("project_id", pid)
              .not("classification", "is", null),
          ),
          unwrap(supabase.from("plan_schedule_entries").select("id", head).eq("project_id", pid)),
          unwrap(
            supabase
              .from("quality_issues")
              .select("id", head)
              .eq("project_id", pid)
              .eq("resolved", false),
          ),
          unwrap(supabase.from("exports").select("id", head).eq("project_id", pid)),
        ]);

      return {
        documents,
        pages,
        pagesClassified,
        scheduleEntries,
        openIssues,
        exports: exportsCount,
      };
    },
  });
}

export type ScopeFilterValue = { building: string | null; floor: string | null };

/**
 * Building / floor selection, persisted per project so moving between Control
 * Center screens keeps the same scope.
 */
export function useScopeFilter(projectId: string, items: TakeoffItemRow[]) {
  const [value, setValue] = usePersistentState<ScopeFilterValue>(`awm.takeoff.${projectId}.scope`, {
    building: null,
    floor: null,
  });

  const buildings = useMemo(() => uniqueValues(items.map((i) => i.building)), [items]);
  const floors = useMemo(
    () =>
      uniqueValues(
        items.filter((i) => !value.building || i.building === value.building).map((i) => i.floor),
      ),
    [items, value.building],
  );

  // A stored value that no longer exists in the data behaves as "all".
  const building = value.building && buildings.includes(value.building) ? value.building : null;
  const floor = value.floor && floors.includes(value.floor) ? value.floor : null;

  const filtered = useMemo(
    () =>
      items.filter((i) => (!building || i.building === building) && (!floor || i.floor === floor)),
    [items, building, floor],
  );

  return {
    buildings,
    floors,
    building,
    floor,
    filtered,
    setBuilding: (next: string | null) => setValue({ building: next, floor: null }),
    setFloor: (next: string | null) => setValue({ building, floor: next }),
    clear: () => setValue({ building: null, floor: null }),
    isFiltered: Boolean(building || floor),
  };
}

function uniqueValues(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function totalUnits(items: TakeoffItemRow[]) {
  return items.reduce(
    (sum, i) => sum + (Number(i.quantity ?? 0) || 0) * (Number(i.multiplier ?? 1) || 1),
    0,
  );
}

/**
 * Sets the typical multiplier on a set of items (e.g. "typical floor ×8").
 * Effective quantity becomes quantity × multiplier everywhere quantities roll up.
 */
export async function setTypicalMultiplier(
  projectId: string,
  itemIds: string[],
  multiplier: number,
): Promise<number> {
  if (!itemIds.length) return 0;
  const m = Math.max(1, Math.min(99, Math.round(multiplier) || 1));
  const { error } = await supabase
    .from("takeoff_items")
    .update({ multiplier: m })
    .in("id", itemIds)
    .eq("project_id", projectId);
  if (error) throw error;
  return itemIds.length;
}
