import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Maximize2, MessageSquareText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiWorkspace } from "@/lib/ai/useAiWorkspace";
import { AiAssistant, ProjectSelector } from "./AiAssistant";

/** Persistent assistant launcher + docked right-side panel available on every workspace screen. */
export function AiDock() {
  const { panelOpen, setPanelOpen } = useAiWorkspace();
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <>
      {!panelOpen ? (
        <Button
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg"
          aria-label="Open the AWM Construction Super Agent"
        >
          <MessageSquareText className="size-5" />
          <span className="hidden sm:inline">Ask AWM AI</span>
        </Button>
      ) : null}

      {panelOpen ? (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col border-l border-border bg-card shadow-2xl"
          aria-label="AWM Construction Super Agent"
        >
          <div className="flex items-center gap-2 border-b border-border bg-navy px-3 py-2.5 text-navy-foreground">
            <MessageSquareText className="size-4" />
            <p className="text-sm font-semibold">AWM Construction Super Agent</p>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="New conversation"
                className="size-8 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                onClick={() => setConversationId(null)}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                asChild
                size="icon"
                variant="ghost"
                aria-label="Open full AI workspace"
                className="size-8 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                <Link to="/app/ai" onClick={() => setPanelOpen(false)}>
                  <Maximize2 className="size-4" />
                </Link>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close assistant"
                className="size-8 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                onClick={() => setPanelOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="border-b border-border px-3 py-2">
            <ProjectSelector className="h-9" />
          </div>
          <div className="min-h-0 flex-1">
            <AiAssistant
              compact
              conversationId={conversationId}
              onConversationCreated={setConversationId}
            />
          </div>
        </aside>
      ) : null}
    </>
  );
}
