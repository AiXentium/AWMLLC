import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, ExternalLink, FolderSync, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkDropboxUpdates,
  getProjectCloudLink,
  linkDropboxFolder,
  unlinkDropboxFolder,
} from "@/lib/dropbox/dropbox.functions";
import { useDropboxStatus } from "@/lib/dropbox/useDropbox";
import { cloudSyncStatusLabel } from "@/lib/cloud/shared";
import { DropboxConnectCard } from "./DropboxConnectCard";
import { DropboxImportButton } from "./DropboxImportDialog";

/**
 * Project-level Dropbox view: folder link, sync status in plain language,
 * imported source files with revision numbers, and export history.
 */
export function ProjectDropboxSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { data: status } = useDropboxStatus();
  const [checking, setChecking] = useState(false);
  const [folderPath, setFolderPath] = useState("");

  const { data } = useQuery({
    queryKey: ["dropbox-project", projectId],
    enabled: status?.connected === true,
    queryFn: () => getProjectCloudLink({ data: { projectId } }),
  });

  const link = data?.link ?? null;
  const sources = data?.sources ?? [];
  const exports = data?.exports ?? [];

  async function check() {
    setChecking(true);
    try {
      const result = await checkDropboxUpdates({ data: { projectId } });
      await qc.invalidateQueries({ queryKey: ["dropbox-project", projectId] });
      toast.success("Dropbox check complete", { description: result.message });
    } catch (err) {
      toast.error("Could not check Dropbox", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setChecking(false);
    }
  }

  async function saveLink() {
    const path = folderPath.trim();
    const result = await linkDropboxFolder({
      data: {
        projectId,
        folderPath: path.startsWith("/") || path === "" ? path : `/${path}`,
        folderName: path.split("/").filter(Boolean).pop() ?? "Dropbox",
      },
    });
    if (!result.ok) {
      toast.error("Could not link the folder", { description: result.reason });
      return;
    }
    setFolderPath("");
    await qc.invalidateQueries({ queryKey: ["dropbox-project", projectId] });
    toast.success("Dropbox folder linked");
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg text-navy">
            <Cloud className="size-4 text-muted-foreground" aria-hidden="true" /> Dropbox
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan sets imported from Dropbox and deliverables saved back to Dropbox.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.connected && (sources.length || link) ? (
            <Button size="sm" variant="outline" onClick={() => void check()} disabled={checking}>
              <RefreshCw className={`mr-2 size-4 ${checking ? "animate-spin" : ""}`} /> Check
              Dropbox for updates
            </Button>
          ) : null}
          {canEdit ? <DropboxImportButton projectId={projectId} size="sm" /> : null}
        </div>
      </div>

      {!status?.connected ? (
        <DropboxConnectCard />
      ) : (
        <>
          <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
            {link ? (
              <div className="flex flex-wrap items-center gap-3">
                <FolderSync className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-navy">
                  Linked folder: <strong>{link.folder_path || "/"}</strong>
                </span>
                <Badge variant="outline">{cloudSyncStatusLabel(link.sync_status)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {link.last_checked_at
                    ? `Last checked ${new Date(link.last_checked_at).toLocaleString()}`
                    : "Not checked yet"}
                </span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={async () => {
                      await unlinkDropboxFolder({ data: { projectId } });
                      await qc.invalidateQueries({ queryKey: ["dropbox-project", projectId] });
                      toast.success("Dropbox folder unlinked", {
                        description: "Imported plans and analysis stay in the project.",
                      });
                    }}
                  >
                    <Link2Off className="mr-1 size-4" /> Unlink
                  </Button>
                ) : null}
                {link.sync_error ? (
                  <p className="w-full text-xs text-destructive">{link.sync_error}</p>
                ) : null}
              </div>
            ) : canEdit ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grow">
                  <label
                    htmlFor="dbx-folder"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Link a Dropbox folder to this project
                  </label>
                  <Input
                    id="dbx-folder"
                    className="mt-1"
                    placeholder="/Clients/Bayfront Residences/Plans"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => void saveLink()} disabled={!folderPath.trim()}>
                  Link folder
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No Dropbox folder is linked to this project yet.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Imported source files
              </p>
              {sources.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No plan sets imported from Dropbox yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {sources.map((row) => (
                    <li key={row.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium text-navy">{row.remote_name}</span>
                        <Badge variant="secondary">Rev {row.revision_number}</Badge>
                        {row.update_available ? (
                          <Badge variant="outline">Newer in Dropbox</Badge>
                        ) : null}
                        {row.status === "unavailable" ? (
                          <Badge variant="destructive">Unavailable</Badge>
                        ) : null}
                        {row.status === "superseded" ? (
                          <Badge variant="outline">Superseded</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{row.remote_path}</p>
                      {row.sync_note ? (
                        <p className="text-xs text-amber-700">{row.sync_note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saved to Dropbox
              </p>
              {exports.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No exports saved to Dropbox yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {exports.map((row) => (
                    <li key={row.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-navy">{row.filename}</span>
                        <Badge variant="secondary">{row.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.remote_path} · {new Date(row.created_at).toLocaleString()}
                      </p>
                      {row.web_url ? (
                        <a
                          className="inline-flex items-center gap-1 text-xs underline"
                          href={row.web_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Open in Dropbox <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
