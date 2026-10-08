import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AiAssistant, ProjectSelector } from "@/components/app/ai/AiAssistant";
import { AGENTS, INACTIVE_MODULES } from "@/lib/ai/agents";
import { useConversationMutations, useConversations } from "@/lib/ai/conversations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app/ai")({
  head: () => ({
    meta: [
      { title: "AI Workspace — AWM Takeoff AI" },
      {
        name: "description",
        content:
          "The AWM Construction Super Agent workspace: project-aware answers, sources, and audited actions.",
      },
      { property: "og:title", content: "AI Workspace — AWM Takeoff AI" },
      {
        property: "og:description",
        content:
          "Project-aware construction AI for takeoffs, schedules, jurisdiction, safety and quoting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiWorkspacePage,
});

function AiWorkspacePage() {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: conversations = [] } = useConversations(search, includeArchived);
  const { archive, remove } = useConversationMutations();

  return (
    <AppShell
      title="AI Workspace"
      subtitle="One assistant, routed internally to construction specialists. Every number comes from your project database, with sources attached."
      actions={
        <>
          <ProjectSelector className="h-10 w-[16rem]" />
          <Button onClick={() => setConversationId(null)}>
            <Plus className="mr-2 size-4" /> New conversation
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[19rem_1fr_17rem]">
        {/* Conversation history */}
        <Card className="order-2 xl:order-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
            <div className="flex items-center gap-2">
              <Switch
                id="archived"
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
              />
              <Label htmlFor="archived" className="text-xs text-muted-foreground">
                Show archived
              </Label>
            </div>
            <div className="max-h-[26rem] space-y-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No conversations yet.
                </p>
              ) : null}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${
                    conversationId === c.id
                      ? "border-primary bg-secondary"
                      : "border-transparent hover:bg-secondary/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setConversationId(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm text-navy">
                      {c.title ?? "Untitled"}
                    </span>
                    <span className="block text-[0.68rem] text-muted-foreground">
                      {c.scope === "project" ? "Project" : "Workspace"} ·{" "}
                      {new Date(c.last_message_at).toLocaleDateString()}
                      {c.archived ? " · archived" : ""}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label="Conversation options"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => archive.mutate({ id: c.id, archived: !c.archived })}
                      >
                        {c.archived ? (
                          <ArchiveRestore className="mr-2 size-4" />
                        ) : (
                          <Archive className="mr-2 size-4" />
                        )}
                        {c.archived ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          remove.mutate(c.id);
                          if (conversationId === c.id) setConversationId(null);
                        }}
                      >
                        <Trash2 className="mr-2 size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="order-1 flex h-[42rem] min-h-0 flex-col overflow-hidden p-0 xl:order-2">
          <AiAssistant
            conversationId={conversationId}
            onConversationCreated={(id) => {
              setConversationId(id);
              qc.invalidateQueries({ queryKey: ["ai-conversations"] });
            }}
          />
        </Card>

        {/* Specialists */}
        <div className="order-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active specialists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(AGENTS)
                .filter(([key]) => key !== "general")
                .map(([key, a]) => (
                  <div key={key} className="rounded-md border border-border p-2">
                    <p className="text-xs font-semibold text-navy">{a.label}</p>
                    <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">
                      {a.blurb}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Future trade modules</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {INACTIVE_MODULES.map((m) => (
                <Badge key={m} variant="outline" className="font-normal text-muted-foreground">
                  {m} · inactive
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
