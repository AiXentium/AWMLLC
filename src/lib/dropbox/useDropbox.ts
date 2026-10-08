import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import type { CloudStatus } from "@/lib/cloud/shared";
import { DROPBOX_RETURN_PATH } from "./dropbox-shared";
import { disconnectDropbox, getDropboxStatus, startDropboxConnect } from "./dropbox.functions";

/** Dropbox connection state + popup-based connect/disconnect. */
export function useDropboxStatus() {
  return useQuery<CloudStatus>({
    queryKey: ["dropbox-status"],
    staleTime: 30_000,
    queryFn: () => getDropboxStatus(),
  });
}

export function useDropboxConnect() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    // The popup must open inside the click gesture, before any await.
    const popup = window.open("about:blank", "awm-dropbox", "width=520,height=680");
    try {
      const { url } = await startDropboxConnect({
        data: { returnUrl: `${window.location.origin}${DROPBOX_RETURN_PATH}` },
      });
      if (!popup) {
        window.location.href = url;
        return;
      }
      popup.location.href = url;
      await new Promise<void>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          const data = event.data as { type?: string; connectorId?: string } | null;
          if (data?.connectorId !== "dropbox") return;
          if (
            data.type !== "appUserConnectorOAuthComplete" &&
            data.type !== "appUserConnectorOAuthFailed"
          )
            return;
          window.removeEventListener("message", onMessage);
          clearInterval(timer);
          if (data.type === "appUserConnectorOAuthFailed") toast.error("Dropbox was not connected");
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
        queryKey: ["dropbox-status"],
        queryFn: () => getDropboxStatus(),
      });
      if (status.connected) {
        toast.success("Dropbox connected", { description: status.accountEmail ?? undefined });
        await logAudit({
          projectId: null,
          action: "dropbox.connected",
          detail: { account: status.accountEmail },
        });
      }
    } catch (err) {
      popup?.close();
      toast.error("Could not start the Dropbox connection", {
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setConnecting(false);
      await qc.invalidateQueries({ queryKey: ["dropbox-status"] });
    }
  }, [qc]);

  const disconnect = useMutation({
    mutationFn: () => disconnectDropbox(),
    onSuccess: async () => {
      await logAudit({ projectId: null, action: "dropbox.disconnected" });
      await qc.invalidateQueries({ queryKey: ["dropbox-status"] });
      toast.success("Dropbox disconnected");
    },
    onError: (err: Error) => toast.error("Could not disconnect", { description: err.message }),
  });

  return { connect, connecting, disconnect };
}
