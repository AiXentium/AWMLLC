import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkDriveSourceVersions } from "@/lib/google/drive.functions";
import { useDriveStatus } from "@/lib/google/useGoogleDrive";
import { DriveImportButton } from "./DriveImportDialog";
import { formatBytes } from "@/lib/utils";

/** Project-level view of Drive-linked source files and exported deliverables. */
export function ProjectDriveSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { data: status } = useDriveStatus();
  const [checking, setChecking] = useState(false);

  const { data: sources = [] } = useQuery({
    queryKey: ["drive-sources", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_source_files")
        .select(
          "id,drive_name,drive_folder_name,drive_web_view_link,drive_modified_time,latest_modified_time,update_available,status,size_bytes,created_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: exported = [] } = useQuery({
    queryKey: ["drive-exports", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_exports")
        .select(
          "id,filename,file_type,drive_folder_name,drive_web_view_link,action,size_bytes,created_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function check() {
    setChecking(true);
    try {
      const result = await checkDriveSourceVersions({ data: { projectId } });
      await qc.invalidateQueries({ queryKey: ["drive-sources", projectId] });
      toast.success("Google Drive check complete", {
        description: `${result.checked} linked file(s) · ${result.updates} newer in Drive · ${result.missing} unavailable`,
      });
    } catch (err) {
      toast.error("Could not check Google Drive", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg text-navy">
            <Cloud className="size-4 text-muted-foreground" aria-hidden="true" /> Google Drive
          </h2>
          <p className="text-sm text-muted-foreground">
            Source plan sets imported from Drive and deliverables saved back to Drive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.connected && sources.length ? (
            <Button size="sm" variant="outline" onClick={() => void check()} disabled={checking}>
              <RefreshCw className={`mr-2 size-4 ${checking ? "animate-spin" : ""}`} /> Check for
              newer source version
            </Button>
          ) : null}
          {canEdit ? <DriveImportButton projectId={projectId} size="sm" /> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Linked source files
          </p>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No plan sets imported from Google Drive yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {sources.map((row) => (
                <li key={row.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-navy">{row.drive_name}</span>
                    {row.update_available ? <Badge variant="outline">Newer in Drive</Badge> : null}
                    {row.status === "unavailable" ? (
                      <Badge variant="destructive">Unavailable</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.drive_folder_name ?? "My Drive"}
                    {row.size_bytes ? ` · ${formatBytes(Number(row.size_bytes))}` : ""}
                    {row.drive_modified_time
                      ? ` · modified ${new Date(row.drive_modified_time).toLocaleDateString()}`
                      : ""}
                  </p>
                  {row.drive_web_view_link ? (
                    <a
                      className="inline-flex items-center gap-1 text-xs underline"
                      href={row.drive_web_view_link}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Open in Google Drive <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saved to Drive
          </p>
          {exported.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No exports saved to Google Drive yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {exported.map((row) => (
                <li key={row.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-navy">{row.filename}</span>
                    <Badge variant="secondary">{row.action}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.drive_folder_name ?? "My Drive"} ·{" "}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                  {row.drive_web_view_link ? (
                    <a
                      className="inline-flex items-center gap-1 text-xs underline"
                      href={row.drive_web_view_link}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Open in Google Drive <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
