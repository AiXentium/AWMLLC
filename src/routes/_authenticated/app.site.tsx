import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { SiteEditor } from "@/components/app/site/SiteEditor";

export const Route = createFileRoute("/_authenticated/app/site")({
  head: () => ({
    meta: [
      { title: "Site Editor — AWM Takeoff AI" },
      { name: "description", content: "Visually edit the public website's pages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SiteEditorPage,
});

function SiteEditorPage() {
  return (
    <AppShell
      title="Site Editor"
      subtitle="Edit the public website's pages visually — sections update live as you type, then save to publish."
    >
      <SiteEditor />
    </AppShell>
  );
}
