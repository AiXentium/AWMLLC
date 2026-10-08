import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import {
  ProjectPicker,
  ProjectScopeGate,
  type ScopeProject,
} from "@/components/app/ProjectScope";
import { useProjectScope } from "@/components/app/ProjectScope.hooks";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { canEditRole, useMyRole } from "@/lib/use-role";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/app/ykk-automation")({
  component: YkkAutomationPage,
});

type Item = {
  id: string;
  mark: string | null;
  category: string;
  product_type: string | null;
  quantity: number;
  width_in: number | null;
  height_in: number | null;
  status: string;
};

type Mapping = {
  id: string;
  takeoff_item_id: string | null;
  ykk_product_id: string | null;
  status: string;
  confidence: number | null;
  notes: string | null;
};

type Product = {
  id: string;
  family: string;
  series: string | null;
  model: string | null;
  product_type: string | null;
};

function YkkAutomationPage() {
  const scope = useProjectScope();
  return (
    <AppShell
      title="YKK Automation"
      subtitle="Map approved takeoff quantities to YKK AP products. Every sensitive step stays under human control."
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
      <ProjectScopeGate scope={scope} prompt="Choose a project to prepare its YKK product mapping.">
        {(project) => <AutomationDetail key={project.id} project={project} />}
      </ProjectScopeGate>
    </AppShell>
  );
}

function AutomationDetail({ project }: { project: ScopeProject }) {
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const canEdit = canEditRole(roleData?.role);
  const [pending, setPending] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["ykk-items", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takeoff_items")
        .select("id,mark,category,product_type,quantity,width_in,height_in,status")
        .eq("project_id", project.id)
        .is("deleted_at", null)
        .order("mark");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const mappings = useQuery({
    queryKey: ["ykk-mappings", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ykk_mappings")
        .select("id,takeoff_item_id,ykk_product_id,status,confidence,notes")
        .eq("project_id", project.id);
      if (error) throw error;
      return (data ?? []) as Mapping[];
    },
  });

  const products = useQuery({
    queryKey: ["ykk-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ykk_products")
        .select("id,family,series,model,product_type")
        .eq("active", true)
        .order("family");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const activity = useQuery({
    queryKey: ["ykk-activity", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,detail,created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mappingByItem = useMemo(
    () =>
      new Map(
        (mappings.data ?? [])
          .filter((m) => m.takeoff_item_id)
          .map((m) => [m.takeoff_item_id as string, m]),
      ),
    [mappings.data],
  );

  const save = useMutation({
    mutationFn: async (input: { itemId: string; productId: string }) => {
      const existing = mappingByItem.get(input.itemId);
      const payload = {
        project_id: project.id,
        takeoff_item_id: input.itemId,
        ykk_product_id: input.productId,
        status: "mapped",
      };
      const { error } = existing
        ? await supabase.from("ykk_mappings").update(payload).eq("id", existing.id)
        : await supabase.from("ykk_mappings").insert(payload);
      if (error) throw new Error(error.message);
      await logAudit({
        projectId: project.id,
        action: "ykk.mapping_updated",
        entityType: "takeoff_item",
        entityId: input.itemId,
        detail: { productId: input.productId },
      });
    },
    onSuccess: () => {
      toast.success("Product mapping saved.");
      void qc.invalidateQueries({ queryKey: ["ykk-mappings", project.id] });
      void qc.invalidateQueries({ queryKey: ["ykk-activity", project.id] });
      setPending(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = items.data ?? [];
  const mapped = rows.filter((r) => mappingByItem.has(r.id)).length;
  const approved = rows.filter((r) => r.status === "approved").length;
  const totalQty = rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

  if (items.isLoading)
    return <p className="text-sm text-muted-foreground">Loading takeoff items…</p>;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Takeoff items" value={rows.length} hint={`${totalQty} units total`} />
        <StatCard label="Approved" value={approved} hint="Ready to configure" />
        <StatCard label="Mapped to YKK" value={mapped} hint="Linked to a catalog product" />
        <StatCard
          label="Catalog products"
          value={products.data?.length ?? 0}
          hint="Active YKK AP records"
        />
      </div>

      <div className="surface-panel mb-6 p-4 text-sm text-muted-foreground">
        AWM never stores portal passwords, never bypasses security checks, never accepts
        substitutions, and never submits orders automatically. Mapping prepares configuration data
        for an estimator who signs in to YKK directly.
      </div>

      {rows.length === 0 ? (
        <div className="surface-panel p-8 text-center">
          <p className="font-serif text-xl text-navy">No takeoff items yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Place and approve takeoff markers in the viewer to build the quantities that get mapped
            to YKK products.
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-x-auto">
          <table className="w-full min-w-[58rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                {[
                  "Mark",
                  "Category",
                  "Type",
                  "Size",
                  "Qty",
                  "Item status",
                  "YKK product",
                  "Mapping",
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
              {rows.map((item) => {
                const mapping = mappingByItem.get(item.id);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-medium text-navy">{item.mark ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.product_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.width_in && item.height_in
                        ? `${item.width_in}" × ${item.height_in}"`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      {products.data?.length ? (
                        <Select
                          value={mapping?.ykk_product_id ?? undefined}
                          disabled={!canEdit || save.isPending}
                          onValueChange={(productId) => {
                            setPending(item.id);
                            save.mutate({ itemId: item.id, productId });
                          }}
                        >
                          <SelectTrigger
                            className="w-[15rem]"
                            aria-label={`Product for ${item.mark ?? item.id}`}
                          >
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.data.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {[p.family, p.series, p.model].filter(Boolean).join(" ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Catalog empty</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={
                          pending === item.id ? "Saving" : mapping ? mapping.status : "Not mapped"
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 font-serif text-2xl text-navy">Recent project activity</h2>
      <div className="surface-panel mt-4 p-6">
        {activity.data?.length ? (
          <ul className="space-y-3 text-sm">
            {activity.data.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <p className="text-foreground">{entry.action.replace(/[._]/g, " ")}</p>
                </div>
                <StatusBadge label={entry.action.startsWith("ykk") ? "YKK" : "Project"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recorded activity for this project yet.
          </p>
        )}
      </div>

      {canEdit ? null : (
        <p className="mt-4 text-sm text-muted-foreground">
          Your role has read-only access to YKK mapping.
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button
          variant="outline"
          onClick={() => void qc.invalidateQueries({ queryKey: ["ykk-mappings", project.id] })}
        >
          Refresh mapping
        </Button>
      </div>
    </>
  );
}
