import { useCallback, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AiWorkspaceContext, type AiWorkspaceCtx, type WorkspaceSelection } from "./useAiWorkspace";

const ROUTE_LABELS: [RegExp, string][] = [
  [/\/app\/dashboard/, "Dashboard"],
  [/\/app\/projects\/[^/]+/, "Project workspace"],
  [/\/app\/projects/, "Projects"],
  [/\/app\/incoming-files/, "Incoming Files"],
  [/\/app\/pages/, "Pages"],
  [/\/app\/viewer/, "Viewer"],
  [/\/app\/schedules/, "Schedules"],
  [/\/app\/jurisdiction/, "Jurisdiction"],
  [/\/app\/ykk-integration/, "YKK Integration"],
  [/\/app\/ykk-automation/, "YKK Automation"],
  [/\/app\/ai-memory/, "AI Memory"],
  [/\/app\/ai-settings/, "AI Settings"],
  [/\/app\/ai/, "AI Workspace"],
];

export function AiWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [selection, setSelectionState] = useState<WorkspaceSelection>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);

  const setSelection = useCallback((next: WorkspaceSelection) => {
    setSelectionState((prev) => {
      const merged = { ...prev, ...next };
      const changed = (Object.keys(merged) as (keyof WorkspaceSelection)[]).some(
        (k) => merged[k] !== prev[k],
      );
      return changed ? merged : prev;
    });
  }, []);

  const value = useMemo<AiWorkspaceCtx>(() => {
    const routeLabel = ROUTE_LABELS.find(([re]) => re.test(pathname))?.[1] ?? "Workspace";
    return {
      context: {
        projectId: selection.projectId ?? null,
        projectName: selection.projectName ?? null,
        route: pathname,
        routeLabel,
        pageId: selection.pageId ?? null,
        sheetLabel: selection.sheetLabel ?? null,
        itemId: selection.itemId ?? null,
        itemMark: selection.itemMark ?? null,
      },
      setSelection,
      panelOpen,
      setPanelOpen,
      togglePanel: () => setPanelOpen((o) => !o),
      seedPrompt,
      setSeedPrompt,
    };
  }, [pathname, selection, panelOpen, seedPrompt, setSelection]);

  return <AiWorkspaceContext.Provider value={value}>{children}</AiWorkspaceContext.Provider>;
}
