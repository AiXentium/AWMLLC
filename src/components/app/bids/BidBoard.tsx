/**
 * BidBoard — kanban pipeline for bids.
 *
 * One column per bid stage. Cards move between stages with prev/next
 * buttons (no drag library needed). Clicking a card opens the edit dialog.
 * The Follow-up column surfaces a "days since last touch" nudge and
 * highlights cards untouched for more than 2 days.
 */
import { useMemo } from "react";
import { toast } from "sonner";
import { Building2, ChevronLeft, ChevronRight, Clock, Phone, Plus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BID_STAGES,
  daysSinceUpdate,
  daysUntilDue,
  formatShortDate,
  useBids,
  useMoveBidStage,
  type Bid,
  type BidStage,
} from "@/lib/bids";

/** Cards untouched longer than this (days) get the attention highlight. */
const STALE_AFTER_DAYS = 2;

function DueBadge({ dueDate }: { dueDate: string | null }) {
  const days = daysUntilDue(dueDate);
  if (days === null || !dueDate) return null;
  const label = formatShortDate(dueDate);
  if (days < 0) {
    return <Badge variant="destructive">Overdue {Math.abs(days)}d</Badge>;
  }
  if (days === 0) {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Due today</Badge>;
  }
  if (days <= 3) {
    return (
      <Badge variant="outline" className="border-amber-500/60 text-amber-700">
        Due in {days}d
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">Due {label}</span>;
}

function FollowUpNudge({ bid }: { bid: Bid }) {
  const staleDays = daysSinceUpdate(bid.updated_at);
  if (staleDays === null) return null;
  const needsAttention = staleDays > STALE_AFTER_DAYS;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        needsAttention ? "font-semibold text-red-700" : "text-muted-foreground",
      )}
    >
      <Clock className="size-3" aria-hidden="true" />
      {staleDays === 0 ? "Touched today" : `Last touch ${staleDays}d ago`}
    </span>
  );
}

interface BidCardProps {
  bid: Bid;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  moving: boolean;
}

function BidCard({ bid, onEdit, onMove, moving }: BidCardProps) {
  const stageIndex = BID_STAGES.findIndex((s) => s.value === bid.stage);
  const staleDays = daysSinceUpdate(bid.updated_at);
  const needsAttention = bid.stage === "followup" && (staleDays ?? 0) > STALE_AFTER_DAYS;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEdit();
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60",
        needsAttention && "border-red-500/70 bg-red-50/60 dark:bg-red-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-navy">{bid.gc_name || "Untitled bid"}</p>
        <DueBadge dueDate={bid.due_date} />
      </div>

      {bid.projects?.name ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{bid.projects.name}</span>
        </p>
      ) : null}

      {bid.contact_name ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{bid.contact_name}</span>
        </p>
      ) : null}

      {bid.contact_phone ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{bid.contact_phone}</span>
        </p>
      ) : null}

      {bid.stage === "followup" ? (
        <div className="mt-2">
          <FollowUpNudge bid={bid} />
        </div>
      ) : null}

      {(bid.stage === "won" || bid.stage === "lost") && bid.win_loss_reason ? (
        <p className="mt-2 truncate text-xs italic text-muted-foreground">
          “{bid.win_loss_reason}”
        </p>
      ) : null}

      <div
        className="mt-2 flex items-center justify-between border-t border-border pt-2"
        onClick={stop}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={stageIndex <= 0 || moving}
          onClick={() => onMove(-1)}
          aria-label="Move to previous stage"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
          {BID_STAGES[stageIndex]?.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={stageIndex < 0 || stageIndex >= BID_STAGES.length - 1 || moving}
          onClick={() => onMove(1)}
          aria-label="Move to next stage"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface BidBoardProps {
  onEditBid: (bid: Bid) => void;
  onNewBid: (stage: BidStage) => void;
}

export function BidBoard({ onEditBid, onNewBid }: BidBoardProps) {
  const { data: bids = [], isLoading, isError } = useBids();
  const moveStage = useMoveBidStage();

  const grouped = useMemo(() => {
    const map = new Map<BidStage, Bid[]>();
    for (const s of BID_STAGES) map.set(s.value, []);
    for (const bid of bids) {
      const list = map.get(bid.stage);
      if (list) list.push(bid);
    }
    return map;
  }, [bids]);

  const handleMove = (bid: Bid, direction: -1 | 1) => {
    const idx = BID_STAGES.findIndex((s) => s.value === bid.stage);
    const next = BID_STAGES[idx + direction];
    if (!next) return;
    moveStage.mutate(
      { id: bid.id, stage: next.value },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move bid"),
      },
    );
  };

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading bids...</p>;
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-destructive">Could not load bids.</p>;
  }

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {BID_STAGES.map((stage) => {
        const cards = grouped.get(stage.value) ?? [];
        return (
          <section
            key={stage.value}
            aria-label={`${stage.label} bids`}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40"
          >
            <header className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-navy">{stage.label}</h2>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => onNewBid(stage.value)}
                aria-label={`New bid in ${stage.label}`}
              >
                <Plus className="size-4" />
              </Button>
            </header>
            <div
              className="flex flex-col gap-2 overflow-y-auto p-2"
              style={{ maxHeight: "calc(100vh - 280px)", minHeight: "120px" }}
            >
              {cards.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">No bids</p>
              ) : (
                cards.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    onEdit={() => onEditBid(bid)}
                    onMove={(dir) => handleMove(bid, dir)}
                    moving={moveStage.isPending}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
