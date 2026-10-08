import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  completeDriveConnect,
  disconnectDrive,
  getDriveStatus,
  startDriveConnect,
} from "./drive.functions";
import type { DriveStatus } from "./drive-shared";

export const DRIVE_RETURN_PATH = "/oauth/google/return";

/** Google Drive connection state + popup-based connect/disconnect. */
export function useDriveStatus() {
  return useQuery<DriveStatus>({
    queryKey: ["drive-status"],
    staleTime: 30_000,
    queryFn: () => getDriveStatus(),
  });
}

export function useDriveConnect() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    // The popup must open inside the click gesture, before any await.
    const popup = window.open("about:blank", "awm-google-drive", "width=520,height=680");
    try {
      const { url } = await startDriveConnect({
        data: { returnUrl: `${window.location.origin}${DRIVE_RETURN_PATH}` },
      });
      if (!popup) {
        window.location.href = url;
        return;
      }
      popup.location.href = url;
      await new Promise<void>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          const type = (event.data as { type?: string } | null)?.type;
          if (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
            return;
          window.removeEventListener("message", onMessage);
          clearInterval(timer);
          if (type === "appUserConnectorOAuthFailed") toast.error("Google Drive was not connected");
          resolve();
        };
        window.addEventListener("message", onMessage);
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener("message", onMessage);
            resolve();
          }
        }, 700);
      });
      const status = await qc.fetchQuery({
        queryKey: ["drive-status"],
        queryFn: () => getDriveStatus(),
      });
      if (status.connected) {
        toast.success("Google Drive connected", { description: status.accountEmail ?? undefined });
        await logAudit({
          projectId: null,
          action: "drive.connected",
          detail: { account: status.accountEmail },
        });
      }
    } catch (err) {
      popup?.close();
      toast.error("Could not start the Google connection", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setConnecting(false);
      await qc.invalidateQueries({ queryKey: ["drive-status"] });
    }
  }, [qc]);

  const disconnect = useMutation({
    mutationFn: () => disconnectDrive(),
    onSuccess: async () => {
      await logAudit({ projectId: null, action: "drive.disconnected" });
      await qc.invalidateQueries({ queryKey: ["drive-status"] });
      toast.success("Google Drive disconnected");
    },
    onError: (err: Error) => toast.error("Could not disconnect", { description: err.message }),
  });

  return { connect, connecting, disconnect };
}

export { completeDriveConnect };
