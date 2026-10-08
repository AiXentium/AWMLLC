import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  FileArchive,
  FileText,
  Folder,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  browseDropbox,
  importDropboxFile,
  previewDropboxFiles,
} from "@/lib/dropbox/dropbox.functions";
import { isImportableCloudFile, type CloudFile } from "@/lib/cloud/shared";
import { useDropboxStatus } from "@/lib/dropbox/useDropbox";
import { DropboxConnectCard } from "./DropboxConnectCard";
import { formatBytes } from "@/lib/utils";

type ImportState = {
  path: string;
  name: string;
  status: "queued" | "importing" | "done" | "duplicate" | "unchanged" | "failed" | "cancelled";
  message: string;
};

/**
 * Browse the connected Dropbox account, preview metadata and revisions, then
 * copy the selected plan sets into private project storage and run the normal
 * intake + pre-analysis pipeline.
 */
export function DropboxImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: status } = useDropboxStatus();
  const connected = status?.connected === true;

  const [trail, setTrail] = useState<{ path: string | null; name: string }[]>([
    { path: null, name: "Dropbox" },
  ]);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [selected, setSelected] = useState<Record<string, CloudFile>>({});
  const [imports, setImports] = useState<ImportState[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useState(() => ({ cancelled: false }))[0];

  const folder = trail[trail.length - 1];

  const { data, isFetching } = useQuery({
    queryKey: ["dropbox-browse", folder.path, applied, connected],
    enabled: open && connected,
    queryFn: () => browseDropbox({ data: { path: folder.path, search: applied || null } }),
  });

  const paths = Object.keys(selected);
  const { data: previews = [] } = useQuery({
    queryKey: ["dropbox-preview", projectId, paths.sort().join(",")],
    enabled: open && connected && paths.length > 0,
    queryFn: () => previewDropboxFiles({ data: { projectId, paths: paths.slice(0, 25) } }),
  });

  const revisions = useMemo(() => previews.filter((p) => p.isRevision), [previews]);
  const oversized = useMemo(() => previews.filter((p) => p.tooLarge), [previews]);

  const runImport = useCallback(
    async (files: CloudFile[], allowDuplicate: boolean) => {
      if (!files.length) return;
      cancelRef.cancelled = false;
      setRunning(true);
      setImports(
        files.map((f) => ({ path: f.id, name: f.name, status: "queued", message: "Waiting…" })),
      );

      const jobId = crypto.randomUUID();
      await supabase
        .from("intake_jobs")
        .insert({ id: jobId, project_id: projectId, status: "running", total_files: files.length });

      for (const file of files) {
        if (cancelRef.cancelled) {
          setImports((prev) =>
            prev.map((i) =>
              i.status === "queued" ? { ...i, status: "cancelled", message: "Cancelled" } : i,
            ),
          );
          break;
        }
        setImports((prev) =>
          prev.map((i) =>
            i.path === file.id
              ? { ...i, status: "importing", message: "Copying from Dropbox…" }
              : i,
          ),
        );
        try {
          const result = await importDropboxFile({
            data: { projectId, jobId, path: file.id, allowDuplicate },
          });
          setImports((prev) =>
            prev.map((i) => {
              if (i.path !== file.id) return i;
              if (!result.ok) return { ...i, status: "failed", message: result.reason };
              if (result.kind === "zip") {
                return {
                  ...i,
                  status: "done",
                  message: `${result.accepted} PDF${result.accepted === 1 ? "" : "s"} imported · ${result.duplicates} duplicate · ${result.ignored} ignored`,
                };
              }
              if (result.outcome === "duplicate") {
                return {
                  ...i,
                  status: "duplicate",
                  message: `Already in this project as “${result.existingName}”`,
                };
              }
              if (result.outcome === "unchanged") {
                return {
                  ...i,
                  status: "unchanged",
                  message: "Unchanged in Dropbox since the last import — nothing to do.",
                };
              }
              if (result.outcome === "revision") {
                return {
                  ...i,
                  status: "done",
                  message: `Imported as revision ${result.revisionNumber} — the previous version is kept.`,
                };
              }
              return { ...i, status: "done", message: "Imported — extracting sheets" };
            }),
          );
        } catch (err) {
          setImports((prev) =>
            prev.map((i) =>
              i.path === file.id
                ? {
                    ...i,
                    status: "failed",
                    message: err instanceof Error ? err.message : "Import failed",
                  }
                : i,
            ),
          );
        }
      }

      await supabase.from("intake_jobs").update({ status: "completed" }).eq("id", jobId);
      await qc.invalidateQueries({ queryKey: ["documents", projectId] });
      await qc.invalidateQueries({ queryKey: ["intake", projectId] });
      await qc.invalidateQueries({ queryKey: ["dropbox-project", projectId] });
      setRunning(false);
      toast.success("Dropbox import finished", {
        description: "Imported files run through the normal intake and analysis pipeline.",
      });
    },
    [cancelRef, projectId, qc],
  );

  const entries = data?.files ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => (running ? null : onOpenChange(next))}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-navy">Import from Dropbox</DialogTitle>
          <DialogDescription>
            Selected files are copied into this project's private storage, then checksummed,
            de-duplicated and analysed exactly like an uploaded plan set.
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <DropboxConnectCard />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {trail.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => setTrail((t) => t.slice(0, -1))}>
                  <ArrowLeft className="mr-1 size-4" /> Back
                </Button>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {trail.map((t) => t.name).join(" / ")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  className="h-9 w-52"
                  placeholder="Search Dropbox…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setApplied(search)}
                />
                <Button size="sm" variant="outline" onClick={() => setApplied(search)}>
                  <Search className="size-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {isFetching ? (
                <p className="p-4 text-sm text-muted-foreground">Loading Dropbox…</p>
              ) : entries.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nothing here. Try searching by file name.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((file) => {
                    const importable = isImportableCloudFile(file);
                    const Icon = file.isFolder
                      ? Folder
                      : /\.zip$/i.test(file.name)
                        ? FileArchive
                        : FileText;
                    return (
                      <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {file.isFolder ? (
                          <span className="w-4" />
                        ) : (
                          <Checkbox
                            checked={!!selected[file.id]}
                            disabled={!importable}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => {
                                const next = { ...prev };
                                if (checked) next[file.id] = file;
                                else delete next[file.id];
                                return next;
                              })
                            }
                            aria-label={`Select ${file.name}`}
                          />
                        )}
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {file.isFolder ? (
                          <button
                            type="button"
                            className="truncate text-left font-medium text-navy hover:underline"
                            onClick={() =>
                              setTrail((t) => [...t, { path: file.id, name: file.name }])
                            }
                          >
                            {file.name}
                          </button>
                        ) : (
                          <span
                            className={`truncate ${importable ? "text-navy" : "text-muted-foreground"}`}
                          >
                            {file.name}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {file.sizeBytes ? formatBytes(file.sizeBytes) : ""}
                          {file.modifiedTime
                            ? ` · ${new Date(file.modifiedTime).toLocaleDateString()}`
                            : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {previews.length ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
                <p className="font-medium text-navy">{previews.length} file(s) selected</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {previews.map((p) => (
                    <li key={p.file.id}>
                      {p.file.name} ·{" "}
                      {p.file.sizeBytes ? formatBytes(p.file.sizeBytes) : "size unknown"} ·{" "}
                      {p.file.folderName ?? "Dropbox"}
                      {p.isRevision ? (
                        <span className="ml-1 text-navy">
                          · revised — imports as revision {p.nextRevision}
                        </span>
                      ) : p.alreadyImported ? (
                        <span className="ml-1 text-amber-700">· already imported</span>
                      ) : null}
                      {p.tooLarge ? (
                        <span className="ml-1 text-destructive">· too large</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {revisions.length ? (
                  <p className="mt-2 flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="size-3.5" /> {revisions.length} of these changed in
                    Dropbox. They are imported as new revisions — earlier plan sets and confirmed
                    takeoff facts stay intact.
                  </p>
                ) : null}
                {oversized.length ? (
                  <p className="mt-1 text-destructive">
                    Files over the cloud import limit are skipped — download and use the resumable
                    upload instead.
                  </p>
                ) : null}
              </div>
            ) : null}

            {imports.length ? (
              <ul className="space-y-2">
                {imports.map((item) => (
                  <li key={item.path} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-navy">{item.name}</span>
                      {item.status === "importing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {item.status === "done" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : null}
                      {item.status === "failed" || item.status === "unchanged" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const file = selected[item.path];
                            if (file) void runImport([file], true);
                          }}
                        >
                          <RotateCcw className="mr-1 size-3.5" />
                          {item.status === "unchanged" ? "Import anyway" : "Retry"}
                        </Button>
                      ) : null}
                    </div>
                    <p
                      className={`mt-1 text-xs ${item.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {item.message}
                    </p>
                  </li>
                ))}
                {running ? <Progress value={undefined} className="mt-1" /> : null}
              </ul>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              {running ? (
                <Button variant="outline" onClick={() => (cancelRef.cancelled = true)}>
                  <X className="mr-2 size-4" /> Cancel remaining
                </Button>
              ) : null}
              <Button
                onClick={() =>
                  void runImport(
                    previews.filter((p) => !p.tooLarge).map((p) => p.file),
                    false,
                  )
                }
                disabled={running || !previews.length || previews.every((p) => p.tooLarge)}
              >
                {running ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Cloud className="mr-2 size-4" />
                )}
                Import {previews.filter((p) => !p.tooLarge).length || ""} file(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog pair usable next to any upload entry point. */
export function DropboxImportButton({
  projectId,
  variant = "outline",
  size = "default",
  label = "Import from Dropbox",
}: {
  projectId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Cloud className="mr-2 size-4" aria-hidden="true" /> {label}
      </Button>
      <DropboxImportDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}
