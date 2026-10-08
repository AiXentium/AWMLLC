/**
 * Per-user Google connection storage. The connection key (`lovack_*`) is
 * encrypted with AES-256-GCM before it ever touches the database, and is only
 * ever read inside server functions.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "./drive-shared";

function encryptionKey(): Buffer {
  const raw = process.env.APP_USER_CONNECTION_KEY_SECRET;
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  const buf = Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptConnectionKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptConnectionKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function saveDriveConnection(input: {
  userId: string;
  connectionApiKey: string;
  accountEmail: string | null;
  accountName: string | null;
  scopes: string[];
}) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: input.userId,
      connector_id: GOOGLE_DRIVE_CONNECTOR_ID,
      connection_key_ciphertext: encryptConnectionKey(input.connectionApiKey),
      account_email: input.accountEmail,
      account_name: input.accountName,
      scopes: input.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(error.message);
}

export async function loadDriveConnection(userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext,account_email,account_name,updated_at,created_at")
    .eq("user_id", userId)
    .eq("connector_id", GOOGLE_DRIVE_CONNECTOR_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    connectionApiKey: decryptConnectionKey(data.connection_key_ciphertext),
    accountEmail: data.account_email,
    accountName: data.account_name,
    connectedAt: data.created_at,
  };
}

export async function deleteDriveConnection(userId: string) {
  const db = await admin();
  await db
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", GOOGLE_DRIVE_CONNECTOR_ID);
}

/** Loads the key or throws a message the UI can show verbatim. */
export async function requireDriveKey(userId: string) {
  const connection = await loadDriveConnection(userId);
  if (!connection) throw new Error("Google Drive is not connected for your account.");
  return connection.connectionApiKey;
}
