/**
 * Per-user Dropbox credential storage.
 *
 * The refresh/access token pair is encrypted with AES-256-GCM before it touches
 * the database and is only ever decrypted inside server functions.
 */
import { decryptSecret, encryptSecret } from "@/lib/cloud/crypto.server";
import { DROPBOX_PROVIDER_ID, DROPBOX_SCOPES } from "./dropbox-shared";
import { refreshAccessToken, revokeToken, type DropboxTokens } from "./dropbox-api.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  accountId: string | null;
};

export async function saveDropboxConnection(input: {
  userId: string;
  tokens: DropboxTokens;
  accountEmail: string | null;
  accountName: string | null;
}) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: input.userId,
      connector_id: DROPBOX_PROVIDER_ID,
      connection_key_ciphertext: encryptSecret(JSON.stringify(input.tokens satisfies StoredTokens)),
      account_email: input.accountEmail,
      account_name: input.accountName,
      scopes: DROPBOX_SCOPES,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(error.message);
}

export async function loadDropboxConnection(userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext,account_email,account_name,created_at,updated_at")
    .eq("user_id", userId)
    .eq("connector_id", DROPBOX_PROVIDER_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    tokens: JSON.parse(decryptSecret(data.connection_key_ciphertext)) as StoredTokens,
    accountEmail: data.account_email,
    accountName: data.account_name,
    connectedAt: data.created_at,
  };
}

export async function deleteDropboxConnection(userId: string) {
  const db = await admin();
  await db
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", DROPBOX_PROVIDER_ID);
}

export async function disconnectDropbox(userId: string) {
  const connection = await loadDropboxConnection(userId);
  if (connection) {
    try {
      await revokeToken(connection.tokens.accessToken);
    } catch {
      /* the local record is removed regardless */
    }
    await deleteDropboxConnection(userId);
  }
}

/**
 * Returns a valid access token, transparently refreshing (and re-persisting)
 * it when the short-lived token has expired.
 */
export async function requireDropboxAccessToken(userId: string): Promise<string> {
  const connection = await loadDropboxConnection(userId);
  if (!connection) throw new Error("Dropbox is not connected for your account.");
  const { tokens } = connection;
  if (tokens.expiresAt > Date.now() && tokens.accessToken) return tokens.accessToken;
  if (!tokens.refreshToken) {
    throw new Error("The Dropbox connection expired. Re-connect Dropbox to continue.");
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const merged: DropboxTokens = {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    accountId: refreshed.accountId ?? tokens.accountId,
  };
  await saveDropboxConnection({
    userId,
    tokens: merged,
    accountEmail: connection.accountEmail,
    accountName: connection.accountName,
  });
  return merged.accessToken;
}
