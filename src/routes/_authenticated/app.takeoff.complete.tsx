import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  ProjectPicker,
  ProjectScopeGate,
  type ScopeProject,
} from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { StatCard } from "@/components/app/WorkspacePrimitives";
import { HierarchyRollup } from "@/components/app/takeoff/HierarchyRollup";
import { ScopeFilterBar } from "@/components/app/takeoff/ScopeFilterBar";
import { StickyHead, StickyTable, Th } from "@/components/app/takeoff/StickyTable";
import { Button } from "@/components/ui/button";
import { useScopeFilter, useTakeoffItems, totalUnits } from "@/lib/takeoff/data";
import { buildHierarchy } from "@/lib/takeoff/hierarchy";

export const Route = createFileRoute("/_authenticated/app/takeoff/complete")({
  head: () => ({
    meta: [
      { title: "Complete Takeoff — AWM Takeoff AI" },
      {
        name: "description",
        content:
          "Hierarchical opening takeoff by building, floor, area and type for the selected AWM project scope.",
      },
      { property: "og:title", content: "Complete Takeoff — AWM Takeoff AI" },
      {
        property: "og:description",
        content:
          "Every counted window, door and glazing opening rolled up by building, floor, area and type.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompleteTakeoffPage,
});

function CompleteTakeoffPage() {
  const scope = useProjectScope();

  return (
    <AppShell
      title="Complete Takeoff"
      subtitle="Every counted opening in the selected scope, rolled up through the project hierarchy."
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
      <ProjectScopeGate scope={scope} prompt="Choose a project to see its complete takeoff report.">
        {(project) => <CompleteTakeoff key={project.id} project={project} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function CompleteTakeoff({ project }: { project: ScopeProject }) {
  const items = useTakeoffItems(project.id);
  const filter = useScopeFilter(project.id, items.data ?? []);

  if (items.isLoading) return <p className="text-sm text-muted-foreground">Loading openings…</p>;

  if (items.error) {
    return (
      <div className="surface-panel p-6">
        <p className="font-medium text-destructive">Could not load this project&apos;s openings.</p>
        <p className="mt-1 text-sm text-muted-foreground">{(items.error as Error).message}</p>
      </div>
    );
  }

  const scoped = filter.filtered;
  const { nodes, shape } = buildHierarchy(scoped);
  const units = totalUnits(scoped);
  const traceable = scoped.filter(
    (i) => i.page_id && i.source_x !== null && i.source_y !== null,
  ).length;

  return (
    <div className="space-y-6">
      <div className="surface-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/app/takeoff">
              <ArrowLeft className="mr-1.5 size-4" aria-hidden="true" />
              Control Center
            </Link>
          </Button>
          <h2 className="font-serif text-2xl text-navy">{project.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{shape.description}</p>
        </div>
        <ScopeFilterBar scope={filter} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Openings in scope"
          value={scoped.length}
          hint={
            filter.isFiltered
              ? `Filtered from ${(items.data ?? []).length} total`
              : "All buildings and floors"
          }
        />
        <StatCard label="Units counted" value={units} hint="Sum of recorded quantities" />
        <StatCard
          label="Traceable to a sheet"
          value={traceable}
          hint={`${scoped.length - traceable} without plan coordinates`}
        />
      </div>

      {!scoped.length ? (
        <div className="surface-panel p-8 text-center">
          <p className="font-serif text-xl text-navy">No openings in this scope</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {filter.isFiltered
              ? "No counted openings match the selected building and floor. Clear the scope filter to see the full project."
              : "Place markers in the plan viewer, or approve AI detections, and every counted opening will roll up here."}
          </p>
          <Button asChild className="mt-4">
            <Link to="/app/viewer">Open plan viewer</Link>
          </Button>
        </div>
      ) : (
        <StickyTable>
          <StickyHead>
            <Th>Mark / group</Th>
            <Th>Type</Th>
            <Th>Size</Th>
            <Th>Location</Th>
            <Th align="right">Units</Th>
            <Th align="right">Confidence</Th>
            <Th>Source</Th>
          </StickyHead>
          <tbody>
            {nodes.map((node) => (
              <HierarchyRollup key={node.key} node={node} />
            ))}
          </tbody>
        </StickyTable>
      )}
    </div>
  );
}
