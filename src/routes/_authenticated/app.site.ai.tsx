import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SiteAiAgent } from "@/components/app/site/SiteAiAgent";
import { useMyRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/app/site/ai")({
  head: () => ({
    meta: [
      { title: "AI Site Agent — AWM Takeoff AI" },
      {
        name: "description",
        content: "Edit the public website with plain-English instructions. Owner only.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SiteAiAgentPage,
});

function SiteAiAgentPage() {
  const { data, isLoading } = useMyRole();
  const isOwner = data?.role === "owner_admin";

  return (
    <AppShell
      title="AI Site Agent"
      subtitle="Describe the change in plain English — review the preview, then apply. Nothing saves without your approval."
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking access…
        </div>
      ) : !isOwner ? (
        <div className="flex max-w-md items-start gap-3 rounded-lg border border-border bg-card p-6">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brand-red" aria-hidden="true" />
          <div>
            <p className="font-medium text-navy">Owner only</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI Site Agent is available to the site owner only.
            </p>
          </div>
        </div>
      ) : (
        <SiteAiAgent />
      )}
    </AppShell>
  );
}
