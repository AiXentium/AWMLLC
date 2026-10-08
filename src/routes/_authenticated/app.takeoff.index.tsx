import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FileStack,
  LayoutGrid,
  ScanEye,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  ProjectPicker,
  ProjectScopeGate,
  type ScopeProject,
} from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { FieldValue, ReportCard } from "@/components/app/takeoff/ReportCard";
import { ScopeFilterBar } from "@/components/app/takeoff/ScopeFilterBar";
import { Button } from "@/components/ui/button";
import {
  useControlCenterCounts,
  useScopeFilter,
  useTakeoffItems,
  totalUnits,
} from "@/lib/takeoff/data";

export const Route = createFileRoute("/_authenticated/app/takeoff/")({
  head: () => ({
    meta: [
      { title: "Takeoff Control Center — AWM Takeoff AI" },
      {
        name: "description",
        content:
          "Estimator control center for AWM window, door and glazing takeoffs: scope, coverage, validation and exports for the selected project.",
      },
      { property: "og:title", content: "Takeoff Control Center — AWM Takeoff AI" },
      {
        property: "og:description",
        content: "Scope, coverage, validation and export status for the selected AWM plan set.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlCenterPage,
});

function ControlCenterPage() {
  const scope = useProjectScope();

  return (
    <AppShell
      title="Takeoff Control Center"
      subtitle="One place to run a scoped opening takeoff — setup, plan pages, counts, validation and exports for the selected project."
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
      <ProjectScopeGate scope={scope} prompt="Choose a project to open its takeoff control center.">
        {(project) => <ControlCenter key={project.id} project={project} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function ControlCenter({ project }: { project: ScopeProject }) {
  const items = useTakeoffItems(project.id);
  const counts = useControlCenterCounts(project.id);
  const filter = useScopeFilter(project.id, items.data ?? []);

  if (items.isLoading || counts.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading takeoff data…</p>;
  }

  const error = (items.error ?? counts.error) as Error | null;
  if (error) {
    return (
      <div className="surface-panel p-6">
        <p className="font-medium text-destructive">
          Could not load this project&apos;s takeoff data.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const c = counts.data!;
  const scoped = filter.filtered;
  const units = totalUnits(scoped);
  const withImage = scoped.filter((i) => i.primary_image_path).length;
  const withCoords = scoped.filter((i) => i.source_x !== null && i.source_y !== null).length;
  const unresolvedScope = scoped.filter((i) => !i.building && !i.floor).length;

  const stage = !c.documents
    ? { label: "Awaiting plans", tone: "blocked" as const }
    : !c.pages
      ? { label: "Processing pages", tone: "attention" as const }
      : !scoped.length
        ? { label: "No openings counted", tone: "attention" as const }
        : c.openIssues
          ? { label: "Validation open", tone: "attention" as const }
          : { label: "Takeoff in progress", tone: "ready" as const };

  return (
    <div className="space-y-6">
      <div className="surface-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-2xl text-navy">{project.name}</h2>
            <StatusBadge label={project.status} />
            <StatusBadge label={stage.label} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <FieldValue value={project.project_number} missingLabel="No project number" />
            {" · "}
            <FieldValue
              value={
                [project.address, project.city, project.state].filter(Boolean).join(", ") || null
              }
              missingLabel="No site address recorded"
            />
          </p>
        </div>
        <ScopeFilterBar scope={filter} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Openings in scope"
          value={scoped.length}
          hint={
            filter.isFiltered
              ? `Filtered from ${(items.data ?? []).length} total`
              : "All buildings and floors"
          }
        />
        <StatCard label="Units counted" value={units} hint="Sum of quantity on scoped openings" />
        <StatCard
          label="Plan pages"
          value={c.pages}
          hint={`${c.pagesClassified} classified · ${c.documents} document(s)`}
        />
        <StatCard
          label="Open validation issues"
          value={c.openIssues}
          hint={`${c.scheduleEntries} schedule row(s) read`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          title="Project setup"
          description="Site, jurisdiction and building data used to shape every report."
          icon={ClipboardList}
          tone={project.county && project.postal_code ? "ready" : "attention"}
          to="/app/projects"
          linkLabel="Open project record"
        >
          <dl className="space-y-1.5 text-sm">
            <Row label="County" value={project.county} />
            <Row label="Postal code" value={project.postal_code} />
            <Row label="Status" value={project.status} />
          </dl>
        </ReportCard>

        <ReportCard
          title="PDF page manager"
          description="Classify sheets and build the working set the takeoff runs against."
          icon={FileStack}
          tone={c.pages ? (c.pagesClassified ? "ready" : "attention") : "blocked"}
          to="/app/pages"
          linkLabel="Manage pages"
        >
          <p className="text-sm text-muted-foreground">
            {c.pages
              ? `${c.pagesClassified} of ${c.pages} page(s) classified.`
              : "No pages processed yet — upload a plan set to begin."}
          </p>
          {!c.documents ? (
            <Button asChild size="sm" className="mt-3">
              <Link to="/app/projects">
                <Upload className="mr-2 size-4" aria-hidden="true" />
                Upload plans
              </Link>
            </Button>
          ) : null}
        </ReportCard>

        <ReportCard
          title="Visual takeoff workspace"
          description="Render sheets, calibrate scale and place opening markers."
          icon={ScanEye}
          tone={c.pages ? "ready" : "blocked"}
          to="/app/viewer"
          linkLabel="Open viewer"
        >
          <p className="text-sm text-muted-foreground">
            {withCoords} of {scoped.length} scoped opening(s) carry plan coordinates for
            traceability.
          </p>
        </ReportCard>

        <ReportCard
          title="Complete takeoff"
          description="Building, floor, area and opening-level report for the selected scope."
          icon={LayoutGrid}
          tone={scoped.length ? "ready" : "attention"}
          to="/app/takeoff/complete"
          linkLabel="Open complete takeoff"
        >
          <p className="text-sm text-muted-foreground">
            {scoped.length
              ? `${scoped.length} opening(s), ${withImage} with a cropped plan image.`
              : "No openings recorded in this scope yet."}
          </p>
        </ReportCard>

        <ReportCard
          title="Main-floor security"
          description="Grade-accessible and main-floor openings with received security features."
          icon={ShieldCheck}
          tone="attention"
        >
          <p className="text-sm text-muted-foreground">
            {unresolvedScope
              ? `${unresolvedScope} opening(s) have no building or floor recorded, so floor level cannot be determined yet.`
              : "Floor level will be derived from recorded building and floor values."}
          </p>
        </ReportCard>

        <ReportCard
          title="Validation & RFI"
          description="Conflicts, missing values and questions to send back to the design team."
          icon={TriangleAlert}
          tone={c.openIssues ? "attention" : "ready"}
        >
          <p className="text-sm text-muted-foreground">
            {c.openIssues
              ? `${c.openIssues} unresolved issue(s) on this project.`
              : "No unresolved issues recorded."}
          </p>
        </ReportCard>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">
        <FieldValue value={value} missingLabel="Missing" />
      </dd>
    </div>
  );
}
