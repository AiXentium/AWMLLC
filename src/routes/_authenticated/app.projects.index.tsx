import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ImportBlueprintDialog } from "@/components/app/project/ImportBlueprintDialog";

export const Route = createFileRoute("/_authenticated/app/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — AWM Takeoff AI" },
      { name: "description", content: "All AWM Takeoff AI projects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "review", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "ready_for_quote", label: "Ready for Quote" },
  { key: "completed", label: "Completed" },
  { key: "on_hold", label: "On Hold" },
  { key: "archived", label: "Archived" },
] as const;

function ProjectsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    project_type: "",
    city: "",
    address: "",
    description: "",
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,city,project_type,address,updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out. Sign in again.");
      const { error } = await supabase.from("projects").insert({
        name: form.name.trim(),
        project_type: form.project_type.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        owner_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", project_type: "", city: "", address: "", description: "" });
      setError(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const visible = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <AppShell
      title="Projects"
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="mr-2 size-4" aria-hidden="true" />
            Import Blueprint
          </Button>
          <ImportBlueprintDialog open={importOpen} onOpenChange={setImportOpen} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 size-4" aria-hidden="true" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif text-navy">New project</DialogTitle>
                <DialogDescription>
                  Projects are private to you and the team you share them with.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="p-name">Project name</Label>
                  <Input
                    id="p-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-type">Project type</Label>
                    <Input
                      id="p-type"
                      placeholder="Multifamily · 148 units"
                      value={form.project_type}
                      onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-city">City</Label>
                    <Input
                      id="p-city"
                      placeholder="Sarasota, FL"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-address">Project address</Label>
                  <Input
                    id="p-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Textarea
                    id="p-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-navy">
                Project
              </th>
              <th scope="col" className="hidden px-4 py-3 font-medium text-navy sm:table-cell">
                Type
              </th>
              <th scope="col" className="hidden px-4 py-3 font-medium text-navy md:table-cell">
                Location
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-navy">
                Documents
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  No projects in this view.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium text-navy">
                    <Link
                      to="/app/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {p.project_type ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {p.city ?? p.address ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant="secondary">{p.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/app/projects/$projectId"
                        params={{ projectId: p.id }}
                        search={{ upload: true }}
                      >
                        <Upload className="mr-2 size-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Upload Documents</span>
                        <span className="sm:hidden">Upload</span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
