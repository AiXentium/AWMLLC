import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checksumFile } from "./checksum";
import { uploadToStorage } from "./upload-client";
import {
  approveIntakeUpload,
  cancelIntakeFile,
  extractIntakeArchive,
  finalizeIntakeUpload,
} from "./intake.functions";
import { isPdfName, isZipName, sanitizeFilename } from "./shared";
import { splitPdfIfNeeded, needsSplit } from "./splitPdf";

export type QueueStatus =
  | "queued"
  | "hashing"
  | "uploading"
  | "verifying"
  | "extracting"
  | "done"
  | "duplicate"
  | "failed"
  | "cancelled";

export type QueueItem = {
  key: string;
  file: File;
  name: string;
  size: number;
  kind: "pdf" | "zip" | "other";
  status: QueueStatus;
  progress: number;
  message: string;
  intakeFileId?: string;
  duplicateOf?: string;
  summary?: string;
};

const CONCURRENCY = 2;

/**
 * Drives the browser side of the intake engine: checksum, resumable upload,
 * server-side validation, and (for archives) server-side extraction.
 * Every decision that matters is made by the server functions it calls.
 */
export function useIntakeQueue(projectId: string) {
  const qc = useQueryClient();
  const [items, setItems] = useState<QueueItem[]>([]);
  const aborts = useRef(new Map<string, () => void>());
  const cancelled = useRef(new Set<string>());
  const running = useRef(false);
  const pending = useRef<QueueItem[]>([]);

  const patch = useCallback((key: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }, []);

  const runOne = useCallback(
    async (item: QueueItem, jobId: string, allowDuplicate: boolean) => {
      const signal = { cancelled: false };
      const stop = () => {
        signal.cancelled = true;
        cancelled.current.add(item.key);
      };
      aborts.current.set(item.key, stop);

      try {
        if (item.kind === "other")
          throw new Error("Only PDF plan sets and ZIP archives can be uploaded.");

        const approval = await approveIntakeUpload({
          data: {
            projectId,
            jobId,
            filename: item.name,
            sizeBytes: item.size,
            mimeType: item.file.type || null,
          },
        });
        if (!approval.ok) throw new Error(approval.reason);
        patch(item.key, {
          intakeFileId: approval.intakeFileId,
          status: "hashing",
          message: "Fingerprinting…",
        });

        const checksum = await checksumFile(
          item.file,
          (f) => patch(item.key, { progress: Math.round(f * 12) }),
          signal,
        );
        if (signal.cancelled) throw new Error("Cancelled");

        patch(item.key, { status: "uploading", message: "Uploading…" });
        const handle = uploadToStorage({
          bucket: "plan-files",
          path: approval.storagePath,
          file: item.file,
          contentType: approval.kind === "pdf" ? "application/pdf" : "application/zip",
          onProgress: (f) => patch(item.key, { progress: 12 + Math.round(f * 76) }),
        });
        aborts.current.set(item.key, () => {
          signal.cancelled = true;
          cancelled.current.add(item.key);
          handle.abort();
        });
        await handle.promise;
        if (signal.cancelled) throw new Error("Cancelled");

        patch(item.key, {
          status: "verifying",
          progress: 90,
          message: "Validating on the server…",
        });
        const result = await finalizeIntakeUpload({
          data: { intakeFileId: approval.intakeFileId, checksum, allowDuplicate },
        });
        if (!result.ok) throw new Error(result.reason);

        if (result.kind === "zip") {
          patch(item.key, { status: "extracting", progress: 94, message: "Extracting archive…" });
          const extracted = await extractIntakeArchive({
            data: { intakeFileId: approval.intakeFileId },
          });
          if (!extracted.ok) throw new Error(extracted.reason);
          patch(item.key, {
            status: "done",
            progress: 100,
            message: "Archive processed",
            summary: `${extracted.accepted} PDF${extracted.accepted === 1 ? "" : "s"} imported · ${extracted.duplicates} duplicate · ${extracted.ignored} ignored${extracted.failed ? ` · ${extracted.failed} failed` : ""}`,
          });
        } else if ("duplicate" in result && result.duplicate) {
          patch(item.key, {
            status: "duplicate",
            progress: 100,
            message: `Already uploaded as “${result.existing.name}”`,
            duplicateOf: result.existing.name,
          });
        } else {
          const revision = "revisionCandidate" in result ? result.revisionCandidate : null;
          patch(item.key, {
            status: "done",
            progress: 100,
            message: "Accepted — extracting sheets",
            summary: revision ? `Possible newer revision of “${revision.name}”` : undefined,
          });
        }
      } catch (err) {
        const wasCancelled = cancelled.current.has(item.key);
        const reason = err instanceof Error ? err.message : "Upload failed";
        if (item.intakeFileId || wasCancelled) {
          const id = item.intakeFileId;
          if (id)
            await cancelIntakeFile({ data: { intakeFileId: id, reason } }).catch(() => undefined);
        }
        patch(item.key, {
          status: wasCancelled ? "cancelled" : "failed",
          message: wasCancelled ? "Cancelled" : reason,
        });
      } finally {
        aborts.current.delete(item.key);
        qc.invalidateQueries({ queryKey: ["documents", projectId] });
        qc.invalidateQueries({ queryKey: ["intake", projectId] });
      }
    },
    [patch, projectId, qc],
  );

  const drain = useCallback(
    async (jobId: string) => {
      if (running.current) return;
      running.current = true;
      try {
        while (pending.current.length) {
          const batch = pending.current.splice(0, CONCURRENCY);
          await Promise.all(batch.map((item) => runOne(item, jobId, false)));
        }
      } finally {
        running.current = false;
        qc.invalidateQueries({ queryKey: ["documents", projectId] });
      }
    },
    [projectId, qc, runOne],
  );

  const enqueue = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      // Storage caps single files at 50 MB (Supabase Free). Oversized PDFs are
      // split into sequential parts automatically so the upload just works.
      const expanded: File[] = [];
      const splitNotes: string[] = [];
      for (const file of files) {
        if (needsSplit(file)) {
          const parts = await splitPdfIfNeeded(file);
          if (parts.length > 1) {
            splitNotes.push(
              `${sanitizeFilename(file.name)} was split into ${parts.length} parts for upload`,
            );
          }
          expanded.push(...parts);
        } else {
          expanded.push(file);
        }
      }
      files = expanded;
      if (splitNotes.length) {
        toast.info(splitNotes.join(" · "), {
          description:
            "Large plan sets are split automatically to fit the 50 MB upload limit. Nothing is lost.",
        });
      }

      const jobId = crypto.randomUUID();
      const { error } = await supabase.from("intake_jobs").insert({
        id: jobId,
        project_id: projectId,
        status: "running",
        total_files: files.length,
      });
      if (error) {
        setItems((prev) => [
          ...prev,
          ...files.map((file) => ({
            key: crypto.randomUUID(),
            file,
            name: sanitizeFilename(file.name),
            size: file.size,
            kind: "other" as const,
            status: "failed" as const,
            progress: 0,
            message: error.message,
          })),
        ]);
        return;
      }

      const next: QueueItem[] = files.map((file) => {
        const name = sanitizeFilename(file.name);
        return {
          key: crypto.randomUUID(),
          file,
          name,
          size: file.size,
          kind: isPdfName(name) ? "pdf" : isZipName(name) ? "zip" : "other",
          status: "queued",
          progress: 0,
          message: "Waiting…",
        };
      });
      setItems((prev) => [...prev, ...next]);
      pending.current.push(...next);
      await drain(jobId);
      await supabase.from("intake_jobs").update({ status: "completed" }).eq("id", jobId);
      qc.invalidateQueries({ queryKey: ["intake", projectId] });
    },
    [drain, projectId, qc],
  );

  const cancelItem = useCallback((key: string) => {
    aborts.current.get(key)?.();
    cancelled.current.add(key);
    pending.current = pending.current.filter((item) => item.key !== key);
    setItems((prev) =>
      prev.map((item) =>
        item.key === key && ["queued", "hashing", "uploading"].includes(item.status)
          ? { ...item, status: "cancelled", message: "Cancelled" }
          : item,
      ),
    );
  }, []);

  const retryItem = useCallback(
    async (key: string, allowDuplicate = false) => {
      const item = items.find((i) => i.key === key);
      if (!item) return;
      cancelled.current.delete(key);
      patch(key, { status: "queued", progress: 0, message: "Retrying…", intakeFileId: undefined });
      const jobId = crypto.randomUUID();
      await supabase
        .from("intake_jobs")
        .insert({ id: jobId, project_id: projectId, status: "running", total_files: 1 });
      await runOne({ ...item, intakeFileId: undefined }, jobId, allowDuplicate);
      await supabase.from("intake_jobs").update({ status: "completed" }).eq("id", jobId);
    },
    [items, patch, projectId, runOne],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) =>
      prev.filter((item) => !["done", "duplicate", "failed", "cancelled"].includes(item.status)),
    );
  }, []);

  const busy = items.some((item) =>
    ["queued", "hashing", "uploading", "verifying", "extracting"].includes(item.status),
  );

  return { items, enqueue, cancelItem, retryItem, clearFinished, busy };
}
