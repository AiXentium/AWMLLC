import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { completeDriveConnect } from "@/lib/google/drive.functions";

export const Route = createFileRoute("/oauth/google/return")({
  head: () => ({
    meta: [
      { title: "Finishing Google connection — AWM Takeoff AI" },
      {
        name: "description",
        content: "Completing the secure Google Drive connection for AWM Takeoff AI.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoogleReturn,
  errorComponent: () => (
    <Shell message="The Google connection could not be completed. Close this window and try again." />
  ),
});

function Shell({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

function GoogleReturn() {
  const [message, setMessage] = useState("Finishing the Google Drive connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const code = params.get("code");
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: "google_drive" }, window.location.origin);
      setTimeout(() => window.close(), 400);
    };

    if (!success) {
      setMessage(params.get("error") ?? "Google did not approve the connection.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    if (!code) {
      // Consent succeeded but the client disallows offline access — nothing to store.
      setMessage("Connected, but this Google client does not allow offline access.");
      notify("appUserConnectorOAuthComplete");
      return;
    }
    void completeDriveConnect({ data: { code } })
      .then(() => {
        setMessage("Google Drive connected. You can close this window.");
        notify("appUserConnectorOAuthComplete");
      })
      .catch((err: Error) => {
        setMessage(err.message || "Could not finish the connection.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return <Shell message={message} />;
}
