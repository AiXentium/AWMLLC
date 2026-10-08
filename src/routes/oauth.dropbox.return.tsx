import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { completeDropboxConnect } from "@/lib/dropbox/dropbox.functions";
import { DROPBOX_RETURN_PATH } from "@/lib/dropbox/dropbox-shared";

export const Route = createFileRoute("/oauth/dropbox/return")({
  head: () => ({
    meta: [
      { title: "Finishing Dropbox connection — AWM Takeoff AI" },
      {
        name: "description",
        content: "Completing the secure Dropbox connection for AWM Takeoff AI.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DropboxReturn,
  errorComponent: () => (
    <Shell message="The Dropbox connection could not be completed. Close this window and try again." />
  ),
});

function Shell({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

function DropboxReturn() {
  const [message, setMessage] = useState("Finishing the Dropbox connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: "dropbox" }, window.location.origin);
      setTimeout(() => window.close(), 400);
    };

    if (!code || !state) {
      setMessage(
        params.get("error_description") ??
          params.get("error") ??
          "Dropbox did not approve the connection.",
      );
      notify("appUserConnectorOAuthFailed");
      return;
    }
    void completeDropboxConnect({
      data: { code, state, returnUrl: `${window.location.origin}${DROPBOX_RETURN_PATH}` },
    })
      .then((result) => {
        if (!result.ok) {
          setMessage(result.reason);
          notify("appUserConnectorOAuthFailed");
          return;
        }
        setMessage("Dropbox connected. You can close this window.");
        notify("appUserConnectorOAuthComplete");
      })
      .catch((err: Error) => {
        setMessage(err.message || "Could not finish the connection.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return <Shell message={message} />;
}
