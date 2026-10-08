import { AlertTriangle, Cloud, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDropboxConnect, useDropboxStatus } from "@/lib/dropbox/useDropbox";

/**
 * Connection state for Dropbox. Shows plain-language setup guidance when the
 * workspace secrets are not in place instead of failing silently.
 */
export function DropboxConnectCard({ compact = false }: { compact?: boolean }) {
  const { data: status, isLoading } = useDropboxStatus();
  const { connect, connecting, disconnect } = useDropboxConnect();

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking Dropbox…
      </p>
    );
  }

  if (status && !status.configured) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4" /> Dropbox setup required
        </p>
        <p className="mt-1 text-xs leading-relaxed">{status.reason}</p>
        <p className="mt-2 text-xs leading-relaxed">
          Create a Dropbox app (scoped access), add{" "}
          <code className="rounded bg-white/70 px-1">
            {typeof window === "undefined" ? "" : window.location.origin}
            /oauth/dropbox/return
          </code>{" "}
          as a redirect URI, then save the app key and secret in Project Settings → Secrets.
        </p>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 ${compact ? "" : "rounded-md border border-border p-3"}`}
      >
        <Cloud className="size-4 text-navy" aria-hidden="true" />
        <span className="text-sm text-navy">
          Connected as{" "}
          <strong>{status.accountEmail ?? status.accountName ?? "your Dropbox account"}</strong>
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          <Unlink className="mr-1 size-4" /> Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "rounded-md border border-border p-3"}>
      <p className="text-sm text-muted-foreground">
        Connect Dropbox to import plan sets and save approved deliverables. AWM only requests read
        access to the files you pick and write access for exports.
      </p>
      <Button className="mt-3" onClick={() => void connect()} disabled={connecting}>
        {connecting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Cloud className="mr-2 size-4" />
        )}
        Connect Dropbox
      </Button>
    </div>
  );
}
