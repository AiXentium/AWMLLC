import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { BidBoard } from "@/components/app/bids/BidBoard";
import { BidDialog } from "@/components/app/bids/BidDialog";
import type { Bid, BidStage } from "@/lib/bids";

export const Route = createFileRoute("/_authenticated/app/bids")({
  head: () => ({
    meta: [
      { title: "Bid Board — AWM Takeoff AI" },
      { name: "description", content: "Track bids from lead to won or lost." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BidsPage,
});

function BidsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBid, setEditingBid] = useState<Bid | null>(null);
  const [initialStage, setInitialStage] = useState<BidStage>("lead");

  const openNew = (stage: BidStage) => {
    setEditingBid(null);
    setInitialStage(stage);
    setDialogOpen(true);
  };

  const openEdit = (bid: Bid) => {
    setEditingBid(bid);
    setDialogOpen(true);
  };

  return (
    <AppShell
      title="Bid Board"
      subtitle="Track every opportunity from lead to won or lost. Follow-up cards highlight when they go stale."
      actions={
        <Button onClick={() => openNew("lead")}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New bid
        </Button>
      }
    >
      <BidBoard onEditBid={openEdit} onNewBid={openNew} />
      <BidDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bid={editingBid}
        initialStage={initialStage}
      />
    </AppShell>
  );
}
