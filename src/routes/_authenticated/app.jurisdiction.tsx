import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { ProjectPicker, ProjectScopeGate } from "@/components/app/ProjectScope";
import { useProjectScope, type ScopeProject } from "@/components/app/ProjectScope.hooks";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { canEditRole, useMyRole } from "@/lib/use-role";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/app/jurisdiction")({
  component: JurisdictionPage,
});

type JurisdictionRecord = {
  id: string;
  project_id: string;
  ahj_name: string | null;
  adopted_code: string | null;
  amendments: string | null;
  design_wind_speed: string | null;
  debris_region: string | null;
  impact_required: boolean | null;
  energy_requirements: string | null;
  egress_requirements: string | null;
  safety_glazing_notes: string | null;
  upper_floor_restrictions: string | null;
  permit_notes: string | null;
  source_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string;
};

const FIELDS: { key: keyof JurisdictionRecord; label: string; multiline?: boolean }[] = [
  { key: "ahj_name", label: "Authority having jurisdiction" },
  { key: "adopted_code", label: "Adopted code edition" },
  { key: "debris_region", label: "Wind-borne debris region" },
  { key: "amendments", label: "Local amendments", multiline: true },
  { key: "energy_requirements", label: "Energy requirements", multiline: true },
  { key: "egress_requirements", label: "Egress requirements", multiline: true },
  { key: "safety_glazing_notes", label: "Safety glazing notes", multiline: true },
  { key: "upper_floor_restrictions", label: "Upper-floor restrictions", multiline: true },
  { key: "permit_notes", label: "Permit notes", multiline: true },
  { key: "source_url", label: "Official source URL" },
];

function JurisdictionPage() {
  const scope = useProjectScope();
  return (
    <AppShell
      title="Jurisdiction"
      subtitle="Code path, wind and debris inputs, and verification history for the project address."
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
        prompt="Choose a project to review its jurisdiction and code requirements."
      >
        {(project) => <JurisdictionDetail key={project.id} project={project} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function JurisdictionDetail({ project }: { project: ScopeProject }) {
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const canEdit = canEditRole(roleData?.role);

  const projectDetail = useQuery({
    queryKey: ["jurisdiction-project", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "wind_speed,exposure_category,risk_category,flood_zone,code_edition,building_department,municipality,county,design_pressure_notes",
        )
        .eq("id", project.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const record = useQuery({
    queryKey: ["jurisdiction-record", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jurisdiction_records")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as JurisdictionRecord | null;
    },
  });

  const [draft, setDraft] = useState<Partial<JurisdictionRecord>>({});
  useEffect(() => {
    if (record.data) setDraft(record.data);
    else if (projectDetail.data) {
      setDraft({
        ahj_name: projectDetail.data.building_department ?? projectDetail.data.municipality ?? null,
        adopted_code: projectDetail.data.code_edition ?? null,
        design_wind_speed: projectDetail.data.wind_speed ?? null,
      });
    }
  }, [record.data, projectDetail.data]);

  const save = useMutation({
    mutationFn: async (verify: boolean) => {
      const { data: auth } = await supabase.auth.getUser();
      const payload = {
        project_id: project.id,
        ahj_name: draft.ahj_name ?? null,
        adopted_code: draft.adopted_code ?? null,
        amendments: draft.amendments ?? null,
        design_wind_speed: draft.design_wind_speed ?? null,
        debris_region: draft.debris_region ?? null,
        impact_required: draft.impact_required ?? null,
        energy_requirements: draft.energy_requirements ?? null,
        egress_requirements: draft.egress_requirements ?? null,
        safety_glazing_notes: draft.safety_glazing_notes ?? null,
        upper_floor_restrictions: draft.upper_floor_restrictions ?? null,
        permit_notes: draft.permit_notes ?? null,
        source_url: draft.source_url ?? null,
        ...(verify
          ? { verified_by: auth.user?.id ?? null, verified_at: new Date().toISOString() }
          : {}),
      };
      const { error } = record.data
        ? await supabase.from("jurisdiction_records").update(payload).eq("id", record.data.id)
        : await supabase.from("jurisdiction_records").insert(payload);
      if (error) throw new Error(error.message);
      await logAudit({
        projectId: project.id,
        action: verify ? "jurisdiction.verified" : "jurisdiction.updated",
        entityType: "jurisdiction",
        entityId: record.data?.id ?? project.id,
        detail: { ahj: payload.ahj_name },
      });
    },
    onSuccess: () => {
      toast.success("Jurisdiction record saved.");
      void qc.invalidateQueries({ queryKey: ["jurisdiction-record", project.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const address = [project.address, project.city, project.state, project.postal_code]
    .filter(Boolean)
    .join(", ");
  const detail = projectDetail.data;
  const verified = Boolean(record.data?.verified_at);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jurisdiction"
          value={draft.ahj_name || project.county || "Not set"}
          hint={address || "No address on file"}
        />
        <StatCard
          label="Code path"
          value={draft.adopted_code || detail?.code_edition || "Not set"}
          hint="Adopted edition"
        />
        <StatCard
          label="Design wind speed"
          value={
            draft.design_wind_speed
              ? `${draft.design_wind_speed} mph`
              : detail?.wind_speed
                ? `${detail.wind_speed} mph`
                : "Not set"
          }
          hint={
            detail?.exposure_category ? `Exposure ${detail.exposure_category}` : "Exposure not set"
          }
        />
        <StatCard
          label="Flood zone"
          value={detail?.flood_zone || "Not set"}
          hint={detail?.risk_category ? `Risk ${detail.risk_category}` : "Risk not set"}
        />
      </div>

      <div className="surface-panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-navy">Verification</p>
          <p className="text-sm text-muted-foreground">
            {verified
              ? `Last verified ${new Date(record.data!.verified_at!).toLocaleString()}`
              : "Not yet verified against an official source. All values are subject to AHJ confirmation."}
          </p>
        </div>
        <StatusBadge label={verified ? "Verified" : "Pending verification"} />
      </div>

      <div className="surface-panel p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wind">Design wind speed (mph)</Label>
            <Input
              id="wind"
              inputMode="numeric"
              placeholder="e.g. 165"
              disabled={!canEdit}
              value={draft.design_wind_speed ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, design_wind_speed: e.target.value || null }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="impact">Impact protection required</Label>
            <select
              id="impact"
              disabled={!canEdit}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={
                draft.impact_required === null || draft.impact_required === undefined
                  ? ""
                  : String(draft.impact_required)
              }
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  impact_required: e.target.value === "" ? null : e.target.value === "true",
                }))
              }
            >
              <option value="">Not determined</option>
              <option value="true">Required</option>
              <option value="false">Not required</option>
            </select>
          </div>
          {FIELDS.map((field) => (
            <div key={field.key} className={`space-y-2 ${field.multiline ? "md:col-span-2" : ""}`}>
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  id={field.key}
                  rows={2}
                  disabled={!canEdit}
                  value={(draft[field.key] as string | null) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />
              ) : (
                <Input
                  id={field.key}
                  disabled={!canEdit}
                  value={(draft[field.key] as string | null) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        {canEdit ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => save.mutate(false)} disabled={save.isPending}>
              Save record
            </Button>
            <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>
              Save &amp; mark verified
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Your role has read-only access to jurisdiction records.
          </p>
        )}
      </div>
    </>
  );
}
