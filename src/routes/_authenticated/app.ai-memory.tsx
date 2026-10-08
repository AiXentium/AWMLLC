import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, Power, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemories, useMemoryMutations } from "@/lib/ai/memory";

export const Route = createFileRoute("/_authenticated/app/ai-memory")({
  head: () => ({
    meta: [
      { title: "AI Memory — AWM Takeoff AI" },
      {
        name: "description",
        content:
          "Review, approve, edit and disable what the AWM Construction Super Agent remembers.",
      },
      { property: "og:title", content: "AI Memory — AWM Takeoff AI" },
      {
        property: "og:description",
        content: "Approval-gated project and company memory for the AWM construction assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiMemoryPage,
});

function AiMemoryPage() {
  const [scope, setScope] = useState<"all" | "conversation" | "project" | "company">("all");
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftScope, setDraftScope] = useState<"project" | "company">("company");
  const { data: memories = [] } = useMemories(scope);
  const { propose, approve, setDisabled, update, remove } = useMemoryMutations();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const pending = memories.filter((m) => !m.approved);

  return (
    <AppShell
      title="AI Memory"
      subtitle="Nothing is remembered permanently without your approval. Conversation memory is temporary; project and company memory must be approved here."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="conversation">Conversation</TabsTrigger>
              <TabsTrigger value="project">Project</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
            </TabsList>
          </Tabs>

          {pending.length ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {pending.length} memory item{pending.length === 1 ? "" : "s"} awaiting your approval.
            </p>
          ) : null}

          {memories.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No memory recorded yet.
              </CardContent>
            </Card>
          ) : null}

          {memories.map((m) => (
            <Card key={m.id} className={m.disabled ? "opacity-60" : undefined}>
              <CardHeader className="flex-row items-center gap-2 pb-2">
                <CardTitle className="text-sm">{m.title ?? "Memory note"}</CardTitle>
                <Badge variant="outline" className="font-normal capitalize">
                  {m.scope}
                </Badge>
                <Badge
                  variant="outline"
                  className={`font-normal ${m.approved ? "border-emerald-600/40 text-emerald-700" : "border-amber-600/40 text-amber-700"}`}
                >
                  {m.approved ? "Approved" : "Pending approval"}
                </Badge>
                {m.disabled ? (
                  <Badge variant="outline" className="font-normal">
                    Disabled
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={editing[m.id] ?? m.content}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  rows={3}
                  aria-label="Memory content"
                />
                <div className="flex flex-wrap gap-2">
                  {!m.approved ? (
                    <Button
                      size="sm"
                      onClick={() => approve.mutate({ id: m.id, content: editing[m.id] })}
                    >
                      <Check className="mr-2 size-4" /> Approve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(editing[m.id] ?? m.content) === m.content}
                      onClick={() =>
                        update.mutate({ id: m.id, content: editing[m.id] ?? m.content })
                      }
                    >
                      Save edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDisabled.mutate({ id: m.id, disabled: !m.disabled })}
                  >
                    <Power className="mr-2 size-4" /> {m.disabled ? "Enable" : "Disable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove.mutate(m.id)}
                  >
                    <Trash2 className="mr-2 size-4" /> Delete
                  </Button>
                </div>
                <p className="text-[0.68rem] text-muted-foreground">
                  Added {new Date(m.created_at).toLocaleString()}
                  {m.approved_at
                    ? ` · approved ${new Date(m.approved_at).toLocaleDateString()}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mem-title">Title</Label>
              <Input
                id="mem-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Standard mull note"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-scope">Scope</Label>
              <Select
                value={draftScope}
                onValueChange={(v) => setDraftScope(v as typeof draftScope)}
              >
                <SelectTrigger id="mem-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project memory</SelectItem>
                  <SelectItem value="company">Company memory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-content">Content</Label>
              <Textarea
                id="mem-content"
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!draft.trim() || propose.isPending}
              onClick={() =>
                propose.mutate(
                  {
                    scope: draftScope,
                    content: draft.trim(),
                    title: draftTitle.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setDraft("");
                      setDraftTitle("");
                    },
                  },
                )
              }
            >
              <Plus className="mr-2 size-4" /> Propose memory
            </Button>
            <p className="text-[0.68rem] text-muted-foreground">
              Proposed memory stays inactive until approved above.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
