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
import { browseDrive, importDriveFile, previewDriveFiles } from "@/lib/google/drive.functions";
import {
  DRIVE_FOLDER_MIME,
  isImportableDriveFile,
  type DriveFile,
} from "@/lib/google/drive-shared";
import { useDriveStatus } from "@/lib/google/useGoogleDrive";
import { GoogleDriveConnectCard } from "./GoogleDriveConnectCard";
import { formatBytes } from "@/lib/utils";

type ImportState = {
  fileId: string;
  name: string;
  status: "queued" | "importing" | "done" | "duplicate" | "failed" | "cancelled";
  message: string;
};

/**
 * Browse the connected user's Drive, preview metadata, then copy the selected
 * plan sets into private project storage and run the normal intake pipeline.
 */
export function DriveImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: status } = useDriveStatus();
  const connected = status?.connected === true;

  const [trail, setTrail] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Drive" },
  ]);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [selected, setSelected] = useState<Record<string, DriveFile>>({});
  const [imports, setImports] = useState<ImportState[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useState(() => ({ cancelled: false }))[0];

  const folder = trail[trail.length - 1];

  const { data, isFetching } = useQuery({
    queryKey: ["drive-browse", folder.id, applied, connected],
    enabled: open && connected,
    queryFn: () => browseDrive({ data: { folderId: folder.id, search: applied || null } }),
  });

  const ids = Object.keys(selected);
  const { data: previews = [] } = useQuery({
    queryKey: ["drive-preview", projectId, ids.sort().join(",")],
    enabled: open && connected && ids.length > 0,
    queryFn: () => previewDriveFiles({ data: { projectId, fileIds: ids.slice(0, 25) } }),
  });

  const duplicateWarnings = useMemo(() => previews.filter((p) => p.alreadyImported), [previews]);
  const oversized = useMemo(() => previews.filter((p) => p.tooLarge), [previews]);

  const runImport = useCallback(
    async (files: DriveFile[], allowDuplicate: boolean) => {
      if (!files.length) return;
      cancelRef.cancelled = false;
      setRunning(true);
      setImports(
        files.map((f) => ({ fileId: f.id, name: f.name, status: "queued", message: "Waiting…" })),
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
            i.fileId === file.id
              ? { ...i, status: "importing", message: "Copying from Google Drive…" }
              : i,
          ),
        );
        try {
          const result = await importDriveFile({
            data: { projectId, jobId, fileId: file.id, allowDuplicate },
          });
          setImports((prev) =>
            prev.map((i) => {
              if (i.fileId !== file.id) return i;
              if (!result.ok) return { ...i, status: "failed", message: result.reason };
              if (result.kind === "zip") {
                return {
                  ...i,
                  status: "done",
                  message: `${result.accepted} PDF${result.accepted === 1 ? "" : "s"} imported · ${result.duplicates} duplicate · ${result.ignored} ignored`,
                };
              }
              if (result.duplicate) {
                return {
                  ...i,
                  status: "duplicate",
                  message: `Already in this project as “${result.existingName}”`,
                };
              }
              return { ...i, status: "done", message: "Imported — extracting sheets" };
            }),
          );
        } catch (err) {
          setImports((prev) =>
            prev.map((i) =>
              i.fileId === file.id
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
      await qc.invalidateQueries({ queryKey: ["drive-sources", projectId] });
      setRunning(false);
      toast.success("Google Drive import finished", {
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
          <DialogTitle className="font-serif text-navy">Import from Google Drive</DialogTitle>
          <DialogDescription>
            Selected files are copied into this project's private storage, then checksummed,
            de-duplicated and analysed exactly like an uploaded plan set.
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <GoogleDriveConnectCard />
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
                  placeholder="Search Drive…"
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
                <p className="p-4 text-sm text-muted-foreground">Loading Drive…</p>
              ) : entries.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nothing here. Try searching by file name.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((file) => {
                    const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
                    const importable = isImportableDriveFile(file);
                    const Icon = isFolder
                      ? Folder
                      : /zip/i.test(file.mimeType)
                        ? FileArchive
                        : FileText;
                    return (
                      <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {isFolder ? (
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
                        {isFolder ? (
                          <button
                            type="button"
                            className="truncate text-left font-medium text-navy hover:underline"
                            onClick={() =>
                              setTrail((t) => [...t, { id: file.id, name: file.name }])
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
                      {p.file.folderName ?? "My Drive"}
                      {p.file.webViewLink ? (
                        <a
                          className="ml-1 underline"
                          href={p.file.webViewLink}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          source
                        </a>
                      ) : null}
                      {p.alreadyImported ? (
                        <span className="ml-1 text-amber-700">· already imported</span>
                      ) : null}
                      {p.tooLarge ? (
                        <span className="ml-1 text-destructive">· too large</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {duplicateWarnings.length ? (
                  <p className="mt-2 flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="size-3.5" /> {duplicateWarnings.length} of these were
                    imported from Drive before. Importing again creates a new copy only if the
                    contents changed.
                  </p>
                ) : null}
                {oversized.length ? (
                  <p className="mt-1 text-destructive">
                    Files over the Drive import limit are skipped — download and use the resumable
                    upload instead.
                  </p>
                ) : null}
              </div>
            ) : null}

            {imports.length ? (
              <ul className="space-y-2">
                {imports.map((item) => (
                  <li
                    key={item.fileId}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-navy">{item.name}</span>
                      {item.status === "importing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {item.status === "done" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : null}
                      {item.status === "failed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const file = selected[item.fileId];
                            if (file) void runImport([file], true);
                          }}
                        >
                          <RotateCcw className="mr-1 size-3.5" /> Retry
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
export function DriveImportButton({
  projectId,
  variant = "outline",
  size = "default",
  label = "Import from Google Drive",
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
      <DriveImportDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}
