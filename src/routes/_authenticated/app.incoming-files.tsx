import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, Download, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { ProjectPicker } from "@/components/app/ProjectScope";
import { useScopeProjects } from "@/components/app/ProjectScope.hooks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/utils";
import {
  assignIncomingToProject,
  getIncomingFileUrl,
  listIncomingFiles,
  retryIncomingFile,
  setIncomingArchived,
  type IncomingRow,
} from "@/lib/incoming/incoming.functions";

export const Route = createFileRoute("/_authenticated/app/incoming-files")({
  component: IncomingFilesPage,
});

const SOURCE_LABELS: Record<string, string> = {
  upload: "Direct upload",
  archive: "ZIP archive",
  dropbox: "Dropbox",
  google_drive: "Google Drive",
  quote_request: "Quote request",
};

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

function IncomingFilesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listIncomingFiles);
  const openUrl = useServerFn(getIncomingFileUrl);
  const archiveFn = useServerFn(setIncomingArchived);
  const retryFn = useServerFn(retryIncomingFile);
  const assignFn = useServerFn(assignIncomingToProject);

  const { data: projects = [] } = useScopeProjects();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["incoming-files"],
    queryFn: () => list({}),
    refetchInterval: 20000,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.archived !== showArchived) return false;
      if (source !== "all" && row.source !== source) return false;
      if (status !== "all" && !row.status.toLowerCase().includes(status)) return false;
      if (projectFilter === "unassigned" && row.projectId) return false;
      if (
        projectFilter !== "all" &&
        projectFilter !== "unassigned" &&
        row.projectId !== projectFilter
      )
        return false;
      if (!term) return true;
      return [row.fileName, row.projectName, row.companyName, row.contactName, row.uploadedBy]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, search, source, status, projectFilter, showArchived]);

  const counts = useMemo(() => {
    const live = rows.filter((r) => !r.archived);
    const pending = live.filter((r) =>
      ["queued", "uploaded", "processing", "extracting", "generating", "awaiting"].some((s) =>
        r.status.toLowerCase().includes(s),
      ),
    ).length;
    const ready = live.filter((r) =>
      ["ready", "converted"].some((s) => r.status.toLowerCase().includes(s)),
    ).length;
    const failed = live.filter((r) =>
      ["failed", "rejected", "error", "quarantine"].some((s) => r.status.toLowerCase().includes(s)),
    ).length;
    const duplicates = live.filter((r) => r.duplicate).length;
    return { pending, ready, failed, duplicates };
  }, [rows]);

  const selectedRows = filtered.filter((r) => selected.includes(r.id));
  const selectedIntake = selectedRows.filter((r) => r.kind === "intake").map((r) => r.id);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["incoming-files"] });
    setSelected([]);
  };

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      const intake = selectedRows.filter((r) => r.kind === "intake").map((r) => r.id);
      const quote = selectedRows.filter((r) => r.kind === "quote").map((r) => r.id);
      if (intake.length) await archiveFn({ data: { ids: intake, kind: "intake", archived } });
      if (quote.length) await archiveFn({ data: { ids: quote, kind: "quote", archived } });
    },
    onSuccess: (_d, archived) => {
      toast.success(archived ? "Files archived." : "Files restored.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryFn({ data: { ids: selectedIntake } }),
    onSuccess: (res) => {
      toast.success(
        `${res.requeued} file(s) re-queued. Open the project to let page extraction resume.`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: (projectId: string) => assignFn({ data: { ids: selectedIntake, projectId } }),
    onSuccess: (res) => {
      toast.success(`Moved ${res.moved} file(s) to ${res.projectName}.`);
      setAssignTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = async (row: IncomingRow, download: boolean) => {
    try {
      const res = await openUrl({ data: { id: row.id, kind: row.kind, download } });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open that file.");
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <AppShell
      title="Incoming Files"
      subtitle="Every document that has reached AWM — internal uploads, cloud imports, archive members and prospect quote requests."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />{" "}
            Refresh
          </Button>
          <Button
            className="border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
            onClick={() => navigate({ to: "/app/projects" })}
          >
            Upload Files
          </Button>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="In progress"
          value={counts.pending}
          hint="Uploading, extracting or awaiting review"
        />
        <StatCard label="Ready" value={counts.ready} hint="Processed into a project" />
        <StatCard
          label="Needs attention"
          value={counts.failed}
          hint="Failed, rejected or quarantined"
        />
        <StatCard
          label="Duplicates"
          value={counts.duplicates}
          hint="Matched an existing checksum"
        />
      </div>

      <div className="surface-panel mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          placeholder="Search file, project or sender…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[16rem]"
        />
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[11rem]" aria-label="Source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[11rem]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="duplicate">Duplicate</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="awaiting">Awaiting review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[14rem]" aria-label="Project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(Boolean(v))} />
          Show archived
        </label>
      </div>

      {selected.length > 0 ? (
        <div className="surface-panel mb-4 flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium text-navy">{selected.length} selected</span>
          {selectedIntake.length > 0 ? (
            <>
              <ProjectPicker
                projects={projects}
                value={assignTarget}
                onChange={(id) => {
                  setAssignTarget(id);
                  assignMutation.mutate(id);
                }}
                className="w-[15rem]"
              />
              <Button
                variant="outline"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="mr-2 size-4" /> Re-queue processing
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            onClick={() => archiveMutation.mutate(!showArchived)}
            disabled={archiveMutation.isPending}
          >
            <Archive className="mr-2 size-4" /> {showArchived ? "Restore" : "Archive"}
          </Button>
        </div>
      ) : null}

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[68rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left">
              {[
                "",
                "Source",
                "File name",
                "Received",
                "Size",
                "Pages",
                "Project",
                "From",
                "Status",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Loading incoming files…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  {rows.length === 0
                    ? "No documents have been received yet. Upload a plan set from a project to see it here."
                    : "No files match these filters."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.includes(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                      aria-label={`Select ${row.fileName}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-navy underline-offset-2 hover:underline"
                      onClick={() => open(row, false)}
                    >
                      {row.fileName}
                    </button>
                    {row.errorMessage ? (
                      <p className="mt-1 text-xs text-destructive">{row.errorMessage}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{relative(row.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.sizeBytes ? formatBytes(Number(row.sizeBytes)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.pageCount ? `${row.pagesProcessed ?? 0}/${row.pageCount}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.projectId ? (
                      <Link
                        to="/app/projects/$projectId"
                        params={{ projectId: row.projectId }}
                        className="text-primary hover:underline"
                      >
                        {row.projectName ?? "Project"}
                      </Link>
                    ) : row.submissionId ? (
                      <Link to="/app/quote-requests" className="text-primary hover:underline">
                        Quote request
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.companyName ?? row.contactName ?? row.uploadedBy ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={row.duplicate ? "Duplicate" : row.status.replace(/_/g, " ")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Download"
                        onClick={() => open(row, true)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {row.projectId ? (
                        <Button size="icon" variant="ghost" asChild aria-label="Open project">
                          <Link to="/app/projects/$projectId" params={{ projectId: row.projectId }}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
