import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, History, RotateCcw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { auditDetailText, auditLabel } from "@/lib/audit";
import {
  listDeleted,
  purgeRecords,
  restoreRecords,
  type DeletedRecord,
} from "@/lib/lifecycle/actions";
import { LIFECYCLE, RECYCLE_BIN_ENTITIES, type LifecycleEntity } from "@/lib/lifecycle/registry";
import { useMyRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/app/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Recycle Bin — AWM Takeoff AI" },
      {
        name: "description",
        content: "Preview, restore or permanently purge deleted AWM project records.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecycleBinPage,
});

function RecycleBinPage() {
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const isAdmin = roleData?.role === "owner_admin";

  const [typeFilter, setTypeFilter] = useState<"all" | LifecycleEntity>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [since, setSince] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<DeletedRecord | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeletedRecord[] | null>(null);
  const [purgeStep, setPurgeStep] = useState(1);
  const [purgeReason, setPurgeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const results = useQueries({
    queries: RECYCLE_BIN_ENTITIES.map((entity) => ({
      queryKey: ["recycle-bin", entity],
      queryFn: () => listDeleted(entity),
      staleTime: 10_000,
    })),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["recycle-bin-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["recycle-bin-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email");
      return data ?? [];
    },
  });

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;
  const personName = (id: string | null) => {
    const hit = people.find((p) => p.id === id);
    return hit?.full_name ?? hit?.email ?? null;
  };

  const all = useMemo(() => results.flatMap((r) => r.data ?? []), [results]);
  const loading = results.some((r) => r.isLoading);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => (typeFilter === "all" ? true : r.entity === typeFilter))
      .filter((r) => (projectFilter === "all" ? true : r.projectId === projectFilter))
      .filter((r) => (userFilter === "all" ? true : r.deletedBy === userFilter))
      .filter((r) => (statusFilter === "all" ? true : r.restoreStatus === statusFilter))
      .filter((r) => (since ? new Date(r.deletedAt) >= new Date(since) : true))
      .filter((r) => (q ? `${r.title} ${r.subtitle ?? ""}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [all, typeFilter, projectFilter, userFilter, statusFilter, since, query]);

  const selectedRows = rows.filter((r) => selected.has(`${r.entity}:${r.id}`));

  function refresh() {
    for (const entity of RECYCLE_BIN_ENTITIES)
      qc.invalidateQueries({ queryKey: ["recycle-bin", entity] });
    setSelected(new Set());
  }

  async function restoreMany(list: DeletedRecord[]) {
    setBusy(true);
    setMessage(null);
    try {
      const byEntity = new Map<LifecycleEntity, DeletedRecord[]>();
      for (const row of list) byEntity.set(row.entity, [...(byEntity.get(row.entity) ?? []), row]);
      let total = 0;
      for (const [entity, group] of byEntity) {
        total += await restoreRecords({
          entity,
          ids: group.map((g) => g.id),
          projectId: group[0].projectId,
          sourceScreen: "recycle_bin",
        });
      }
      setMessage(`${total} record${total === 1 ? "" : "s"} restored.`);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!purgeTarget) return;
    setBusy(true);
    try {
      const byEntity = new Map<LifecycleEntity, DeletedRecord[]>();
      for (const row of purgeTarget)
        byEntity.set(row.entity, [...(byEntity.get(row.entity) ?? []), row]);
      let total = 0;
      for (const [entity, group] of byEntity) {
        total += await purgeRecords({
          entity,
          ids: group.map((g) => g.id),
          reason: purgeReason.trim(),
          projectId: group[0].projectId,
        });
      }
      setMessage(`${total} record${total === 1 ? "" : "s"} permanently purged.`);
      setPurgeTarget(null);
      setPurgeStep(1);
      setPurgeReason("");
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Purge failed.");
    } finally {
      setBusy(false);
    }
  }

  const purgeBlocked = purgeTarget?.some((r) => LIFECYCLE[r.entity].purgeAdminOnly) && !isAdmin;

  return (
    <AppShell
      title="Recycle Bin"
      subtitle="Every deleted project record — preview, restore or permanently purge"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedRows.length || busy}
            onClick={() => void restoreMany(selectedRows)}
          >
            <RotateCcw className="mr-2 size-4" aria-hidden="true" /> Restore selected (
            {selectedRows.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={projectFilter === "all" || busy || !rows.length}
            onClick={() => void restoreMany(rows)}
          >
            Restore all from project
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!selectedRows.length || busy}
            onClick={() => {
              setPurgeTarget(selectedRows);
              setPurgeStep(1);
            }}
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" /> Purge selected
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <Label htmlFor="rb-type">Record type</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger id="rb-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {RECYCLE_BIN_ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {LIFECYCLE[e].plural}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-project">Project</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger id="rb-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-user">Deleted by</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger id="rb-user">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-status">Restoration status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="rb-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="deleted">Awaiting restore</SelectItem>
                <SelectItem value="restored">Previously restored</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-since">Deleted on or after</Label>
            <Input
              id="rb-since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-q">Search</Label>
            <Input
              id="rb-q"
              placeholder="Name or source…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {message ? <p className="text-sm text-navy">{message}</p> : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Record
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Project
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Deleted
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  By
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Reason
                </th>
                <th scope="col" className="px-4 py-2 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-muted-foreground">
                    Loading deleted records…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-muted-foreground">
                    Nothing deleted matches these filters. Deleted documents, sheets, working sets,
                    takeoff items, exports and extracted candidates all appear here.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = `${row.entity}:${row.id}`;
                  return (
                    <tr key={key}>
                      <td className="px-4 py-2">
                        <Checkbox
                          checked={selected.has(key)}
                          aria-label={`Select ${row.title}`}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-navy">{row.title}</p>
                        {row.subtitle ? (
                          <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{LIFECYCLE[row.entity].label}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {projectName(row.projectId) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(row.deletedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {personName(row.deletedBy) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {row.deletionReason ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setPreview(row)}>
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void restoreMany([row])}
                          >
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              setPurgeTarget([row]);
                              setPurgeStep(1);
                            }}
                          >
                            Purge
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DeletionHistory />
      </div>

      {/* ---- Preview ---- */}
      <Dialog open={preview !== null} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              {preview ? LIFECYCLE[preview.entity].label : ""} deleted from{" "}
              {projectName(preview?.projectId ?? null) ?? "an unassigned record"}.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Deleted</dt>
            <dd>{preview ? new Date(preview.deletedAt).toLocaleString() : ""}</dd>
            <dt className="text-muted-foreground">Deleted by</dt>
            <dd>{personName(preview?.deletedBy ?? null) ?? "—"}</dd>
            <dt className="text-muted-foreground">Reason</dt>
            <dd>{preview?.deletionReason ?? "—"}</dd>
            <dt className="text-muted-foreground">Original parent</dt>
            <dd className="truncate">{preview?.originalParentId ?? "—"}</dd>
            <dt className="text-muted-foreground">Restoration status</dt>
            <dd>{preview?.restoreStatus}</dd>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (preview) void restoreMany([preview]);
                setPreview(null);
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Two-step purge ---- */}
      <Dialog open={purgeTarget !== null} onOpenChange={(v) => !busy && !v && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden="true" /> Permanent
              purge
            </DialogTitle>
            <DialogDescription>
              {purgeTarget?.length} record{purgeTarget?.length === 1 ? "" : "s"} will be destroyed.
              This cannot be undone and the Recycle Bin will not be able to bring them back.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {[...new Set(purgeTarget?.map((r) => r.entity) ?? [])].map((entity) => (
              <li
                key={entity}
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3"
              >
                <p className="font-medium text-navy">{LIFECYCLE[entity].plural}</p>
                <p className="text-xs text-muted-foreground">{LIFECYCLE[entity].purgeWarning}</p>
                {LIFECYCLE[entity].dependents?.length ? (
                  <p className="mt-1 text-xs text-destructive">
                    Dependent records removed: {LIFECYCLE[entity].dependents?.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {purgeBlocked ? (
            <p className="text-sm text-destructive">
              Only an owner or admin can permanently purge these record types. Ask an administrator,
              or restore them instead.
            </p>
          ) : purgeStep === 1 ? (
            <p className="text-sm text-muted-foreground">
              Confirm once to continue, then a second time to purge.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="purge-reason">Reason for permanent purge</Label>
              <Input
                id="purge-reason"
                value={purgeReason}
                placeholder="Uploaded in error / client requested removal"
                onChange={(e) => setPurgeReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={busy}>
              Cancel
            </Button>
            {purgeBlocked ? null : purgeStep === 1 ? (
              <Button variant="destructive" onClick={() => setPurgeStep(2)}>
                I understand — continue
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={busy || !purgeReason.trim()}
                onClick={() => void purge()}
              >
                {busy ? "Purging…" : "Permanently purge"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** Full deletion / restore / purge history straight from the audit trail. */
function DeletionHistory() {
  const { data = [] } = useQuery({
    queryKey: ["deletion-history"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("audit_log")
        .select("id,action,entity_type,detail,created_at,project_id")
        .in("action", [
          "lifecycle.deleted",
          "lifecycle.restored",
          "lifecycle.purged",
          "lifecycle.page_excluded",
          "lifecycle.page_included",
        ])
        .order("created_at", { ascending: false })
        .limit(100);
      return rows ?? [];
    },
  });

  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-navy">
        <History className="size-4" aria-hidden="true" /> Deletion history ({data.length})
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {data.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            No deletion activity recorded yet.
          </li>
        ) : (
          data.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <span className="font-medium text-navy">{auditLabel(entry.action)}</span>
              <span className="text-xs text-muted-foreground">{auditDetailText(entry.detail)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
