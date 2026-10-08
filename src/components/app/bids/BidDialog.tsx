/**
 * BidDialog — create / edit form for a bid.
 *
 * Covers every editable column on the `bids` table: GC, contact info,
 * due date, linked project, stage, notes, and win/loss reason (shown only
 * when the stage is Won or Lost).
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BIDS_QUERY_KEY,
  BID_STAGES,
  useSaveBid,
  type Bid,
  type BidInput,
  type BidStage,
} from "@/lib/bids";

const NO_PROJECT = "__none";

interface BidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create mode. */
  bid: Bid | null;
  initialStage?: BidStage;
}

interface ProjectOption {
  id: string;
  name: string | null;
}

export function BidDialog({ open, onOpenChange, bid, initialStage = "lead" }: BidDialogProps) {
  const queryClient = useQueryClient();
  const [gcName, setGcName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [stage, setStage] = useState<BidStage>(initialStage);
  const [notes, setNotes] = useState("");
  const [winLossReason, setWinLossReason] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "bid-selector"],
    queryFn: async (): Promise<ProjectOption[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProjectOption[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setGcName(bid?.gc_name ?? "");
    setContactName(bid?.contact_name ?? "");
    setContactEmail(bid?.contact_email ?? "");
    setContactPhone(bid?.contact_phone ?? "");
    setDueDate(bid?.due_date ?? "");
    setProjectId(bid?.project_id ?? NO_PROJECT);
    setStage(bid?.stage ?? initialStage);
    setNotes(bid?.notes ?? "");
    setWinLossReason(bid?.win_loss_reason ?? "");
  }, [open, bid, initialStage]);

  const saveMutation = useSaveBid();

  const handleSave = () => {
    const input: BidInput = {
      project_id: projectId === NO_PROJECT ? null : projectId,
      stage,
      gc_name: gcName.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      win_loss_reason: winLossReason.trim() || null,
    };
    saveMutation.mutate(
      { id: bid?.id ?? null, input },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: BIDS_QUERY_KEY });
          toast.success(bid ? "Bid updated" : "Bid created");
          onOpenChange(false);
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Could not save bid");
        },
      },
    );
  };

  const showWinLoss = stage === "won" || stage === "lost";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{bid ? "Edit bid" : "New bid"}</DialogTitle>
          <DialogDescription>
            {bid
              ? "Update the bid details below."
              : "Track a new bidding opportunity through the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="bid-gc">GC / customer</Label>
            <Input
              id="bid-gc"
              value={gcName}
              onChange={(e) => setGcName(e.target.value)}
              placeholder="e.g. Coastal General Contractors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bid-contact">Contact name</Label>
              <Input
                id="bid-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bid-phone">Contact phone</Label>
              <Input
                id="bid-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(305) 555-0100"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bid-email">Contact email</Label>
            <Input
              id="bid-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bid-due">Due date</Label>
              <Input
                id="bid-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bid-stage">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as BidStage)}>
                <SelectTrigger id="bid-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BID_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bid-project">Linked project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="bid-project">
                <SelectValue placeholder="No project linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project linked</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name ?? "Untitled project"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showWinLoss ? (
            <div className="grid gap-2">
              <Label htmlFor="bid-winloss">{stage === "won" ? "Win reason" : "Loss reason"}</Label>
              <Input
                id="bid-winloss"
                value={winLossReason}
                onChange={(e) => setWinLossReason(e.target.value)}
                placeholder={
                  stage === "won"
                    ? "e.g. Best value, fast turnaround"
                    : "e.g. Lost on price to competitor"
                }
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="bid-notes">Notes</Label>
            <Textarea
              id="bid-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Scope notes, alternates, follow-up reminders..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : bid ? "Save changes" : "Create bid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
