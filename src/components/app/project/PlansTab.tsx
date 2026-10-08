import { useMemo } from "react";
import { ExtractionStatusChip } from "@/components/app/project/ProjectInfoReview";
import { PreAnalysisStatusChip } from "@/components/app/project/PreAnalysisPanel";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, FolderTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ProcessingBanner,
  UploadDropzone,
  UploadQueue,
} from "@/components/app/project/upload/ProjectUpload";
import { useProjectUpload } from "@/components/app/project/upload/useProjectUpload";
import { intakeStatusLabel } from "@/lib/intake/shared";
import { formatBytes } from "@/lib/utils";

const STATUS_TONE: Record<string, "secondary" | "destructive" | "outline"> = {
  ready: "secondary",
  failed: "destructive",
  cancelled: "destructive",
  partially_failed: "outline",
};

export function PlansTab({ projectId }: { projectId: string }) {
  const { busy, processing } = useProjectUpload();
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", projectId],
    refetchInterval: busy || processing ? 4000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id,name,status,page_count,pages_processed,pages_failed,size_bytes,created_at,error_message,original_filename,category,source_archive,source_folder",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /** Where each document came from, so the list can show a source badge. */
  const { data: sourceByDocument = {} } = useQuery({
    queryKey: ["document-sources", projectId],
    queryFn: async () => {
      const map: Record<string, string> = {};
      const [cloud, drive] = await Promise.all([
        supabase
          .from("cloud_source_files")
          .select("document_id,provider,revision_number")
          .eq("project_id", projectId),
        supabase.from("drive_source_files").select("document_id").eq("project_id", projectId),
      ]);
      for (const row of cloud.data ?? []) {
        if (!row.document_id) continue;
        map[row.document_id] =
          row.provider === "dropbox"
            ? row.revision_number > 1
              ? `Dropbox · Rev ${row.revision_number}`
              : "Dropbox"
            : "Google Drive";
      }
      for (const row of drive.data ?? [])
        if (row.document_id) map[row.document_id] = "Google Drive";
      return map;
    },
  });

  const { data: ignored = [] } = useQuery({
    queryKey: ["intake", projectId, "ignored"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_files")
        .select("id,original_filename,source_archive,reason,status")
        .eq("project_id", projectId)
        .in("status", ["ignored", "duplicate", "failed"])
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof documents>();
    for (const doc of documents) {
      const key = doc.source_archive ?? "Direct uploads";
      map.set(key, [...(map.get(key) ?? []), doc]);
    }
    return [...map.entries()];
  }, [documents]);

  return (
    <div className="space-y-6">
      <UploadDropzone />
      <UploadQueue />
      <ProcessingBanner />
      <ExtractionStatusChip projectId={projectId} />
      <PreAnalysisStatusChip projectId={projectId} />

      <div className="space-y-6">
        {isLoading ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading plan sets…
          </p>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 size-6" aria-hidden="true" />
            <p className="font-medium text-navy">No plan sets yet</p>
            <p className="mt-1 text-sm">
              Upload the architect’s PDF or the full plan ZIP above to start the takeoff.
            </p>
          </div>
        ) : (
          grouped.map(([group, docs]) => (
            <div key={group} className="overflow-hidden rounded-lg border border-border bg-card">
              <p className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2 text-sm font-medium text-navy">
                <FolderTree className="size-4 text-muted-foreground" aria-hidden="true" />
                {group}
                <span className="text-xs font-normal text-muted-foreground">
                  {docs.length} document{docs.length === 1 ? "" : "s"}
                </span>
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Plan set
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Pages
                    </th>
                    <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">
                      Size
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium text-navy">
                          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                          {doc.name}
                        </span>
                        {doc.source_folder ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {doc.source_folder}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.category ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {doc.status === "ready"
                          ? (doc.page_count ?? "—")
                          : `${doc.pages_processed ?? 0}${doc.page_count ? ` / ${doc.page_count}` : ""}`}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {doc.size_bytes ? formatBytes(Number(doc.size_bytes)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge variant={STATUS_TONE[doc.status] ?? "outline"}>
                            {intakeStatusLabel(doc.status)}
                          </Badge>
                          <Badge variant="outline">
                            {sourceByDocument[doc.id] ?? "Local Upload"}
                          </Badge>
                        </span>
                        {doc.pages_failed ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {doc.pages_failed} sheet(s) failed to render
                          </p>
                        ) : null}
                        {doc.error_message ? (
                          <p className="mt-1 max-w-sm text-xs text-destructive">
                            {doc.error_message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {ignored.length ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-navy">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" /> Skipped during
            intake
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {ignored.map((row) => (
              <li key={row.id}>
                <span className="text-navy">{row.original_filename}</span>
                {row.source_archive ? ` (${row.source_archive})` : ""} —{" "}
                {intakeStatusLabel(row.status)}
                {row.reason ? `: ${row.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
