import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid2x2, List, Search } from "lucide-react";
import { UploadEmptyState } from "@/components/app/project/upload/ProjectUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { usePages, useThumbnails } from "./usePages";

export function PagesTab({
  projectId,
  canEdit,
  onOpenPage,
}: {
  projectId: string;
  canEdit: boolean;
  onOpenPage: (pageId: string) => void;
}) {
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = usePages(projectId);
  const thumbs = useThumbnails(pages);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetSet, setTargetSet] = useState<string>("");

  const { data: workingSets = [] } = useQuery({
    queryKey: ["working-sets", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("working_sets")
        .select("id,name,category")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      if (!q) return true;
      return [p.sheet_number, p.title, p.discipline, p.building, p.floor, String(p.page_number)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [pages, query, stateFilter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const bulkUpdate = useMutation({
    mutationFn: async (patch: { state: string }) => {
      const ids = [...selected];
      if (!ids.length) throw new Error("Select at least one page.");
      const { error } = await supabase.from("pages").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", projectId] }),
  });

  const addToSet = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      if (!targetSet) throw new Error("Choose a working set.");
      if (!ids.length) throw new Error("Select at least one page.");
      const rows = ids.map((pageId, index) => ({
        working_set_id: targetSet,
        page_id: pageId,
        sort_order: index,
      }));
      const { error } = await supabase.from("working_set_pages").upsert(rows, {
        onConflict: "working_set_id,page_id",
        ignoreDuplicates: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["working-set-pages", projectId] });
    },
  });

  const errorMessage =
    (bulkUpdate.error as Error | null)?.message ?? (addToSet.error as Error | null)?.message;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[15rem] flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search pages"
            className="pl-9"
            placeholder="Search sheet number, title, discipline…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["all", "selected", "hidden", "archived", "unclassified", "processing"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="icon"
            aria-label="Thumbnail view"
            onClick={() => setView("grid")}
          >
            <Grid2x2 className="size-4" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="icon"
            aria-label="List view"
            onClick={() => setView("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
        <span className="text-muted-foreground">{selected.size} selected</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelected(new Set(visible.map((p) => p.id)))}
        >
          Select all filtered
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
          Unselect
        </Button>
        {canEdit ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdate.mutate({ state: "selected" })}
            >
              Mark selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdate.mutate({ state: "hidden" })}
            >
              Hide
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdate.mutate({ state: "archived" })}
            >
              Archive
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Select value={targetSet} onValueChange={setTargetSet}>
                <SelectTrigger className="h-9 w-56">
                  <SelectValue placeholder="Add to working set…" />
                </SelectTrigger>
                <SelectContent>
                  {workingSets.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => addToSet.mutate()} disabled={addToSet.isPending}>
                Add
              </Button>
            </div>
          </>
        ) : null}
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pages…</p>
      ) : visible.length === 0 ? (
        <UploadEmptyState
          title="No pages yet"
          description="Upload a PDF plan set or a ZIP archive — sheets appear here as they finish processing."
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {visible.map((page) => (
            <li key={page.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative">
                {page.thumbnail_path && thumbs.get(page.thumbnail_path) ? (
                  <img
                    src={thumbs.get(page.thumbnail_path)}
                    alt={`Page ${page.page_number} thumbnail`}
                    className="h-44 w-full bg-white object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-secondary text-xs text-muted-foreground">
                    {page.processing_error ? "Render failed" : "No thumbnail"}
                  </div>
                )}
                <div className="absolute left-2 top-2 rounded bg-card/90 p-1">
                  <Checkbox
                    checked={selected.has(page.id)}
                    onCheckedChange={() => toggle(page.id)}
                    aria-label={`Select page ${page.page_number}`}
                  />
                </div>
              </div>
              <div className="space-y-1 p-3">
                <p className="text-sm font-medium text-navy">
                  {page.sheet_number ?? `Page ${page.page_number}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {page.title ?? "Unclassified"}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className="text-[0.65rem]">
                    {page.state}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => onOpenPage(page.id)}>
                    Open
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-navy">
                  Sheet
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-navy">
                  Title
                </th>
                <th scope="col" className="hidden px-3 py-3 font-medium text-navy md:table-cell">
                  Discipline
                </th>
                <th scope="col" className="hidden px-3 py-3 font-medium text-navy md:table-cell">
                  Building / Floor
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-navy">
                  State
                </th>
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((page) => (
                <tr key={page.id} className="hover:bg-secondary/40">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.has(page.id)}
                      onCheckedChange={() => toggle(page.id)}
                      aria-label={`Select page ${page.page_number}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-navy">
                    {page.sheet_number ?? page.page_number}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{page.title ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                    {page.discipline ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                    {[page.building, page.floor].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{page.state}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onOpenPage(page.id)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
