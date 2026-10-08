import { useState } from "react";
import { CheckCircle2, Cloud, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDriveConnect, useDriveStatus } from "@/lib/google/useGoogleDrive";

/** Connection status + connect/disconnect for the signed-in user's Google account. */
export function GoogleDriveConnectCard({ compact = false }: { compact?: boolean }) {
  const { data: status, isLoading } = useDriveStatus();
  const { connect, connecting, disconnect } = useDriveConnect();
  const [showSetup, setShowSetup] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Checking Google Drive connection…</p>;
  }

  if (status && !status.configured) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-medium text-navy">
          <Cloud className="size-4 text-muted-foreground" aria-hidden="true" /> Google Drive — setup
          required
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{status.reason}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setShowSetup((v) => !v)}
        >
          {showSetup ? "Hide setup checklist" : "Show setup checklist"}
        </Button>
        {showSetup ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Create an OAuth web client in Google Cloud → APIs &amp; Services → Credentials.</li>
            <li>
              Authorized redirect URI:{" "}
              <code className="text-navy">
                https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
              </code>
            </li>
            <li>Enable the Google Drive API for that Google Cloud project.</li>
            <li>
              Scopes: <code>drive.readonly</code>, <code>drive.file</code>,{" "}
              <code>userinfo.email</code>, <code>userinfo.profile</code>.
            </li>
            <li>
              Add the client ID and secret to the Google Drive App User Connector, with offline
              access enabled.
            </li>
          </ul>
        ) : null}
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card ${compact ? "p-3" : "p-4"}`}
      >
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          <span className="font-medium text-navy">Google Drive connected</span>
          <span className="text-muted-foreground">
            {status.accountEmail ?? status.accountName ?? ""}
          </span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => void connect()} disabled={connecting}>
            Reconnect
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            <LogOut className="mr-2 size-4" aria-hidden="true" /> Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card ${compact ? "p-3" : "p-4"}`}
    >
      <div>
        <p className="font-medium text-navy">Google Drive</p>
        <p className="text-sm text-muted-foreground">
          Import plan sets straight from Drive and save finished takeoffs back to a project folder.
        </p>
      </div>
      <Button size="sm" onClick={() => void connect()} disabled={connecting}>
        {connecting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Cloud className="mr-2 size-4" />
        )}
        Connect Google Drive
      </Button>
    </div>
  );
}
