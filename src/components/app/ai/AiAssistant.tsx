import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, FileDown, Loader2, Plus, Send, ShieldCheck, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAiWorkspace } from "@/lib/ai/useAiWorkspace";
import { runSuperAgent } from "@/lib/ai/engine";
import {
  createConversation,
  insertMessage,
  useMessages,
  type MessageRow,
} from "@/lib/ai/conversations";
import {
  decideApproval,
  executeApprovedAction,
  saveApprovalRequest,
  type ApprovalRequest,
} from "@/lib/ai/approvals";
import { suggestionsForRoute } from "@/lib/ai/router";
import { getAiProviderStatus } from "@/lib/ai/provider.functions";
import { agentLabel } from "@/lib/ai/agents";
import { downloadBlob } from "@/lib/storage-client";
import type { AiAnswer, AiSource, ToolRunLog } from "@/lib/ai/types";

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-foreground prose-headings:text-navy prose-strong:text-navy prose-code:text-navy prose-pre:bg-secondary prose-pre:text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

function SourceChips({ sources }: { sources: AiSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Sources
      </span>
      {sources.slice(0, 12).map((s, i) => (
        <Badge
          key={`${s.type}-${s.entityId ?? i}`}
          variant="outline"
          className="max-w-[16rem] truncate text-[0.7rem] font-normal"
        >
          {s.label}
        </Badge>
      ))}
    </div>
  );
}

