/**
 * Dropbox API client. Server-only.
 *
 * Uses a confidential OAuth2 client (app key + secret held as project secrets)
 * with offline access, so only an encrypted refresh token is persisted and the
 * browser never sees any Dropbox credential.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { DROPBOX_SCOPES } from "./dropbox-shared";
import type { CloudFile } from "@/lib/cloud/shared";

const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const RPC_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

export class DropboxNotConfiguredError extends Error {}

export function dropboxAppKey() {
  return process.env.DROPBOX_APP_KEY ?? null;
}

function dropboxAppSecret() {
  return process.env.DROPBOX_APP_SECRET ?? null;
}

export function dropboxConfigurationStatus(): { configured: boolean; reason: string } {
  if (!dropboxAppKey() || !dropboxAppSecret()) {
    return {
      configured: false,
      reason:
        "Dropbox is not set up yet. Add DROPBOX_APP_KEY and DROPBOX_APP_SECRET in Project Settings → Secrets, using a Dropbox app with the scopes account_info.read, files.metadata.read, files.content.read and files.content.write.",
    };
  }
  if (!process.env.APP_USER_CONNECTION_KEY_SECRET) {
    return {
      configured: false,
      reason:
        "The connection encryption key is missing, so Dropbox tokens cannot be stored securely.",
    };
  }
  return { configured: true, reason: "" };
}

function requireConfigured() {
  const status = dropboxConfigurationStatus();
  if (!status.configured) throw new DropboxNotConfiguredError(status.reason);
}

/* ------------------------------------------------------------------ OAuth */

/** Signed, short-lived state so the callback cannot be forged or replayed. */
export function signOAuthState(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  const mac = createHmac("sha256", dropboxAppSecret() ?? "unset")
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${mac}`, "utf8").toString("base64url");
}

export function verifyOAuthState(state: string, userId: string) {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [id, issued, mac] = decoded.split(".");
    if (id !== userId) return false;
    if (Date.now() - Number(issued) > 15 * 60 * 1000) return false;
    const expected = createHmac("sha256", dropboxAppSecret() ?? "unset")
      .update(`${id}.${issued}`)
      .digest("hex");
    const a = Buffer.from(mac ?? "");
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildAuthorizationUrl(input: { redirectUri: string; state: string }) {
  requireConfigured();
  const params = new URLSearchParams({
    client_id: dropboxAppKey()!,
    response_type: "code",
    redirect_uri: input.redirectUri,
    token_access_type: "offline",
    scope: DROPBOX_SCOPES.join(" "),
    state: input.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type DropboxTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  accountId: string | null;
};

async function tokenRequest(body: URLSearchParams): Promise<DropboxTokens> {
  requireConfigured();
  body.set("client_id", dropboxAppKey()!);
  body.set("client_secret", dropboxAppSecret()!);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox sign-in failed [${res.status}]: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    account_id?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + (json.expires_in ?? 14400) * 1000 - 60_000,
    accountId: json.account_id ?? null,
  };
}

export function exchangeAuthorizationCode(code: string, redirectUri: string) {
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

export async function revokeToken(accessToken: string) {
  await fetch(`${RPC_BASE}/auth/token/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/* -------------------------------------------------------------------- API */

async function rpc<T>(accessToken: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${RPC_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(describeError(res.status, text));
  return (text ? JSON.parse(text) : {}) as T;
}

/** Turns Dropbox's machine error envelope into something an estimator can act on. */
function describeError(status: number, text: string) {
  if (/path\/not_found/.test(text)) return "That Dropbox file or folder no longer exists.";
  if (/insufficient_space/.test(text)) return "The Dropbox account is out of space.";
  if (/missing_scope/.test(text)) {
    return "The Dropbox app is missing a required permission. Re-connect Dropbox after enabling the required scopes.";
  }
  if (status === 401) return "The Dropbox connection expired. Re-connect Dropbox to continue.";
  if (status === 429) return "Dropbox is rate limiting this account. Wait a moment and try again.";
  return `Dropbox request failed [${status}]: ${text.slice(0, 300)}`;
}

type RawEntry = {
  [".tag"]: "file" | "folder" | "deleted";
  id?: string;
  name: string;
  path_lower?: string;
  path_display?: string;
  size?: number;
  rev?: string;
  content_hash?: string;
  server_modified?: string;
  client_modified?: string;
};

function mimeFor(name: string) {
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.zip$/i.test(name)) return "application/zip";
  if (/\.xlsx$/i.test(name))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.csv$/i.test(name)) return "text/csv";
  if (/\.json$/i.test(name)) return "application/json";
  return null;
}

