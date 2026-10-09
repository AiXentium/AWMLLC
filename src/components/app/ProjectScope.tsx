import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScopeProject, useProjectScope } from "./ProjectScope.hooks";
export type { ScopeProject } from "./ProjectScope.hooks";

export function ProjectPicker({
  projects,
  value,
  onChange,
  className,
}: {
  projects: ScopeProject[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-[16rem]"} aria-label="Select project">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.project_number ? `${p.project_number} — ${p.name}` : p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Empty / loading / no-selection scaffolding shared by the standalone routes. */
export function ProjectScopeGate({
  scope,
  children,
  prompt,
}: {
  scope: ReturnType<typeof useProjectScope>;
  prompt: string;
  children: (project: ScopeProject) => React.ReactNode;
}) {
  if (scope.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading projects…</p>;
  }
  if (scope.error) {
    return (
      <div className="surface-panel p-6">
        <p className="font-medium text-destructive">Could not load your projects.</p>
        <p className="mt-1 text-sm text-muted-foreground">{scope.error.message}</p>
      </div>
    );
  }
  if (!scope.projects.length) {
    return (
      <div className="surface-panel p-8 text-center">
        <p className="font-serif text-xl text-navy">No projects yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Create a project and upload a plan set — every sheet, schedule and takeoff on this screen
          comes from real project documents.
        </p>
        <Button asChild className="mt-4">
          <Link to="/app/projects">Go to Projects</Link>
        </Button>
      </div>
    );
  }
  if (!scope.project) {
    return (
      <div className="surface-panel p-8 text-center">
        <p className="font-serif text-xl text-navy">Select a project</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{prompt}</p>
        <div className="mt-4 flex justify-center">
          <ProjectPicker
            projects={scope.projects}
            value={scope.projectId}
            onChange={scope.setProjectId}
          />
        </div>
      </div>
    );
  }
  return <>{children(scope.project)}</>;
}
