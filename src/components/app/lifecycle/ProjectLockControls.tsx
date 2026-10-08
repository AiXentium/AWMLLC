import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createArchiveSnapshot } from "@/lib/lifecycle/archive";
import { lockProject, unlockProject, type ProjectLockState } from "@/lib/lifecycle/lock";

/** Read-only badge shown on every project screen while the project is locked. */
export function LockedBadge({ lock, className }: { lock: ProjectLockState; className?: string }) {
  if (!lock.lockedAt) return null;
  return (
    <Badge
      variant="outline"
      className={`gap-1 border-amber-600/50 text-amber-700 ${className ?? ""}`}
    >
      <Lock className="size-3" aria-hidden="true" /> Locked — read only
    </Badge>
  );
}

/**
 * Lock / unlock / archive controls. Locking is enforced in the database, so a
 * locked project is read-only for the API too, not only for this screen.
 */
export function ProjectLockControls({
  projectId,
  lock,
  isAdmin,
  canEdit,
  lockedByName,
}: {
  projectId: string;
  lock: ProjectLockState;
  isAdmin: boolean;
  canEdit: boolean;
  lockedByName?: string | null;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"lock" | "unlock" | "archive" | null>(null);
  const [reason, setReason] = useState("");
  const [archiveToo, setArchiveToo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const locked = Boolean(lock.lockedAt);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "lock") {
        if (archiveToo)
          await createArchiveSnapshot({ projectId, reason: reason.trim() || "Locked as complete" });
        await lockProject(projectId, reason.trim() || "Locked as complete");
      } else if (mode === "unlock") {
        await unlockProject(projectId, reason.trim() || "Unlocked for correction");
      } else if (mode === "archive") {
        const snap = await createArchiveSnapshot({
          projectId,
          reason: reason.trim() || "Manual snapshot",
        });
        setResult(`Snapshot version ${snap.version} created.`);
      }
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-archives", projectId] });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setMode(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {locked ? (
        <>
          <LockedBadge lock={lock} />
          {isAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setMode("unlock")}>
              <LockOpen className="mr-2 size-4" aria-hidden="true" /> Unlock
            </Button>
          ) : null}
        </>
      ) : canEdit ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setMode("lock")}>
            <Lock className="mr-2 size-4" aria-hidden="true" /> Lock project
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("archive")}>
            <Archive className="mr-2 size-4" aria-hidden="true" /> Archive snapshot
          </Button>
        </>
      ) : null}

      {locked ? (
        <span className="text-xs text-muted-foreground">
          Locked {new Date(lock.lockedAt as string).toLocaleString()}
          {lockedByName ? ` by ${lockedByName}` : ""}
          {lock.lockReason ? ` · ${lock.lockReason}` : ""}
        </span>
      ) : null}
      {result ? <span className="text-xs text-emerald-700">{result}</span> : null}

      <Dialog open={mode !== null} onOpenChange={(v) => !busy && !v && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "lock"
                ? "Lock this project"
                : mode === "unlock"
                  ? "Unlock this project"
                  : "Create archive snapshot"}
            </DialogTitle>
            <DialogDescription>
              {mode === "lock"
                ? "The project becomes read-only: no document, sheet, working set, takeoff or project-intelligence change is accepted, and the AI can no longer update confirmed records. Viewing, searching, downloading and exporting stay available."
                : mode === "unlock"
                  ? "Unlocking returns the project to editable. Only owners and admins can do this, and the reason is recorded."
                  : "A versioned snapshot records every project field, contact, document reference, sheet, working set, takeoff item, fact and export as they stand now. Large plan files are referenced by storage path and checksum, never duplicated."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="lock-reason">Reason (required in the audit trail)</Label>
              <Textarea
                id="lock-reason"
                rows={3}
                value={reason}
                placeholder={
                  mode === "unlock"
                    ? "Correcting an approved count…"
                    : "Takeoff complete and approved for quoting…"
                }
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {mode === "lock" ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={archiveToo}
                  onChange={(e) => setArchiveToo(e.target.checked)}
                  className="size-4"
                />
                Create an archive snapshot at the same time (recommended)
              </label>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !reason.trim()}>
              <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
              {busy
                ? "Working…"
                : mode === "lock"
                  ? "Lock project"
                  : mode === "unlock"
                    ? "Unlock project"
                    : "Create snapshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