function ToolActivity({ runs }: { runs: ToolRunLog[] }) {
  const [open, setOpen] = useState(false);
  if (!runs?.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[0.72rem] text-muted-foreground">
          <Wrench className="mr-1.5 size-3.5" />
          Tool activity ({runs.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 rounded-md border border-border bg-secondary/40 p-2 text-[0.72rem]">
        {runs.map((r, i) => (
          <div key={`${r.toolName}-${i}`} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="font-medium text-navy">{r.toolLabel}</span>{" "}
              <span className="text-muted-foreground">· {agentLabel(r.agent)}</span>
            </span>
            <span className={r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
              {r.status} · {r.durationMs}ms
            </span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function confidenceTone(v: number) {
  if (v >= 0.8) return "border-emerald-600/40 bg-emerald-50 text-emerald-800";
  if (v >= 0.55) return "border-amber-600/40 bg-amber-50 text-amber-800";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

type PendingApproval = { approval: ApprovalRequest; approvalId: string };

export function AiAssistant({
  conversationId,
  onConversationCreated,
  compact,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { context, seedPrompt, setSeedPrompt } = useAiWorkspace();
  const { data: messages = [] } = useMessages(conversationId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: providerStatus } = useQuery({
    queryKey: ["ai-provider-status"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => getAiProviderStatus(),
  });
  const liveMode = providerStatus?.mode === "live";

  const suggestions = useMemo(() => suggestionsForRoute(context.route), [context.route]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (seedPrompt) {
      setInput(seedPrompt);
      setSeedPrompt(null);
      inputRef.current?.focus();
    }
  }, [seedPrompt, setSeedPrompt]);

  async function send(promptText: string) {
    const prompt = promptText.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Your session expired. Sign in again.");

      let convId = conversationId;
      if (!convId) {
        convId = await createConversation({
          projectId: context.projectId,
          title: prompt.slice(0, 80),
          userId,
        });
        onConversationCreated(convId);
        qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      await insertMessage({ conversationId: convId, role: "user", content: prompt });
      qc.invalidateQueries({ queryKey: ["ai-messages", convId] });

      const answer: AiAnswer = await runSuperAgent({
        prompt,
        context,
        conversationId: convId,
        userId,
        liveMode,
      });

      const messageId = await insertMessage({
        conversationId: convId,
        role: "assistant",
        content: answer.text,
        answer,
      });

      if (answer.approval) {
        const approvalId = await saveApprovalRequest({
          approval: answer.approval,
          conversationId: convId,
          messageId,
          projectId: context.projectId,
          userId,
        });
        setPending({ approval: answer.approval, approvalId });
      }

      qc.invalidateQueries({ queryKey: ["ai-messages", convId] });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant could not complete that request.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function confirmAction() {
    if (!pending || !conversationId) return;
    setActionBusy(true);
    setError(null);
    try {
      const resultText = await executeApprovedAction(pending.approval);
      await decideApproval(pending.approvalId, "approved", { message: resultText });
      await insertMessage({
        conversationId,
        role: "assistant",
        content: `✅ **Approved action completed.**\n\n${resultText}`,
      });
      setPending(null);
      qc.invalidateQueries({ queryKey: ["ai-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["exports"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The approved action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectAction() {
    if (!pending) return;
    await decideApproval(pending.approvalId, "rejected");
    setPending(null);
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function exportConversation() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(22, 35, 59);
    doc.rect(0, 0, width, 56, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("AWM Construction Super Agent — Conversation", 40, 34);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let y = 80;
    messages.forEach((m) => {
      const header = `${m.role === "user" ? "You" : agentLabel((m.agent_key ?? "general") as never)} · ${new Date(m.created_at).toLocaleString()}`;
      doc.setFont("helvetica", "bold");
      if (y > 720) {
        doc.addPage();
        y = 60;
      }
      doc.text(header, 40, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(m.content.replace(/\*\*/g, ""), width - 80) as string[];
      lines.forEach((line) => {
        if (y > 740) {
          doc.addPage();
          y = 60;
        }
        doc.text(line, 40, y);
        y += 12;
      });
      y += 10;
    });
    await downloadBlob(doc.output("blob"), "AWM-AI-Conversation.pdf");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Context indicator */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-secondary/40 px-3 py-2 text-[0.7rem]">
        <Badge variant="secondary" className="font-normal">
          {context.projectName ? `Project: ${context.projectName}` : "No project selected"}
        </Badge>
        <Badge variant="outline" className="font-normal">
          Screen: {context.routeLabel}
        </Badge>
        {context.sheetLabel ? (
          <Badge variant="outline" className="font-normal">
            Sheet: {context.sheetLabel}
          </Badge>
        ) : null}
        {context.itemMark ? (
          <Badge variant="outline" className="font-normal">
            Item: {context.itemMark}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={`ml-auto font-medium ${liveMode ? "border-emerald-600/40 text-emerald-700" : "border-amber-600/40 text-amber-700"}`}
        >
          {liveMode ? "Live AI" : "Demo AI Mode"}
        </Badge>
      </div>

      {/* Transcript */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {messages.length === 0 && !busy ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-navy">AWM Construction Super Agent</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One assistant, routed internally to the Takeoff, Schedule, Jurisdiction, Safety, YKK,
              Quote Readiness, Export and Quality specialists. Counts and totals come straight from
              the database — never estimated.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-navy transition-colors hover:border-primary hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m: MessageRow) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-full">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-navy">
                  {agentLabel((m.agent_key ?? "general") as never)}
                </span>
                {m.confidence != null ? (
                  <Badge
                    variant="outline"
                    className={`text-[0.68rem] font-normal ${confidenceTone(Number(m.confidence))}`}
                  >
                    Confidence {(Number(m.confidence) * 100).toFixed(0)}%
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[0.68rem] font-normal">
                  {m.mode === "live" ? "Model-narrated" : "Deterministic"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 px-1.5 text-[0.7rem] text-muted-foreground"
                  onClick={() => copy(m.content, m.id)}
                >
                  {copied === m.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <Markdown>{m.content}</Markdown>
              <SourceChips sources={m.sources ?? []} />
              <ToolActivity runs={m.tool_activity ?? []} />
            </div>
          ),
        )}

        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Querying project data…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {/* Approval gate */}
      {pending ? (
        <div className="border-t border-amber-500/40 bg-amber-50 px-3 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <ShieldCheck className="size-4" /> Approval required
          </p>
          <p className="mt-1 text-sm text-amber-950">{pending.approval.summary}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={confirmAction} disabled={actionBusy}>
              {actionBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Confirm and run
            </Button>
            <Button size="sm" variant="outline" onClick={rejectAction} disabled={actionBusy}>
              <X className="mr-2 size-4" /> Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-3">
        {messages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.slice(0, compact ? 2 : 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border px-2.5 py-1 text-[0.7rem] text-muted-foreground transition-colors hover:border-primary hover:text-navy"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={compact ? 2 : 3}
            placeholder="Ask about counts, schedules, jurisdiction, safety, YKK mapping, quote readiness or exports…"
            className="min-h-0 resize-none"
            aria-label="Message the AWM Construction Super Agent"
          />
          <Button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            size="icon"
            aria-label="Send message"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[0.68rem] text-muted-foreground">
            Read-only lookups run automatically. Exports, drafts and memory require your
            confirmation.
          </p>
          {messages.length ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[0.7rem]"
              onClick={exportConversation}
            >
              <FileDown className="mr-1.5 size-3.5" /> Export PDF
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProjectSelector({ className }: { className?: string }) {
  const { context, setSelection } = useAiWorkspace();
  const { data: projects = [] } = useQuery({
    queryKey: ["ai-project-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-scope to the only project so the assistant is useful immediately.
  useEffect(() => {
    if (!context.projectId && projects.length === 1) {
      setSelection({ projectId: projects[0].id, projectName: projects[0].name });
    }
  }, [context.projectId, projects, setSelection]);

  if (projects.length === 0) return null;

  return (
    <Select
      value={context.projectId ?? ""}
      onValueChange={(id) =>
        setSelection({
          projectId: id,
          projectName: projects.find((p) => p.id === id)?.name ?? null,
        })
      }
    >
      <SelectTrigger className={className} aria-label="Assistant project context">
        <SelectValue placeholder="Select project context" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NewConversationButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Plus className="mr-2 size-4" /> New conversation
    </Button>
  );
}

export { Input as AiSearchInput };
