/**
 * Low-level Lovable connector-gateway client for the `google_drive`
 * App User Connector. Every call is server-only: the gateway credentials and
 * per-user connection keys must never reach the browser.
 *
 * All gateway plumbing lives in this one module so the app can be switched to
 * the generated `@/integrations/lovable/appUserConnector` helper (created when
 * a workspace admin links a Google Drive App User Connector client) by editing
 * this file alone.
 */

import { GOOGLE_DRIVE_CONNECTOR_ID } from "./drive-shared";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export class DriveNotConfiguredError extends Error {}
export class DriveNotConnectedError extends Error {}

export function driveClientApiKey(): string | null {
  return (
    process.env.GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY ??
    process.env.google_drive_APP_USER_CONNECTOR_CLIENT_API_KEY ??
    null
  );
}

export function driveConfigurationStatus(): { configured: boolean; reason: string } {
  if (!process.env.LOVABLE_API_KEY) {
    return { configured: false, reason: "The AI gateway key is missing from this environment." };
  }
  if (!driveClientApiKey()) {
    return {
      configured: false,
      reason:
        "Google Drive is not set up yet. A workspace admin has to add a Google OAuth client to the Google Drive App User Connector for this project.",
    };
  }
  if (!process.env.APP_USER_CONNECTION_KEY_SECRET) {
    return {
      configured: false,
      reason:
        "The connection encryption key is missing. Re-link the Google Drive connector to provision it.",
    };
  }
  return { configured: true, reason: "" };
}

function requireConfigured() {
  const status = driveConfigurationStatus();
  if (!status.configured) throw new DriveNotConfiguredError(status.reason);
}

async function gatewayFetch(path: string, init: RequestInit & { connectionKey?: string } = {}) {
  requireConfigured();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.LOVABLE_API_KEY}`);
  const clientKey = driveClientApiKey();
  if (clientKey) headers.set("X-Client-Api-Key", clientKey);
  if (init.connectionKey) headers.set("X-Connection-Api-Key", init.connectionKey);
  return fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, headers });
}

async function readError(res: Response) {
  const body = await res.text();
  return `Google Drive request failed [${res.status}]: ${body.slice(0, 600)}`;
}

/**
 * Starts per-user consent. Returns the provider authorization URL that the
 * browser must open in a popup.
 */
export async function startDriveAuthorization(input: {
  appUserId: string;
  returnUrl: string;
  scopes: string[];
  /** Existing key when re-authorizing so the gateway updates in place. */
  connectionApiKey?: string | null;
}) {
  const res = await gatewayFetch("/api/v1/app-users/oauth2/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connector_id: GOOGLE_DRIVE_CONNECTOR_ID,
      app_user_id: input.appUserId,
      return_url: input.returnUrl,
      // Scopes MUST live inside credentials_configuration — top-level scopes
      // are silently dropped by the gateway.
      credentials_configuration: { scopes: input.scopes },
      ...(input.connectionApiKey ? { connection_api_key: input.connectionApiKey } : {}),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as Record<string, unknown>;
  const url =
    (json.authorization_url as string) ??
    (json.authorizationUrl as string) ??
    (json.url as string) ??
    (json.redirect_url as string);
  if (!url) throw new Error("The connector gateway did not return an authorization URL.");
  return url;
}

/** Exchanges the one-time callback code for the durable connection key. */
export async function exchangeDriveOAuthCode(code: string) {
  const res = await gatewayFetch("/api/v1/app-users/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, connector_id: GOOGLE_DRIVE_CONNECTOR_ID }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as Record<string, unknown>;
  const key =
    (json.connection_api_key as string) ??
    (json.connectionAPIKey as string) ??
    (json.api_key as string) ??
    (json.connection_key as string);
  if (!key) throw new Error("The connector gateway did not return a connection key.");
  return {
    connectionApiKey: key,
    connectorId: (json.connector_id as string) ?? GOOGLE_DRIVE_CONNECTOR_ID,
  };
}

/** Revokes the per-user connection at the gateway. Best effort. */
export async function revokeDriveConnection(connectionKey: string) {
  const res = await gatewayFetch("/api/v1/app-users/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    connectionKey,
    body: JSON.stringify({ connector_id: GOOGLE_DRIVE_CONNECTOR_ID }),
  });
  return res.ok;
}

/** Proxied Google API call executed as the connected app user. */
export async function driveApi(
  connectionKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await gatewayFetch(`/${GOOGLE_DRIVE_CONNECTOR_ID}${path}`, {
    ...init,
    connectionKey,
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    throw new DriveNotConnectedError(
      `Google denied the request [${res.status}]. Reconnect Google Drive or grant the requested access. ${body.slice(0, 300)}`,
    );
  }
  return res;
}

export async function driveApiJson<T>(
  connectionKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await driveApi(connectionKey, path, init);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}
