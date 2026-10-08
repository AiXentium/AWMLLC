import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowDown, ArrowUp, GripVertical, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AiContextSync } from "@/components/app/ai/AiContextSync";
import { PlansTab } from "@/components/app/project/PlansTab";
import { ProjectInfoReview } from "@/components/app/project/ProjectInfoReview";
import { PreAnalysisPanel } from "@/components/app/project/PreAnalysisPanel";

import { ProjectDriveSection } from "@/components/app/google/ProjectDriveSection";
import { ProjectDropboxSection } from "@/components/app/dropbox/ProjectDropboxSection";
import { PagesTab } from "@/components/app/project/PagesTab";
import { WorkingSetsTab } from "@/components/app/project/WorkingSetsTab";
import { ViewerTab } from "@/components/app/project/ViewerTab";
import { ExportsTab, TakeoffTab } from "@/components/app/project/TakeoffTab";
import { ProposalTab } from "@/components/app/proposal/ProposalTab";
import {
  ProcessingBanner,
  ProjectUploadProvider,
  UploadButton,
  UploadDropzone,
  UploadQueue,
} from "@/components/app/project/upload/ProjectUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { canEditRole, useMyRole } from "@/lib/use-role";
import { usePersistentState } from "@/lib/workspace-state";
import { usePlanPreAnalysis } from "@/lib/analysis/runner";
import { useSectionOrder } from "@/components/app/project/useSectionOrder";
import { auditDetailText, auditLabel } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>): { upload?: true } => ({
    upload:
      search.upload === true || search.upload === "1" || search.upload === "true"
        ? true
        : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Project workspace — AWM Takeoff AI" },
      {
        name: "description",
        content: "Plans, pages, viewer, takeoff and exports for an AWM project.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectWorkspace,
});

const STATUSES = [
  "active",
  "review",
  "approved",
  "ready_for_quote",
  "completed",
  "on_hold",
  "archived",
] as const;

const PROJECT_COLUMNS =
  "id,name,code,project_number,status,project_type,address,city,state,county,postal_code,municipality,building_department,general_contractor,architect,revision,plan_date,due_date,description,notes,owner_id,created_at";

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  const { upload: openUploadOnMount } = Route.useSearch();
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const canEdit = canEditRole(roleData?.role);
  // Background pre-analysis watcher — stays mounted for every tab so the run
  // starts automatically after intake without any manual trigger.
  usePlanPreAnalysis(projectId, canEdit);

  const [tab, setTab] = usePersistentState(`awm.project.${projectId}.tab`, "overview");
  const [activePageId, setActivePageId] = usePersistentState<string | null>(
    `awm.project.${projectId}.page`,
    null,
  );
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS)
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,entity_type,created_at,detail")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const saveProject = useMutation({
    mutationFn: async (patch: Record<string, string | null>) => {
      const { error } = await supabase
        .from("projects")
        .update(patch as never)
        .eq("id", projectId);
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  function openPage(pageId: string, itemId?: string) {
    setActivePageId(pageId);
    setFocusItemId(itemId ?? null);
    setTab("viewer");
  }

  if (isLoading || !project) {
    return (
      <AppShell title="Project">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </AppShell>
    );
  }

  const detailFields: [string, keyof typeof project][] = [
    ["Project number", "project_number"],
    ["Project code", "code"],
    ["Project type", "project_type"],
    ["Address", "address"],
    ["City", "city"],
    ["County", "county"],
    ["State", "state"],
    ["ZIP", "postal_code"],
    ["Municipality", "municipality"],
    ["Building department", "building_department"],
    ["General contractor", "general_contractor"],
    ["Architect", "architect"],
    ["Plan revision", "revision"],
  ];

  return (
    <ProjectUploadProvider
      projectId={projectId}
      canEdit={canEdit}
      defaultOpen={openUploadOnMount === true}
    >
      <AppShell
        title={project.name}
        subtitle={
          [project.project_number, project.city, project.state].filter(Boolean).join(" · ") ||
          "AWM project workspace"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="secondary">{project.status.replace(/_/g, " ")}</Badge>
            <UploadButton />
            <Button asChild variant="outline" size="sm">
              <Link to="/app/projects">
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> All projects
              </Link>
            </Button>
          </div>
        }
      >
        <AiContextSync projectId={project.id} projectName={project.name} />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {[
              ["overview", "Overview"],
              ["details", "Details"],
              ["plans", "Plans"],
              ["pages", "Pages"],
              ["sets", "Working Sets"],
              ["viewer", "Viewer"],
              ["takeoff", "Takeoff"],
              ["proposal", "Proposal"],
              ["exports", "Exports"],
              ["activity", "Activity"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewPanel
              projectId={projectId}
              canEdit={canEdit}
              onGoToPlans={() => setTab("plans")}
              onGoToSets={() => setTab("sets")}
              onOpenPage={(pageId) => openPage(pageId)}
            />
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <p className="mb-4 rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              Fallback / correction entry. These fields are auto-populated from the uploaded
              documents where possible — edit them here only to correct or supply what the plan set
              does not state.
            </p>
            <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3">
              {detailFields.map(([label, key]) => (
                <div key={key as string} className="space-y-2">
                  <Label htmlFor={`f-${String(key)}`}>{label}</Label>
                  <Input
                    id={`f-${String(key)}`}
                    defaultValue={(project[key] as string | null) ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) => saveProject.mutate({ [key as string]: e.target.value || null })}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="f-status">Status</Label>
                <Select
                  value={project.status}
                  disabled={!canEdit}
                  onValueChange={(value) => saveProject.mutate({ status: value })}
                >
                  <SelectTrigger id="f-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-3">
                <Label htmlFor="f-notes">Notes</Label>
                <Textarea
                  id="f-notes"
                  rows={4}
                  defaultValue={project.notes ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) => saveProject.mutate({ notes: e.target.value || null })}
                />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
                Changes autosave when a field loses focus. Role: {roleData?.role ?? "viewer"}.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <PlansTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="pages" className="mt-6">
            <PagesTab projectId={projectId} canEdit={canEdit} onOpenPage={openPage} />
          </TabsContent>

          <TabsContent value="sets" className="mt-6">
            <WorkingSetsTab projectId={projectId} canEdit={canEdit} onOpenPage={openPage} />
          </TabsContent>

          <TabsContent value="viewer" className="mt-6">
            <ViewerTab
              projectId={projectId}
              canEdit={canEdit}
              pageId={activePageId}
              focusItemId={focusItemId}
              onSelectPage={(id) => {
                setActivePageId(id);
                setFocusItemId(null);
              }}
            />
          </TabsContent>

          <TabsContent value="takeoff" className="mt-6">
            <TakeoffTab
              projectId={projectId}
              project={project}
              canEdit={canEdit}
              onOpenPage={openPage}
            />
          </TabsContent>

          <TabsContent value="proposal" className="mt-6">
            <ProposalTab
              projectId={projectId}
              project={project}
              onGoToTakeoff={() => setTab("takeoff")}
            />
          </TabsContent>

          <TabsContent value="exports" className="mt-6">
            <ExportsTab projectId={projectId} projectName={project.name} />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {activity.length === 0 ? (
                <li className="p-6 text-sm text-muted-foreground">
                  No recorded activity yet. Uploads, calibrations, AI runs, detection reviews, item
                  edits and exports are logged here automatically.
                </li>
              ) : (
                activity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm"
                  >
                    <div>
                      <p className="font-medium text-navy">{auditLabel(entry.action)}</p>
                      {auditDetailText(entry.detail) ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {auditDetailText(entry.detail)}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </AppShell>
    </ProjectUploadProvider>
  );
}

function OverviewPanel({
  projectId,
  canEdit,
  onGoToPlans,
  onGoToSets,
  onOpenPage,
}: {
  projectId: string;
  canEdit: boolean;
  onGoToPlans: () => void;
  onGoToSets: () => void;
  onOpenPage: (pageId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-overview", projectId],
    queryFn: async () => {
      const [docs, pages, items, setPages, exportRows, detections] = await Promise.all([
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("pages")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("takeoff_items")
          .select("quantity,status")
          .eq("project_id", projectId)
          .is("deleted_at", null),
        supabase
          .from("working_sets")
          .select("id,working_set_pages(page_id)")
          .eq("project_id", projectId),
        supabase
          .from("exports")
          .select("id,filename,created_at,status")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("ai_detections").select("status").eq("project_id", projectId),
      ]);
      const rows = items.data ?? [];
      const dets = detections.data ?? [];
      const workingSheets = new Set(
        (setPages.data ?? []).flatMap((s) =>
          ((s as { working_set_pages?: { page_id: string }[] }).working_set_pages ?? []).map(
            (p) => p.page_id,
          ),
        ),
      ).size;
      return {
        documents: docs.count ?? 0,
        pages: pages.count ?? 0,
        workingSheets,
        items: rows.length,
        approved: rows.filter((i) => i.status === "approved").length,
        quantity: rows.reduce((sum, i) => sum + (i.quantity ?? 1), 0),
        pendingDetections: dets.filter((d) => d.status === "pending").length,
        rejectedDetections: dets.filter((d) => d.status === "rejected").length,
        lastExport: exportRows.data?.[0] ?? null,
      };
    },
  });

  const cards = [
    ["Plan sets", data?.documents],
    ["Total sheets", data?.pages],
    ["Working sheets selected", data?.workingSheets],
    ["Takeoff items", data?.items],
    ["Approved items", data?.approved],
    ["Counted units", data?.quantity],
    ["Pending AI detections", data?.pendingDetections],
    ["Rejected AI detections", data?.rejectedDetections],
  ] as const;

  const noDocuments = !isLoading && (data?.documents ?? 0) === 0;

  // Section rearrange: per-project order persisted in localStorage.
  const [rearranging, setRearranging] = useState(false);
  const [order, moveUp, moveDown, resetOrder] = useSectionOrder(`awm-overview-order-${projectId}`, [
    "preliminary",
    "intake",
    "info",
    "drive",
    "dropbox",
    "stats",
    "export",
  ]);

  const sections: Record<string, ReactNode> = {
    preliminary: (
      <PreAnalysisPanel
        projectId={projectId}
        canEdit={canEdit}
        onOpenPage={onOpenPage}
        onOpenWorkingSets={onGoToSets}
      />
    ),
    intake: (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg text-navy">Project intake</p>
            <p className="text-sm text-muted-foreground">
              Start here — upload the architect&rsquo;s PDF plan set, several PDFs, or a ZIP of the
              full set.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <UploadButton label="Upload Plans or ZIP" size="default" />
            <Button variant="outline" size="default" onClick={onGoToPlans}>
              Manage documents
            </Button>
          </div>
        </div>
        {noDocuments ? (
          <div className="mt-4">
            <UploadDropzone />
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          <UploadQueue />
          <ProcessingBanner />
        </div>
      </div>
    ),
    info: <ProjectInfoReview projectId={projectId} canEdit={canEdit} onOpenPage={onOpenPage} />,
    drive: <ProjectDriveSection projectId={projectId} canEdit={canEdit} />,
    dropbox: <ProjectDropboxSection projectId={projectId} canEdit={canEdit} />,
    stats: (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-navy">
              {isLoading ? "…" : (value ?? 0)}
            </p>
          </div>
        ))}
      </div>
    ),
    export: (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last export</p>
        {data?.lastExport ? (
          <p className="mt-2 text-sm text-navy">
            <span className="font-medium">{data.lastExport.filename ?? "Export"}</span> ·{" "}
            {new Date(data.lastExport.created_at).toLocaleString()} · {data.lastExport.status}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No exports yet — generate an Excel or PDF takeoff from the Takeoff tab.
          </p>
        )}
      </div>
    ),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {rearranging ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetOrder}
              title="Restore default section order"
            >
              <RotateCcw className="mr-1 size-4" aria-hidden="true" />
              Reset order
            </Button>
            <Button size="sm" onClick={() => setRearranging(false)}>
              <GripVertical className="mr-1 size-4" aria-hidden="true" />
              Done
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRearranging(true)}
            title="Rearrange sections on this page"
          >
            <GripVertical className="mr-1 size-4" aria-hidden="true" />
            Rearrange
          </Button>
        )}
      </div>
      {order.map((id, index) => (
        <div
          key={id}
          className={
            rearranging
              ? "relative rounded-lg border-2 border-dashed border-bronze/60 p-1"
              : "relative"
          }
        >
          {rearranging ? (
            <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md bg-card/95 p-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === 0}
                onClick={() => moveUp(id)}
                title="Move section up"
                aria-label={`Move ${id} up`}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === order.length - 1}
                onClick={() => moveDown(id)}
                title="Move section down"
                aria-label={`Move ${id} down`}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
          {sections[id]}
        </div>
      ))}
    </div>
  );
}
