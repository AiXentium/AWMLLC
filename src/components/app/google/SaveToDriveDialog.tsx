import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cloud, ExternalLink, Folder, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDriveProjectFolder,
  listDriveFolderTree,
  saveExportToDrive,
} from "@/lib/google/drive.functions";
import { useDriveStatus } from "@/lib/google/useGoogleDrive";
import { GoogleDriveConnectCard } from "./GoogleDriveConnectCard";

export type DriveSaveTarget = {
  projectId: string;
  projectName: string;
  exportId?: string | null;
  storagePath: string;
  filename: string;
};

/** Choose (or create) a Drive folder, rename, resolve conflicts, then upload. */
export function SaveToDriveDialog({
  target,
  open,
  onOpenChange,
}: {
  target: DriveSaveTarget | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { data: status } = useDriveStatus();
  const connected = status?.connected === true;
  const [parent, setParent] = useState<{ id: string | null; name: string }>({
    id: null,
    name: "My Drive",
  });
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ name: string } | null>(null);
  const [saved, setSaved] = useState<{ link: string | null; name: string } | null>(null);

  useEffect(() => {
    if (open && target) {
      setFilename(target.filename);
      setConflict(null);
      setSaved(null);
    }
  }, [open, target]);

  const { data: folders = [], refetch } = useQuery({
    queryKey: ["drive-folders", parent.id],
    enabled: open && connected,
    queryFn: () => listDriveFolderTree({ data: { parentId: parent.id } }),
  });

  async function createProjectFolder() {
    if (!target) return;
    setSaving(true);
    try {
      const { folder } = await createDriveProjectFolder({
        data: { segments: ["AWM Coastal Windows", target.projectName || "Project"] },
      });
      if (folder) setParent({ id: folder.id, name: `AWM Coastal Windows / ${target.projectName}` });
      await refetch();
    } catch (err) {
      toast.error("Could not create the Drive folder", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function save(onConflict?: "replace" | "keep_both") {
    if (!target) return;
    setSaving(true);
    try {
      const result = await saveExportToDrive({
        data: {
          projectId: target.projectId,
          exportId: target.exportId ?? null,
          storagePath: target.storagePath,
          filename,
          folderId: parent.id,
          folderName: parent.name,
          onConflict: onConflict ?? null,
        },
      });
      if (!result.ok) {
        if ("conflict" in result && result.conflict) {
          setConflict({ name: filename });
          return;
        }
        toast.error("Save to Google Drive failed", { description: result.reason });
        return;
      }
      setConflict(null);
      setSaved({ link: result.file.webViewLink, name: result.file.name });
      toast.success("Saved to Google Drive", {
        description: `${result.file.name} · ${parent.name}`,
      });
    } catch (err) {
      toast.error("Save to Google Drive failed", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-navy">Save to Google Drive</DialogTitle>
          <DialogDescription>
            Choose a destination folder and confirm the file name.
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <GoogleDriveConnectCard />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="drive-filename">File name</Label>
              <Input
                id="drive-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Destination</Label>
              <p className="text-sm text-muted-foreground">{parent.name}</p>
              <div className="flex flex-wrap gap-2">
                {parent.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setParent({ id: null, name: "My Drive" })}
                  >
                    My Drive
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void createProjectFolder()}
                  disabled={saving}
                >
                  <FolderPlus className="mr-2 size-4" /> Use project folder
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                {folders.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No sub-folders here.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {folders.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                          onClick={() => setParent({ id: f.id, name: f.name })}
                        >
                          <Folder className="size-4 text-muted-foreground" aria-hidden="true" />
                          {f.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {conflict ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-navy">
                  “{conflict.name}” already exists in that folder.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void save("replace")}
                    disabled={saving}
                  >
                    Replace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void save("keep_both")}
                    disabled={saving}
                  >
                    Keep both
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConflict(null)}>
                    Rename instead
                  </Button>
                </div>
              </div>
            ) : null}

            {saved ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-medium text-navy">Saved: {saved.name}</p>
                {saved.link ? (
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-sm underline"
                    href={saved.link}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open in Google Drive <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {connected ? (
            <Button onClick={() => void save()} disabled={saving || !filename.trim() || !!conflict}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 size-4" />
              )}
              Save to Drive
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small trigger used next to every Download action. */
export function SaveToDriveButton({
  target,
  size = "sm",
}: {
  target: DriveSaveTarget;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant="ghost" onClick={() => setOpen(true)}>
        <Cloud className="mr-2 size-4" aria-hidden="true" /> Save to Drive
      </Button>
      <SaveToDriveDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}
