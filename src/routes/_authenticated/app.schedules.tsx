import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { ProjectPicker, ProjectScopeGate } from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePersistentState } from "@/lib/workspace-state";

export const Route = createFileRoute("/_authenticated/app/schedules")({
  component: SchedulesPage,
});

type ScheduleEntry = {
  id: string;
  page_id: string | null;
  source_sheet: string | null;
  schedule_type: string;
  mark: string | null;
  type_label: string | null;
  width: string | null;
  height: string | null;
  quantity: number | null;
  material: string | null;
  glazing: string | null;
  operation: string | null;
  confidence: number | null;
};

type TakeoffRow = {
  mark: string | null;
  quantity: number;
  width_in: number | null;
  height_in: number | null;
  page_id: string | null;
};

function SchedulesPage() {
  const scope = useProjectScope();
  return (
    <AppShell
      title="Schedules"
      subtitle="Extracted plan schedules compared against live takeoff quantities, with every row traced to its sheet."
      actions={
        scope.projects.length ? (
          <ProjectPicker
            projects={scope.projects}
            value={scope.projectId}
            onChange={scope.setProjectId}
          />
        ) : null
      }
    >
      <ProjectScopeGate
        scope={scope}
        prompt="Choose a project to compare its schedules with takeoff results."
      >
        {(project) => <ScheduleComparison key={project.id} projectId={project.id} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function ScheduleComparison({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [, setActivePageId] = usePersistentState<string | null>(
    `awm.project.${projectId}.page`,
    null,
  );

  const entries = useQuery({
    queryKey: ["schedule-entries", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_schedule_entries")
        .select(
          "id,page_id,source_sheet,schedule_type,mark,type_label,width,height,quantity,material,glazing,operation,confidence",
        )
        .eq("project_id", projectId)
        .order("mark");
      if (error) throw error;
      return (data ?? []) as ScheduleEntry[];
    },
  });

  const takeoff = useQuery({
    queryKey: ["schedule-takeoff", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takeoff_items")
        .select("mark,quantity,width_in,height_in,page_id")
        .eq("project_id", projectId)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as TakeoffRow[];
    },
  });

  const takeoffByMark = useMemo(() => {
    const map = new Map<
      string,
      { quantity: number; width: number | null; height: number | null; pageId: string | null }
    >();
    for (const item of takeoff.data ?? []) {
      const key = (item.mark ?? "").trim().toUpperCase();
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, {
        quantity: (existing?.quantity ?? 0) + (item.quantity ?? 0),
        width: existing?.width ?? item.width_in,
        height: existing?.height ?? item.height_in,
        pageId: existing?.pageId ?? item.page_id,
      });
    }
    return map;
  }, [takeoff.data]);

  const rows = useMemo(() => {
    const list = (entries.data ?? []).map((entry) => {
      const key = (entry.mark ?? "").trim().toUpperCase();
      const match = key ? takeoffByMark.get(key) : undefined;
      const scheduleQty = entry.quantity ?? 0;
      const takeoffQty = match?.quantity ?? 0;
      let status = "Matched";
      if (!match) status = "Missing in takeoff";
      else if (takeoffQty !== scheduleQty) status = "Quantity conflict";
      return {
        entry,
        key,
        scheduleQty,
        takeoffQty,
        pageId: entry.page_id ?? match?.pageId ?? null,
        status,
      };
    });

    const scheduleMarks = new Set(list.map((r) => r.key).filter(Boolean));
    const extras = [...takeoffByMark.entries()]
      .filter(([mark]) => !scheduleMarks.has(mark))
      .map(([mark, value]) => ({
        entry: {
          id: `extra-${mark}`,
          page_id: value.pageId,
          source_sheet: null,
          schedule_type: "—",
          mark,
          type_label: null,
          width: value.width ? `${value.width}"` : null,
          height: value.height ? `${value.height}"` : null,
          quantity: null,
          material: null,
          glazing: null,
          operation: null,
          confidence: null,
        } as ScheduleEntry,
        key: mark,
        scheduleQty: 0,
        takeoffQty: value.quantity,
        pageId: value.pageId,
        status: "Not in schedule",
      }));

    return [...list, ...extras];
  }, [entries.data, takeoffByMark]);

  const stats = useMemo(
    () => ({
      marks: rows.length,
      matched: rows.filter((r) => r.status === "Matched").length,
      conflicts: rows.filter((r) => r.status === "Quantity conflict").length,
      missing: rows.filter((r) => r.status !== "Matched" && r.status !== "Quantity conflict")
        .length,
    }),
    [rows],
  );

  if (entries.isLoading || takeoff.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule comparison…</p>;
  }

  if (!rows.length) {
    return (
      <div className="surface-panel p-8 text-center">
        <p className="font-serif text-xl text-navy">No schedule data yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Schedules appear once the automatic plan pre-analysis has read a window, door or
          storefront schedule sheet for this project.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Marks" value={stats.marks} hint="Schedule rows + takeoff-only marks" />
        <StatCard label="Matched" value={stats.matched} hint="Quantities agree" />
        <StatCard label="Conflicts" value={stats.conflicts} hint="Schedule vs. takeoff quantity" />
        <StatCard label="Unreconciled" value={stats.missing} hint="Missing on one side" />
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[62rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left">
              {[
                "Mark",
                "Type",
                "Schedule",
                "Size",
                "Schedule qty",
                "Takeoff qty",
                "Δ",
                "Confidence",
                "Sheet",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.entry.id}
                className="border-b border-border last:border-0 hover:bg-secondary/40"
              >
                <td className="px-4 py-3 font-medium text-navy">{row.entry.mark ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.entry.type_label ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.entry.schedule_type.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[row.entry.width, row.entry.height].filter(Boolean).join(" × ") || "—"}
                </td>
                <td className="px-4 py-3">{row.entry.quantity ?? "—"}</td>
                <td className="px-4 py-3">{row.takeoffQty}</td>
                <td className="px-4 py-3 font-medium">
                  {row.entry.quantity == null ? "—" : row.takeoffQty - row.scheduleQty}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.entry.confidence == null
                    ? "—"
                    : `${Math.round(row.entry.confidence * 100)}%`}
                </td>
                <td className="px-4 py-3">
                  {row.pageId ? (
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => {
                        setActivePageId(row.pageId);
                        void navigate({ to: "/app/viewer" });
                      }}
                    >
                      {row.entry.source_sheet ?? "Open sheet"}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">{row.entry.source_sheet ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
