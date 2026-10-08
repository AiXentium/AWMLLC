import { createContext, useContext } from "react";
import type { QueueItem } from "@/lib/intake/useIntakeQueue";
import type { ProcessingState } from "@/lib/intake/processor";
import type { IntakeLimits } from "@/lib/intake/shared";

export type UploadContextValue = {
  projectId: string;
  canEdit: boolean;
  items: QueueItem[];
  busy: boolean;
  processing: ProcessingState;
  limits: IntakeLimits;
  enqueue: (files: File[]) => Promise<void> | void;
  cancelItem: (key: string) => void;
  retryItem: (key: string, allowDuplicate?: boolean) => void;
  clearFinished: () => void;
  openUpload: () => void;
};

export const UploadContext = createContext<UploadContextValue | null>(null);

/** Single source of truth for document intake inside a project workspace. */
export function useProjectUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useProjectUpload must be used inside ProjectUploadProvider");
  return ctx;
}
