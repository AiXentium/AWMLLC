import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { softDelete } from "@/lib/lifecycle/actions";
import { LIFECYCLE, type LifecycleEntity } from "@/lib/lifecycle/registry";
import { cn } from "@/lib/utils";

/**
 * The single Delete control used everywhere in the platform. It never destroys
 * anything: it captures a reason, soft-deletes, and points the user at the
 * Recycle Bin where the record can be restored.
 */
export function DeleteAction({
  entity,
  ids,
  projectId,
  sourceScreen,
  label,
  recordName,
  disabled,
  disabledHint,
  variant = "ghost",
  size = "icon",
  className,
  invalidateKeys = [],
  onDeleted,
  children,
}: {
  entity: LifecycleEntity;
  ids: string[];
  projectId?: string | null;
  sourceScreen: string;
  label?: string;
  recordName?: string;
  disabled?: boolean;
  disabledHint?: string;
  variant?: "ghost" | "outline" | "destructive" | "secondary";
  size?: "icon" | "sm" | "default";
  className?: string;
  invalidateKeys?: unknown[][];
  onDeleted?: () => void;
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const def = LIFECYCLE[entity];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const many = ids.length > 1;
  const title = label ?? `Delete ${many ? def.plural.toLowerCase() : def.label.toLowerCase()}`;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await softDelete({ entity, ids, reason: reason.trim(), projectId, sourceScreen });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["recycle-bin"] });
      if (projectId) qc.invalidateQueries({ queryKey: ["activity", projectId] });
      setOpen(false);
      setReason("");
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(className)}
        aria-label={title}
        title={disabled ? disabledHint : title}
        disabled={disabled || ids.length === 0}
        onClick={() => setOpen(true)}
      >
        {children ?? <Trash2 className="size-4" aria-hidden="true" />}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {many ? `${ids.length} ${def.plural.toLowerCase()}` : (recordName ?? def.label)} will
              be moved to the Recycle Bin. Nothing is destroyed — an authorized user can restore it,
              and only an owner or admin can purge it permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason (recorded in the audit trail)</Label>
            <Textarea
              id="delete-reason"
              rows={3}
              value={reason}
              placeholder="Superseded revision, uploaded to the wrong project, duplicate…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Deleting…" : "Move to Recycle Bin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
