/**
 * Private AI Site Agent — owner-only chat interface for editing the public
 * website's CMS pages with plain-English instructions.
 *
 * Flow: pick a page → type an instruction → the AI proposes updated sections
 * → preview renders with PageSections → Washington clicks Apply to save
 * (via useSaveSitePage) or Discard to revert. Nothing saves without approval.
 */
import { useMemo, useRef, useState } from "react";
import { Bot, Check, Loader2, Send, Sparkles, Undo2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSections } from "@/components/site/PageSections";
import {
  useSaveSitePage,
  useSitePages,
  type SitePageInput,
  type SiteSection,
} from "@/lib/site-pages";
import { siteAiEdit } from "@/lib/site-ai.functions";
import { cn } from "@/lib/utils";

const PAGE_ORDER = ["home", "products", "resources", "about", "contact"];

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface Proposal {
  sections: SiteSection[];
  summary: string;
  provider: string;
  model: string;
  changedIds: string[];
}

function sectionLabel(s: SiteSection): string {
  return s.heading || s.eyebrow || `${s.type} section`;
}

function diffSections(before: SiteSection[], after: SiteSection[]): string[] {
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const changed: string[] = [];
  for (const s of after) {
    const prev = beforeById.get(s.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(s)) changed.push(s.id);
  }
  return changed;
}

export function SiteAiAgent() {
  const { data: pages = [], isLoading, isError } = useSitePages();
  const save = useSaveSitePage();

  const [slug, setSlug] = useState("home");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const msgId = useRef(0);

  const page = useMemo(() => pages.find((p) => p.slug === slug) ?? null, [pages, slug]);
  const currentSections = useMemo(
    () => (page?.content.sections ?? []).slice().sort((a, b) => a.order - b.order),
    [page],
  );

  const pushMessage = (role: "user" | "ai", text: string) => {
    msgId.current += 1;
    setMessages((m) => [...m, { id: `msg-${msgId.current}`, role, text }]);
  };

  const handleSubmit = async () => {
    const instruction = input.trim();
    if (!instruction || working || !page) return;
    setWorking(true);
    setNotice(null);
    setProposal(null);
    pushMessage("user", instruction);
    setInput("");
    try {
      const result = await siteAiEdit({
        data: { pageSlug: slug, instruction, sections: currentSections },
      });
      if (!result.ok) {
        pushMessage("ai", `I couldn't apply that: ${result.error}`);
      } else {
        const changedIds = diffSections(currentSections, result.sections);
        setProposal({
          sections: result.sections,
          summary: result.summary,
          provider: result.provider,
          model: result.model,
          changedIds,
        });
        pushMessage(
          "ai",
          changedIds.length === 0
            ? `No changes needed — ${result.summary}`
            : `${result.summary} Review the preview below, then Apply or Discard.`,
        );
      }
    } catch (error) {
      pushMessage(
        "ai",
        `Something went wrong: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setWorking(false);
    }
  };

  const handleApply = () => {
    if (!page || !proposal) return;
    const payload: SitePageInput = {
      title: page.title,
      content: { sections: proposal.sections },
      is_published: page.is_published,
    };
    save.mutate(
      { id: page.id, input: payload },
      {
        onSuccess: () => {
          setNotice({ kind: "ok", text: "Changes applied and saved." });
          setProposal(null);
        },
        onError: (error) => {
          setNotice({ kind: "err", text: error instanceof Error ? error.message : "Save failed." });
        },
      },
    );
  };

  const handleDiscard = () => {
    setProposal(null);
    setNotice(null);
    pushMessage("ai", "Discarded — the page is unchanged.");
  };

  const changedSections = useMemo(() => {
    if (!proposal) return [];
    const byId = new Map(proposal.sections.map((s) => [s.id, s]));
    return proposal.changedIds
      .map((id) => byId.get(id))
      .filter((s): s is SiteSection => Boolean(s));
  }, [proposal]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading pages…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-destructive">Could not load site pages.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Chat panel */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <Label htmlFor="ai-page">Page</Label>
          <Select
            value={slug}
            onValueChange={(v) => {
              setSlug(v);
              setProposal(null);
              setNotice(null);
            }}
          >
            <SelectTrigger id="ai-page" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!page ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This page has no saved CMS content yet. Create sections in the Site Editor first — the
              AI can only edit what exists.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {currentSections.length} section{currentSections.length === 1 ? "" : "s"} loaded
              {page.is_published ? " · published" : " · draft"}.
            </p>
          )}
        </div>

        <div
          className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto p-4"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="size-4 text-brand-red" aria-hidden="true" />
                Tell me what to change
              </p>
              <p className="mt-2">Try:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>“Change the hero headline to ‘Windows That Work as Hard as You Do’”</li>
                <li>“Make the about page intro shorter”</li>
                <li>“Change the CTA button text to ‘Get My Quote’”</li>
              </ul>
              <p className="mt-2">
                I’ll propose the change for your approval — nothing saves until you click Apply.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2 rounded-md p-3 text-sm",
                  m.role === "user" ? "bg-primary/5" : "bg-muted/60",
                )}
              >
                {m.role === "user" ? (
                  <User className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Bot className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              </div>
            ))
          )}
          {working ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Working on it…
            </div>
          ) : null}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Describe the change…"
              disabled={working || !page}
              aria-label="Instruction for the AI site agent"
            />
            <Button
              onClick={() => void handleSubmit()}
              disabled={working || !page || !input.trim()}
              size="icon"
              aria-label="Send instruction"
            >
              {working ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          {notice ? (
            <p
              className={cn(
                "mt-3 text-sm",
                notice.kind === "ok" ? "text-emerald-600" : "text-destructive",
              )}
            >
              {notice.text}
            </p>
          ) : null}
        </div>
      </div>

      {/* Preview panel */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-serif text-lg text-navy">Preview</h2>
            {proposal ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {proposal.changedIds.length} section{proposal.changedIds.length === 1 ? "" : "s"}{" "}
                  changed
                </Badge>
                <span>
                  via {proposal.provider}/{proposal.model}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Current saved content — proposals appear here.
              </p>
            )}
          </div>
          {proposal ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDiscard} disabled={save.isPending}>
                <Undo2 className="size-4" aria-hidden="true" /> Discard
              </Button>
              <Button onClick={handleApply} disabled={save.isPending}>
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                Apply changes
              </Button>
            </div>
          ) : null}
        </div>

        {proposal && changedSections.length > 0 ? (
          <div className="border-b border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy">
              Changed sections
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {changedSections.map((s) => (
                <li key={s.id}>
                  <Badge
                    variant="outline"
                    className="border-brand-red/30 bg-brand-red/5 text-brand-red"
                  >
                    {s.type} · {sectionLabel(s)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-[70vh] overflow-y-auto">
          <PageSections sections={proposal?.sections ?? currentSections} />
        </div>
      </div>
    </div>
  );
}
