import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Combine,
  Copy,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AUTO_WORKING_SET_NAME, isAutoWorkingSet } from "@/lib/analysis/shared";
import { UploadEmptyState } from "@/components/app/project/upload/ProjectUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { WORKING_SET_CATEGORIES } from "@/lib/takeoff-types";

export function WorkingSetsTab({
  projectId,
  canEdit,
  onOpenPage,
}: {
  projectId: string;
  canEdit: boolean;
  onOpenPage?: (pageId: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Window Takeoff");
  const [error, setError] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ["working-sets-full", projectId, showArchived],
    queryFn: async () => {
      const query = supabase
        .from("working_sets")
        .select("id,name,category,description,created_at,deleted_at,working_set_pages(page_id)")
        .eq("project_id", projectId)
        .order("created_at");
      // Archived (soft-deleted) sets are hidden unless explicitly requested.
      const { data, error: err } = await (showArchived ? query : query.is("deleted_at", null));
      if (err) throw err;
      return data;
    },
  });

  const createSet = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error: err } = await supabase.from("working_sets").insert({
        project_id: projectId,
        name: name.trim() || category,
        category,
        created_by: userData.user?.id ?? null,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      setName("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] });
      qc.invalidateQueries({ queryKey: ["working-sets", projectId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const duplicateSet = useMutation({
    mutationFn: async (id: string) => {
      const source = sets.find((s) => s.id === id);
      if (!source) return;
      const { data: created, error: err } = await supabase
        .from("working_sets")
        .insert({ project_id: projectId, name: `${source.name} (copy)`, category: source.category })
        .select("id")
        .single();
      if (err) throw err;
      const pages = (source.working_set_pages ?? []) as { page_id: string }[];
      if (pages.length) {
        const { error: pageErr } = await supabase.from("working_set_pages").insert(
          pages.map((p, index) => ({
            working_set_id: created.id,
            page_id: p.page_id,
            sort_order: index,
          })),
        );
        if (pageErr) throw pageErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] }),
  });

  // Soft delete (archive) — Washington's never-delete rule: nothing is destroyed.
  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase
        .from("working_sets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] });
      qc.invalidateQueries({ queryKey: ["working-sets", projectId] });
    },
  });

  const restoreSet = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase
        .from("working_sets")
        .update({ deleted_at: null })
        .eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] });
      qc.invalidateQueries({ queryKey: ["working-sets", projectId] });
    },
  });

  /**
   * Merges the selected working sets into one: all unique pages move into a
   * single set (named after the first selected), then the source sets are
   * archived (soft-deleted, never destroyed). The merged set's description
   * records the source set ids and names, so the merge stays reversible.
   * For split plan parts this restores the one-project view.
   */
  const mergeSets = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = sets.filter((s) => ids.includes(s.id));
      if (targets.length < 2) throw new Error("Select at least two working sets to merge.");
      const { data: userData } = await supabase.auth.getUser();

      // Collect every page across the selected sets.
      const pageIds: string[] = [];
      for (const t of targets) {
        const { data, error: err } = await supabase
          .from("working_set_pages")
          .select("page_id")
          .eq("working_set_id", t.id);
        if (err) throw err;
        for (const row of data ?? []) pageIds.push((row as { page_id: string }).page_id);
      }
      const uniquePageIds = [...new Set(pageIds)];

      const first = targets[0];
      const mergedName =
        first.name === AUTO_WORKING_SET_NAME ? AUTO_WORKING_SET_NAME : `${first.name} (merged)`;
      const { data: created, error: createErr } = await supabase
        .from("working_sets")
        .insert({
          project_id: projectId,
          name: mergedName,
          category: first.category,
          description: `Merged from ${targets.length} working sets [${targets.map((t) => t.id).join(", ")}]: ${targets
            .map((t) => t.name)
            .join(", ")
            .slice(0, 220)}`,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (createErr) throw createErr;

      if (uniquePageIds.length) {
        const { error: pageErr } = await supabase.from("working_set_pages").insert(
          uniquePageIds.map((page_id, index) => ({
            working_set_id: created.id,
            page_id,
            sort_order: index,
          })),
        );
        if (pageErr) throw pageErr;
      }

      // Archive the source sets instead of deleting them (never-delete rule).
      const { error: delErr } = await supabase
        .from("working_sets")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (delErr) throw delErr;
      return { name: mergedName, pages: uniquePageIds.length };
    },
    onSuccess: (r) => {
      setMergeSelection(new Set());
      qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] });
      qc.invalidateQueries({ queryKey: ["working-sets", projectId] });
      toast.success(`Merged into "${r.name}"`, {
        description: `${r.pages} pages in one working set. Source sets archived (not deleted).`,
      });
    },
    onError: (e: Error) => toast.error("Merge failed", { description: e.message }),
  });

  function toggleMerge(id: string) {
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            createSet.mutate();
          }}
        >
          <div className="min-w-[14rem] flex-1 space-y-2">
            <Label htmlFor="ws-name">Working set name</Label>
            <Input
              id="ws-name"
              placeholder="Building A — Window Takeoff"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-56 space-y-2">
            <Label htmlFor="ws-cat">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ws-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKING_SET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={createSet.isPending}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Create
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </form>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading working sets…</p>
      ) : sets.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            No working sets yet. Create one, then add pages from the Pages tab.
          </p>
          <UploadEmptyState
            title="No documents uploaded yet"
            description="Working sets are built from uploaded sheets. Upload plans or a ZIP archive to get started."
          />
        </div>
      ) : (
        <>
          {mergeSelection.size >= 2 ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm text-navy">
                <span className="font-medium">{mergeSelection.size}</span> working sets selected
              </p>
              <Button
                size="sm"
                onClick={() => mergeSets.mutate([...mergeSelection])}
                disabled={mergeSets.isPending}
              >
                <Combine className="mr-2 size-4" aria-hidden="true" />
                {mergeSets.isPending ? "Merging…" : "Merge into one"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMergeSelection(new Set())}>
                Clear
              </Button>
            </div>
          ) : null}
          <div className="mb-1 flex items-center justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(v) => setShowArchived(v === true)}
                aria-label="Show archived working sets"
              />
              Show archived
            </label>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sets.map((set) => {
              const archived = Boolean(set.deleted_at);
              return (
                <li
                  key={set.id}
                  className={`rounded-lg border border-border bg-card p-4${archived ? " opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {canEdit && !archived ? (
                        <Checkbox
                          className="mt-1"
                          checked={mergeSelection.has(set.id)}
                          onCheckedChange={() => toggleMerge(set.id)}
                          aria-label={`Select ${set.name} for merge`}
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-navy">{set.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline">{set.category}</Badge>
                          {archived ? (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                              Archived
                            </Badge>
                          ) : null}
                          {isAutoWorkingSet(set.name, set.description) ? (
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="size-3" aria-hidden="true" /> AI selected
                            </Badge>
                          ) : null}
                        </div>
                        {set.description ? (
                          <p className="mt-2 text-xs text-muted-foreground">{set.description}</p>
                        ) : null}
                      </div>
                    </div>

                    {canEdit ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Duplicate working set"
                          onClick={() => duplicateSet.mutate(set.id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        {archived ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Restore working set"
                            title="Restore working set"
                            onClick={() => restoreSet.mutate(set.id)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Archive working set"
                            title="Archive working set"
                            onClick={() => deleteSet.mutate(set.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {(set.working_set_pages ?? []).length} page(s)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenSet((cur) => (cur === set.id ? null : set.id))}
                    >
                      {openSet === set.id ? "Hide pages" : "Manage pages"}
                    </Button>
                  </div>
                  {openSet === set.id ? (
                    <SetPages
                      setId={set.id}
                      projectId={projectId}
                      canEdit={canEdit}
                      onOpenPage={onOpenPage}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

type SetPageRow = {
  id: string;
  sort_order: number | null;
  page_id: string;
  pages: { page_number: number; sheet_number: string | null; title: string | null } | null;
};

function SetPages({
  setId,
  projectId,
  canEdit,
  onOpenPage,
}: {
  setId: string;
  projectId: string;
  canEdit: boolean;
  onOpenPage?: (pageId: string) => void;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["working-set-members", setId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("working_set_pages")
        .select("id,sort_order,page_id,pages(page_number,sheet_number,title)")
        .eq("working_set_id", setId)
        .order("sort_order", { nullsFirst: true });
      if (err) throw err;
      return (data ?? []) as unknown as SetPageRow[];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["working-set-members", setId] });
    qc.invalidateQueries({ queryKey: ["working-sets-full", projectId] });
  }

  const removePage = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase.from("working_set_pages").delete().eq("id", id);
      if (err) throw err;
    },
    onSuccess: refresh,
  });

  const reorder = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: -1 | 1 }) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return;
      const a = rows[index];
      const b = rows[target];
      await Promise.all([
        supabase.from("working_set_pages").update({ sort_order: target }).eq("id", a.id),
        supabase.from("working_set_pages").update({ sort_order: index }).eq("id", b.id),
      ]);
    },
    onSuccess: refresh,
  });

  const visible = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return [r.pages?.sheet_number, r.pages?.title, r.pages?.page_number]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <Input
        aria-label="Filter working set pages"
        placeholder="Filter sheets…"
        className="h-8"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading pages…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No pages in this set. Select pages on the Pages tab and add them here.
        </p>
      ) : (
        <ol className="space-y-1">
          {visible.map((row) => {
            const index = rows.findIndex((r) => r.id === row.id);
            return (
              <li
                key={row.id}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left text-navy hover:underline"
                  onClick={() => onOpenPage?.(row.page_id)}
                >
                  {row.pages?.sheet_number ?? `Page ${row.pages?.page_number ?? "?"}`}
                  <span className="ml-2 text-muted-foreground">{row.pages?.title ?? ""}</span>
                </button>
                {canEdit ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label="Move page up"
                      onClick={() => reorder.mutate({ index, direction: -1 })}
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label="Move page down"
                      onClick={() => reorder.mutate({ index, direction: 1 })}
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label="Remove page from set"
                      onClick={() => removePage.mutate(row.id)}
                    >
                      <X className="size-3" />
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
