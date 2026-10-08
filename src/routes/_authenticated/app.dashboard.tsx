import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, FileStack, Gavel, Ruler } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AWM Takeoff AI" },
      { name: "description", content: "AWM Takeoff AI workspace dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <Icon className="size-5 text-bronze" aria-hidden="true" />
      <p className="mt-4 font-serif text-3xl text-navy">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [projects, documents, takeoff, jurisdiction] = await Promise.all([
        supabase
          .from("projects")
          .select("id,name,status,city,project_type,updated_at")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("takeoff_items").select("quantity"),
        supabase.from("jurisdiction_records").select("id", { count: "exact", head: true }),
      ]);
      const openings = (takeoff.data ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0);
      return {
        projects: projects.data ?? [],
        documentCount: documents.count ?? 0,
        openings,
        jurisdictionCount: jurisdiction.count ?? 0,
      };
    },
  });

  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button asChild size="sm">
          <Link to="/app/projects">Go to projects</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Projects"
          value={isLoading ? "—" : data!.projects.length}
        />
        <StatCard
          icon={FileStack}
          label="Plan documents"
          value={isLoading ? "—" : data!.documentCount}
        />
        <StatCard
          icon={Ruler}
          label="Openings in takeoff"
          value={isLoading ? "—" : data!.openings}
        />
        <StatCard
          icon={Gavel}
          label="Jurisdiction records"
          value={isLoading ? "—" : data!.jurisdictionCount}
        />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-serif text-xl text-navy">Recent projects</h2>
        </div>
        <div className="p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data!.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects yet. Create your first project from the Projects page.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.projects.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-navy">{p.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[p.project_type, p.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">{p.status.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