export function toCloudFile(entry: RawEntry): CloudFile {
  const path = entry.path_display ?? entry.path_lower ?? "";
  const parent = path.split("/").slice(0, -1).join("/");
  return {
    // Dropbox is path-addressed; the path is the stable read handle.
    id: entry.path_lower ?? path,
    name: entry.name,
    path,
    isFolder: entry[".tag"] === "folder",
    mimeType: entry[".tag"] === "folder" ? null : mimeFor(entry.name),
    sizeBytes: entry.size ?? null,
    modifiedTime: entry.server_modified ?? entry.client_modified ?? null,
    rev: entry.rev ?? null,
    contentHash: entry.content_hash ?? null,
    webUrl: null,
    folderPath: parent || "/",
    folderName: parent ? (parent.split("/").pop() ?? "Dropbox") : "Dropbox",
  };
}

export async function currentAccount(accessToken: string) {
  const json = await rpc<{ email?: string; name?: { display_name?: string } }>(
    accessToken,
    "/users/get_current_account",
    undefined,
  );
  return { email: json.email ?? null, name: json.name?.display_name ?? null };
}

export async function listFolder(
  accessToken: string,
  input: { path: string | null; cursor?: string | null },
) {
  const json = input.cursor
    ? await rpc<{ entries: RawEntry[]; cursor: string; has_more: boolean }>(
        accessToken,
        "/files/list_folder/continue",
        { cursor: input.cursor },
      )
    : await rpc<{ entries: RawEntry[]; cursor: string; has_more: boolean }>(
        accessToken,
        "/files/list_folder",
        {
          path: input.path && input.path !== "/" ? input.path : "",
          recursive: false,
          include_deleted: false,
          limit: 500,
        },
      );
  return {
    files: json.entries.filter((e) => e[".tag"] !== "deleted").map(toCloudFile),
    nextCursor: json.has_more ? json.cursor : null,
  };
}

export async function searchFiles(accessToken: string, query: string) {
  const json = await rpc<{ matches: { metadata: { metadata: RawEntry } }[] }>(
    accessToken,
    "/files/search_v2",
    {
      query,
      options: { max_results: 100, file_status: "active" },
    },
  );
  return json.matches.map((m) => toCloudFile(m.metadata.metadata));
}

export async function getMetadata(accessToken: string, path: string) {
  const json = await rpc<RawEntry>(accessToken, "/files/get_metadata", { path });
  return toCloudFile(json);
}

export async function createFolder(accessToken: string, path: string) {
  const json = await rpc<{ metadata: RawEntry }>(accessToken, "/files/create_folder_v2", {
    path,
    autorename: false,
  });
  return toCloudFile(json.metadata);
}

/** Shared link for the project's export history; reuses an existing link. */
export async function sharedLink(accessToken: string, path: string): Promise<string | null> {
  try {
    const created = await rpc<{ url?: string }>(
      accessToken,
      "/sharing/create_shared_link_with_settings",
      { path },
    );
    if (created.url) return created.url;
  } catch {
    /* falls through to the existing-link lookup below */
  }
  try {
    const existing = await rpc<{ links: { url: string }[] }>(
      accessToken,
      "/sharing/list_shared_links",
      {
        path,
        direct_only: true,
      },
    );
    return existing.links?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

export async function downloadFile(accessToken: string, path: string) {
  const res = await fetch(`${CONTENT_BASE}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error(describeError(res.status, await res.text()));
  return new Uint8Array(await res.arrayBuffer());
}

export async function uploadFile(
  accessToken: string,
  input: { path: string; bytes: Uint8Array; overwrite: boolean },
) {
  const body = input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength,
  ) as ArrayBuffer;
  const res = await fetch(`${CONTENT_BASE}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: input.path,
        mode: input.overwrite ? "overwrite" : "add",
        autorename: !input.overwrite,
        mute: true,
      }),
    },
    body,
  });
  if (!res.ok) throw new Error(describeError(res.status, await res.text()));
  return toCloudFile((await res.json()) as RawEntry);
}
