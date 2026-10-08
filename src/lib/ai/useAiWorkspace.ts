import { createContext, useContext } from "react";
import type { AiContext } from "./types";

export type WorkspaceSelection = {
  projectId?: string | null;
  projectName?: string | null;
  pageId?: string | null;
  sheetLabel?: string | null;
  itemId?: string | null;
  itemMark?: string | null;
};

export type AiWorkspaceCtx = {
  context: AiContext;
  setSelection: (next: WorkspaceSelection) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  seedPrompt: string | null;
  setSeedPrompt: (p: string | null) => void;
};

export const AiWorkspaceContext = createContext<AiWorkspaceCtx | null>(null);

export function useAiWorkspace() {
  const ctx = useContext(AiWorkspaceContext);
  if (!ctx) throw new Error("useAiWorkspace must be used inside AiWorkspaceProvider");
  return ctx;
}
