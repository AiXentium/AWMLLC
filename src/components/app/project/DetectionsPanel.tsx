import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MARKER_TYPES, typeLabel } from "@/lib/takeoff-types";
import { useDetectionReview, useDetections, type DetectionRow } from "@/lib/ai/detections";
import { parseDimensionInput, formatSize } from "@/lib/takeoff/dimensions";
import { toast } from "sonner";

/**
 * Review layer for AI-suggested openings. Suggestions never become takeoff
 * items until an estimator approves them here; rejected ones stay on record.
 */
export function DetectionsPanel({
  projectId,
  pageId,
  canEdit,
  running,
  message,
  onDetect,
  onHighlight,
  highlightedId,
  onApproved,
}: {
  projectId: string;
  pageId: string | null;
  canEdit: boolean;
  running: boolean;
  message: string | null;
  onDetect: () => void;
  onHighlight: (id: string | null) => void;
  highlightedId: string | null;
  onApproved?: (approved: { itemId: string; bbox: unknown }[]) => void;
}) {
  const { data: detections = [] } = useDetections(pageId);
  const review = useDetectionReview(projectId, pageId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DetectionRow>>({});
  const [dimError, setDimError] = useState<string | null>(null);

  /** Parses a typed dimension (36, 36", 3'-0") into inches for the draft. */
  function onDimensionChange(field: "width_in" | "height_in", value: string) {
    const { inches, error } = parseDimensionInput(value);
    setDimError(error ?? null);
    setDraft((p) => ({ ...p, [field]: inches }));
  }

  const pending = useMemo(() => detections.filter((d) => d.status === "pending"), [detections]);
  const reviewed = detections.length - pending.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          AI suggestions ({pending.length})
        </p>
        <Button size="sm" variant="outline" disabled={!pageId || running} onClick={onDetect}>
          {running ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-3.5" />
          )}
          Detect items
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Suggestions are unverified until approved. Approving creates a takeoff item in{" "}
        <strong>review</strong> status; the original suggestion and its reasoning stay on record.
      </p>
      {message ? <p className="mt-2 text-xs text-navy">{message}</p> : null}

      {pending.length > 1 && canEdit ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={review.approve.isPending}
            onClick={() =>
              review.approve.mutate(
                { ids: selected.size ? [...selected] : pending.map((d) => d.id) },
                {
                  onSuccess: (r) => {
                    setSelected(new Set());
                    onApproved?.(r);
                  },
                },
              )
            }
          >
            Approve {selected.size ? `${selected.size} selected` : "all"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={review.reject.isPending}
            onClick={() =>
              review.reject.mutate(selected.size ? [...selected] : pending.map((d) => d.id))
            }
          >
            Reject {selected.size ? "selected" : "all"}
          </Button>
        </div>
      ) : null}

      <ul className="mt-2 space-y-2">
        {pending.map((d) => {
          const isEditing = editing === d.id;
          return (
            <li
              key={d.id}
              className={`rounded-md border p-2 text-xs ${
                highlightedId === d.id ? "border-primary bg-secondary" : "border-border"
              }`}
              onMouseEnter={() => onHighlight(d.id)}
              onMouseLeave={() => onHighlight(null)}
            >
              <div className="flex items-start gap-2">
                {canEdit ? (
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={() => toggle(d.id)}
                    aria-label={`Select suggestion ${d.label ?? typeLabel(d.product_type)}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">
                    {d.label ?? "Untagged"} · {typeLabel(d.product_type)}
                  </p>
                  <p className="text-muted-foreground">
                    Qty {d.quantity}
                    {d.width_in && d.height_in ? ` · ${formatSize(d.width_in, d.height_in)}` : ""}
                  </p>
                  {d.reasoning ? <p className="mt-1 text-muted-foreground">{d.reasoning}</p> : null}
                </div>
                <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                  {d.confidence != null ? `${Math.round(Number(d.confidence) * 100)}%` : "—"}
                </Badge>
              </div>

              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <Select
                    value={String(draft.product_type ?? d.product_type ?? "")}
                    onValueChange={(v) => setDraft((p) => ({ ...p, product_type: v }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKER_TYPES.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="h-8"
                      placeholder="Mark"
                      defaultValue={d.label ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                    />
                    <Input
                      className="h-8"
                      type="number"
                      placeholder="Qty"
                      defaultValue={d.quantity}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))
                      }
                    />
                    <Input
                      className="h-8"
                      placeholder={'Width (36, 36", 3\'-0")'}
                      defaultValue={d.width_in ?? ""}
                      onChange={(e) => onDimensionChange("width_in", e.target.value)}
                    />
                    <Input
                      className="h-8"
                      placeholder={'Height (36, 36", 3\'-0")'}
                      defaultValue={d.height_in ?? ""}
                      onChange={(e) => onDimensionChange("height_in", e.target.value)}
                    />
                  </div>
                  {dimError ? <p className="text-xs text-destructive">{dimError}</p> : null}
                  <Button
                    size="sm"
                    disabled={review.approve.isPending || Boolean(dimError)}
                    onClick={() =>
                      review.approve.mutate(
                        { ids: [d.id], patch: draft },
                        {
                          onSuccess: (r) => {
                            setEditing(null);
                            setDraft({});
                            setDimError(null);
                            onApproved?.(r);
                          },
                          onError: (e: Error) =>
                            toast.error("Could not approve", { description: e.message }),
                        },
                      )
                    }
                  >
                    Save & approve
                  </Button>
                </div>
              ) : canEdit ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={review.approve.isPending}
                    onClick={() =>
                      review.approve.mutate({ ids: [d.id] }, { onSuccess: (r) => onApproved?.(r) })
                    }
                  >
                    <Check className="mr-1 size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => {
                      setEditing(d.id);
                      setDraft({});
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={review.reject.isPending}
                    onClick={() => review.reject.mutate([d.id])}
                  >
                    <X className="mr-1 size-3.5" /> Reject
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
        {pending.length === 0 ? (
          <li className="py-2 text-xs text-muted-foreground">
            No pending AI suggestions on this sheet.
            {reviewed ? ` ${reviewed} already reviewed.` : ""}
          </li>
        ) : null}
      </ul>
      {review.approve.error ? (
        <p className="mt-2 text-xs text-destructive">{(review.approve.error as Error).message}</p>
      ) : null}
    </div>
  );
}
