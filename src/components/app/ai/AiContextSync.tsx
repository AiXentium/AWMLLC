import { useEffect } from "react";
import { useAiWorkspace } from "@/lib/ai/useAiWorkspace";

/**
 * Renders nothing. Publishes the current workspace selection (project, sheet,
 * takeoff item) so the assistant always knows what the user is looking at.
 */
export function AiContextSync(props: {
  projectId?: string | null;
  projectName?: string | null;
  pageId?: string | null;
  sheetLabel?: string | null;
  itemId?: string | null;
  itemMark?: string | null;
}) {
  const { setSelection } = useAiWorkspace();
  const { projectId, projectName, pageId, sheetLabel, itemId, itemMark } = props;

  useEffect(() => {
    setSelection({ projectId, projectName, pageId, sheetLabel, itemId, itemMark });
  }, [setSelection, projectId, projectName, pageId, sheetLabel, itemId, itemMark]);

  return null;
}
