import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { ProjectUploadProvider } from "@/components/app/project/upload/ProjectUpload";
import { ProjectPicker, ProjectScopeGate } from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { ViewerTab } from "@/components/app/project/ViewerTab";
import { canEditRole, useMyRole } from "@/lib/use-role";
import { usePersistentState } from "@/lib/workspace-state";

export const Route = createFileRoute("/_authenticated/app/viewer")({
  component: ViewerPage,
});

function ViewerPage() {
  const scope = useProjectScope();
  const { data: roleData } = useMyRole();
  const canEdit = canEditRole(roleData?.role);

  return (
    <AppShell
      title="Plan Viewer"
      subtitle="Render sheets, calibrate scale, measure, annotate and place takeoff markers."
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
        prompt="Choose a project to open its plan sheets in the viewer."
      >
        {(project) => <ProjectViewer key={project.id} projectId={project.id} canEdit={canEdit} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function ProjectViewer({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  // Shares the same persisted sheet selection as the project workspace viewer.
  const [activePageId, setActivePageId] = usePersistentState<string | null>(
    `awm.project.${projectId}.page`,
    null,
  );

  return (
    <ProjectUploadProvider projectId={projectId} canEdit={canEdit}>
      <ViewerTab
        projectId={projectId}
        canEdit={canEdit}
        pageId={activePageId}
        onSelectPage={setActivePageId}
      />
    </ProjectUploadProvider>
  );
}
