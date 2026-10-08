import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileArchive, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIntakeQueue, type QueueItem } from "@/lib/intake/useIntakeQueue";
import { useIntakeProcessor } from "@/lib/intake/processor";
import { getIntakeLimits } from "@/lib/intake/intake.functions";
import { FALLBACK_LIMITS } from "@/lib/intake/shared";
import { DriveImportButton } from "@/components/app/google/DriveImportDialog";
import { DropboxImportButton } from "@/components/app/dropbox/DropboxImportDialog";
import { takePendingBlueprintFile } from "@/lib/import-blueprint/pendingFile";
import { formatBytes } from "@/lib/utils";
import { UploadContext, useProjectUpload, type UploadContextValue } from "./useProjectUpload";

export function ProjectUploadProvider({
  projectId,
  canEdit,
  children,
  defaultOpen = false,
}: {
  projectId: string;
  canEdit: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const queue = useIntakeQueue(projectId);
  const { state: processing } = useIntakeProcessor(projectId, canEdit);
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);

  // Role resolves asynchronously, so honour ?upload=1 once editing is allowed.
  useEffect(() => {
    if (defaultOpen && canEdit && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [defaultOpen, canEdit]);

  // Import Blueprint flow: a PDF handed off from the project-creation dialog
  // is enqueued automatically once the workspace (and its intake queue) mounts.
  const blueprintEnqueued = useRef(false);
  useEffect(() => {
    if (!canEdit || blueprintEnqueued.current) return;
    const pending = takePendingBlueprintFile();
    if (pending) {
      blueprintEnqueued.current = true;
      setOpen(true);
      void queue.enqueue([pending]);
    }
  }, [canEdit, queue]);

  const { data: limits = FALLBACK_LIMITS } = useQuery({
    queryKey: ["intake-limits"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => getIntakeLimits(),
  });

  const openUpload = useCallback(() => setOpen(true), []);

  const value = useMemo<UploadContextValue>(
    () => ({ projectId, canEdit, processing, limits, openUpload, ...queue }),
    [projectId, canEdit, processing, limits, openUpload, queue],
  );

  return (
    <UploadContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-navy">Upload documents</DialogTitle>
            <DialogDescription>
              Files upload straight into this project and run through the same intake engine as the
              Plans tab.
            </DialogDescription>
          </DialogHeader>
          <UploadDropzone compact />
          <UploadQueue />
          <ProcessingBanner />
        </DialogContent>
      </Dialog>
    </UploadContext.Provider>
  );
}

/** Human-readable accepted formats + server-configured maximums. */
export function UploadLimitsText() {
  const { limits } = useProjectUpload();
  return (
    <>
      PDF and ZIP · PDF up to {formatBytes(limits.maxPdfBytes)} each (resumable) · ZIP up to{" "}
      {formatBytes(limits.maxZipBytes)}. Multiple files at once. Files stay private to this project.
    </>
  );
}

/** The one drag-and-drop + file picker surface used by every entry point. */
export function UploadDropzone({ compact = false }: { compact?: boolean }) {
  const { canEdit, enqueue, clearFinished, items, busy, projectId } = useProjectUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (!canEdit) {
    return (
      <p className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        Your role has read-only access to documents.
      </p>
    );
  }

  function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length) void enqueue(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed text-center transition-colors ${
        compact ? "p-6" : "p-6 sm:p-10"
      } ${dragging ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      <Upload className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-medium text-navy">Drop plan files or a ZIP of the full set</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        <UploadLimitsText />
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf,application/zip,.zip"
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => inputRef.current?.click()}>Upload Plans or ZIP</Button>
        <DriveImportButton projectId={projectId} />
        <DropboxImportButton projectId={projectId} />
        {items.length ? (
          <Button variant="outline" onClick={clearFinished} disabled={busy}>
            Clear finished
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Button that opens the shared upload dialog — for headers and empty states. */
export function UploadButton({
  label = "Upload Documents",
  size = "sm",
  variant = "default",
  className,
}: {
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const { canEdit, openUpload } = useProjectUpload();
  if (!canEdit) return null;
  return (
    <Button size={size} variant={variant} className={className} onClick={openUpload}>
      <Upload className="mr-2 size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Shared empty state for Pages, Working Sets, Viewer and Takeoff. */
export function UploadEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 font-medium text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex justify-center">
        <UploadButton />
      </div>
    </div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const { cancelItem, retryItem } = useProjectUpload();
  const active = ["queued", "hashing", "uploading", "verifying", "extracting"].includes(
    item.status,
  );
  const Icon = item.kind === "zip" ? FileArchive : FileText;
  return (
    <li className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-navy">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{item.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {formatBytes(item.size)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {item.status === "done" ? (
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          ) : null}
          {active ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          {active ? (
            <Button size="sm" variant="ghost" onClick={() => cancelItem(item.key)}>
              <X className="mr-1 size-3.5" /> Cancel
            </Button>
          ) : null}
          {item.status === "failed" || item.status === "cancelled" ? (
            <Button size="sm" variant="outline" onClick={() => retryItem(item.key)}>
              <RotateCcw className="mr-1 size-3.5" /> Retry
            </Button>
          ) : null}
          {item.status === "duplicate" ? (
            <Button size="sm" variant="outline" onClick={() => retryItem(item.key, true)}>
              Upload anyway
            </Button>
          ) : null}
        </span>
      </div>
      {active ? <Progress value={item.progress} className="mt-2" /> : null}
      <p
        className={`mt-1 text-xs ${item.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {item.message}
        {item.summary ? ` · ${item.summary}` : ""}
      </p>
    </li>
  );
}

/** Live per-file queue — rendered wherever the user triggered the upload. */
export function UploadQueue() {
  const { items } = useProjectUpload();
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <QueueRow key={item.key} item={item} />
      ))}
    </ul>
  );
}

/** Background page-extraction progress for the active project. */
export function ProcessingBanner() {
  const { processing } = useProjectUpload();
  if (!processing) return null;
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-4">
      <p className="text-sm font-medium text-navy">
        Extracting sheets from “{processing.name}” — {processing.done} of {processing.total}
      </p>
      <Progress value={(processing.done / Math.max(1, processing.total)) * 100} className="mt-2" />
      <p className="mt-1 text-xs text-muted-foreground">
        Sheets become available as they finish. You can keep working — processing resumes
        automatically after a refresh.
      </p>
    </div>
  );
}
