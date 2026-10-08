import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { ProjectUploadProvider } from "@/components/app/project/upload/ProjectUpload";
import { ProjectPicker, ProjectScopeGate } from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { PagesTab } from "@/components/app/project/PagesTab";
import { canEditRole, useMyRole } from "@/lib/use-role";
import { usePersistentState } from "@/lib/workspace-state";

export const Route = createFileRoute("/_authenticated/app/pages")({
  component: PagesPage,
});

function PagesPage() {
  const scope = useProjectScope();
  const { data: roleData } = useMyRole();
  const canEdit = canEditRole(roleData?.role);

  return (
    <AppShell
      title="Sheet Manager"
      subtitle="Classify sheets, assign discipline and level, and build working sets for takeoff."
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
        prompt="Choose a project to browse and classify its plan sheets."
      >
        {(project) => <ProjectPages key={project.id} projectId={project.id} canEdit={canEdit} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function ProjectPages({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const navigate = useNavigate();
  const [, setActivePageId] = usePersistentState<string | null>(
    `awm.project.${projectId}.page`,
    null,
  );

  return (
    <ProjectUploadProvider projectId={projectId} canEdit={canEdit}>
      <PagesTab
        projectId={projectId}
        canEdit={canEdit}
        onOpenPage={(pageId) => {
          setActivePageId(pageId);
          void navigate({ to: "/app/viewer" });
        }}
      />
    </ProjectUploadProvider>
  );
}
