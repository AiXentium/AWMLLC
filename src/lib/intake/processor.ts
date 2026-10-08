import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPdfFromUrl, renderPageToBlob } from "@/lib/pdf-client";
import { signedUrl } from "@/lib/storage-client";
import { logAudit } from "@/lib/audit";

const BATCH = 4;
const POLL_MS = 5000;

export type ProcessingState = {
  documentId: string;
  name: string;
  done: number;
  total: number;
} | null;

/**
 * Background page-extraction worker for the signed-in browser session.
 *
 * Page rendering needs a canvas, which the edge runtime does not provide, so
 * extraction runs here — but every unit of work is persisted, batched and
 * idempotent: a refresh, a sign-out or a crash simply resumes the remaining
 * pages of any document still marked queued/processing.
 */
export function useIntakeProcessor(projectId: string, enabled: boolean) {
  const qc = useQueryClient();
  const running = useRef(false);
  const [state, setState] = useState<ProcessingState>(null);

  const processDocument = useCallback(
    async (doc: {
      id: string;
      name: string;
      storage_path: string | null;
      intake_file_id: string | null;
    }) => {
      if (!doc.storage_path) throw new Error("This plan set has no stored file.");
      await supabase
        .from("documents")
        .update({ status: "processing", error_message: null })
        .eq("id", doc.id);
      if (doc.intake_file_id) {
        await supabase
          .from("intake_files")
          .update({ status: "extracting_pages" })
          .eq("id", doc.intake_file_id);
      }

      const url = await signedUrl("plan-files", doc.storage_path, 7200);
      const pdf = await loadPdfFromUrl(url);
      const total = pdf.numPages;
      await supabase.from("documents").update({ page_count: total }).eq("id", doc.id);

      const { data: existingPages } = await supabase
        .from("pages")
        .select("page_number,thumbnail_path")
        .eq("document_id", doc.id);
      const done = new Set(
        (existingPages ?? []).filter((p) => p.thumbnail_path).map((p) => p.page_number),
      );

      let failed = 0;
      if (doc.intake_file_id) {
        await supabase
          .from("intake_files")
          .update({ status: "generating_thumbnails" })
          .eq("id", doc.intake_file_id);
      }

      for (let start = 1; start <= total; start += BATCH) {
        const numbers: number[] = [];
        for (let n = start; n < start + BATCH && n <= total; n += 1)
          if (!done.has(n)) numbers.push(n);

        for (const pageNumber of numbers) {
          try {
            const { blob, width, height } = await renderPageToBlob(pdf, pageNumber, 300);
            const thumbPath = `${projectId}/${doc.id}/thumbs/${pageNumber}.jpg`;
            const up = await supabase.storage
              .from("plan-files")
              .upload(thumbPath, blob, { contentType: "image/jpeg", upsert: true });
            if (up.error) throw new Error(up.error.message);
            const { error } = await supabase.from("pages").upsert(
              {
                document_id: doc.id,
                project_id: projectId,
                page_number: pageNumber,
                sheet_number: `P-${String(pageNumber).padStart(3, "0")}`,
                state: "all",
                thumbnail_path: thumbPath,
                width,
                height,
                processing_error: null,
              },
              { onConflict: "document_id,page_number" },
            );
            if (error) throw new Error(error.message);
          } catch (err) {
            failed += 1;
            await supabase.from("pages").upsert(
              {
                document_id: doc.id,
                project_id: projectId,
                page_number: pageNumber,
                state: "processing",
                processing_error: err instanceof Error ? err.message : "Page render failed",
              },
              { onConflict: "document_id,page_number" },
            );
          }
        }

        const processed = Math.min(start + BATCH - 1, total);
        setState({ documentId: doc.id, name: doc.name, done: processed, total });
        await supabase
          .from("documents")
          .update({ pages_processed: processed, pages_failed: failed })
          .eq("id", doc.id);
        // Sheets become browsable while the rest of the set keeps processing.
        qc.invalidateQueries({ queryKey: ["pages", projectId] });
        qc.invalidateQueries({ queryKey: ["documents", projectId] });
      }

      const status = failed > 0 ? "partially_failed" : "ready";
      await supabase
        .from("documents")
        .update({ status, pages_processed: total, pages_failed: failed })
        .eq("id", doc.id);
      if (doc.intake_file_id) {
        await supabase
          .from("intake_files")
          .update({ status: failed > 0 ? "partially_failed" : "ready" })
          .eq("id", doc.intake_file_id);
      }
      await logAudit({
        projectId,
        action: failed > 0 ? "document.processed_with_errors" : "document.processed",
        entityType: "document",
        entityId: doc.id,
        detail: { name: doc.name, pages: total, failed },
      });
    },
    [projectId, qc],
  );

  const drain = useCallback(async () => {
    if (running.current || !enabled) return;
    running.current = true;
    try {
      for (;;) {
        const { data } = await supabase
          .from("documents")
          .select("id,name,storage_path,status,intake_file_id")
          .eq("project_id", projectId)
          .in("status", ["queued", "processing"])
          .order("created_at", { ascending: true })
          .limit(1);
        const next = data?.[0];
        if (!next) break;
        try {
          await processDocument(next);
        } catch (err) {
          await supabase
            .from("documents")
            .update({
              status: "failed",
              error_message: err instanceof Error ? err.message : "Processing failed",
            })
            .eq("id", next.id);
          if (next.intake_file_id) {
            await supabase
              .from("intake_files")
              .update({
                status: "failed",
                error_message: err instanceof Error ? err.message : "Processing failed",
              })
              .eq("id", next.intake_file_id);
          }
        }
        qc.invalidateQueries({ queryKey: ["documents", projectId] });
        qc.invalidateQueries({ queryKey: ["intake", projectId] });
      }
    } finally {
      running.current = false;
      setState(null);
    }
  }, [enabled, processDocument, projectId, qc]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const tick = () => {
      if (active) void drain();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [drain, enabled]);

  return { state, drain };
}
