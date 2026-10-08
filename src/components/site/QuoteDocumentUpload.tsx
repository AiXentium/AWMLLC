import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { checksumFile } from "@/lib/intake/checksum";
import { createQuoteUploadUrl } from "@/lib/quote-request.functions";
import {
  QUOTE_ACCEPT_ATTRIBUTE,
  QUOTE_MAX_FILES,
  quoteFileKind,
  validateQuoteFile,
  type QuoteFileKind,
} from "@/lib/quote-uploads.shared";

export type UploadedQuoteDocument = {
  path: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
  checksum: string | null;
};

type Item = {
  key: string;
  file: File;
  kind: QuoteFileKind | null;
  status: "queued" | "hashing" | "uploading" | "done" | "failed" | "duplicate";
  progress: number;
  message: string;
  uploaded?: UploadedQuoteDocument;
};

const ICONS: Record<QuoteFileKind, typeof FileText> = {
  pdf: FileText,
  zip: FileArchive,
  image: FileImage,
  document: FileText,
};

function putSignedUrl(signedUrl: string, file: File, onProgress: (fraction: number) => void) {
  const absolute = signedUrl.startsWith("http")
    ? signedUrl
    : `${import.meta.env.VITE_SUPABASE_URL}${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", absolute, true);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.send(file);
  });
}

/**
 * Prospect-facing document intake. Mirrors the internal project uploader —
 * checksum fingerprinting, duplicate detection, per-file progress and retry —
 * but writes through short-lived signed URLs so nothing public touches storage
 * credentials or can browse the bucket.
 */
export function QuoteDocumentUpload({
  draftToken,
  onChange,
  disabled,
}: {
  draftToken: string;
  onChange: (documents: UploadedQuoteDocument[]) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seen = useRef(new Map<string, string>());

  const publish = useCallback(
    (next: Item[]) => {
      onChange(next.flatMap((item) => (item.uploaded ? [item.uploaded] : [])));
    },
    [onChange],
  );

  const patch = useCallback(
    (key: string, next: Partial<Item>) => {
      setItems((prev) => {
        const updated = prev.map((item) => (item.key === key ? { ...item, ...next } : item));
        publish(updated);
        return updated;
      });
    },
    [publish],
  );

  const run = useCallback(
    async (item: Item) => {
      try {
        patch(item.key, { status: "hashing", message: "Fingerprinting…", progress: 4 });
        const checksum = await checksumFile(item.file, (f) =>
          patch(item.key, { progress: Math.round(f * 15) }),
        );

        const existing = seen.current.get(checksum);
        if (existing && existing !== item.key) {
          patch(item.key, {
            status: "duplicate",
            progress: 100,
            message: "Duplicate of a file already added",
            uploaded: undefined,
          });
          return;
        }
        seen.current.set(checksum, item.key);

        patch(item.key, { status: "uploading", message: "Uploading…" });
        const approval = await createQuoteUploadUrl({
          data: { draftToken, fileName: item.file.name, sizeBytes: item.file.size },
        });
        if (!approval.ok) throw new Error(approval.reason);

        await putSignedUrl(approval.signedUrl, item.file, (f) =>
          patch(item.key, { progress: 15 + Math.round(f * 84) }),
        );

        patch(item.key, {
          status: "done",
          progress: 100,
          message: "Uploaded",
          uploaded: {
            path: approval.path,
            fileName: approval.fileName,
            sizeBytes: item.file.size,
            mimeType: item.file.type || null,
            checksum,
          },
        });
      } catch (error) {
        patch(item.key, {
          status: "failed",
          progress: 100,
          message: error instanceof Error ? error.message : "Upload failed",
          uploaded: undefined,
        });
      }
    },
    [draftToken, patch],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (disabled || !files.length) return;
      setNotice(null);
      const accepted: Item[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        const problem = validateQuoteFile(file.name, file.size);
        if (problem) {
          rejected.push(`${file.name}: ${problem}`);
          continue;
        }
        accepted.push({
          key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          kind: quoteFileKind(file.name),
          status: "queued",
          progress: 0,
          message: "Queued",
        });
      }

      setItems((prev) => {
        const room = Math.max(0, QUOTE_MAX_FILES - prev.length);
        const allowed = accepted.slice(0, room);
        if (accepted.length > room) {
          rejected.push(`Only ${QUOTE_MAX_FILES} files can be attached to one request.`);
        }
        allowed.forEach((item) => void run(item));
        return [...prev, ...allowed];
      });

      if (rejected.length) setNotice(rejected.join(" · "));
    },
    [disabled, run],
  );

  const remove = useCallback(
    (key: string) => {
      setItems((prev) => {
        const next = prev.filter((item) => item.key !== key);
        publish(next);
        return next;
      });
    },
    [publish],
  );

  const summary = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const bytes = items
      .filter((i) => i.status === "done")
      .reduce((total, i) => total + i.file.size, 0);
    return { done, bytes };
  }, [items]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg text-navy">Project Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach plan sets, schedules, or photos. PDF, ZIP, image, and document files up to 500 MB
          each — the same secure intake our estimators use.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-bronze bg-bronze/5" : "border-border bg-muted/30"
        }`}
      >
        <Upload className="mx-auto size-8 text-navy" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-navy">Drag and drop files here</p>
        <p className="mt-1 text-sm text-muted-foreground">or</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Select files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={QUOTE_ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {notice ? (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      ) : null}

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = ICONS[item.kind ?? "document"];
            return (
              <li
                key={item.key}
                className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-navy" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-navy">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(item.file.size)} · {(item.kind ?? "document").toUpperCase()}
                    </span>
                  </div>
                  {item.status === "done" ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-bronze">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" /> Uploaded
                    </p>
                  ) : item.status === "failed" || item.status === "duplicate" ? (
                    <p className="mt-1 text-xs text-destructive">{item.message}</p>
                  ) : (
                    <>
                      <Progress value={item.progress} className="mt-2 h-1.5" />
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        {item.message}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "failed" ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Retry ${item.file.name}`}
                      onClick={() => void run(item)}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => remove(item.key)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary.done ? (
        <p className="text-xs text-muted-foreground">
          {summary.done} file{summary.done === 1 ? "" : "s"} attached · {formatBytes(summary.bytes)}
        </p>
      ) : null}
    </div>
  );
}
