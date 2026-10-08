import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(bucket: string, path: string, seconds = 3600) {
  const key = `${bucket}:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data) throw error ?? new Error("Could not create signed URL");
  cache.set(key, { url: data.signedUrl, expires: Date.now() + (seconds - 60) * 1000 });
  return data.signedUrl;
}

export async function signedUrls(bucket: string, paths: string[], seconds = 3600) {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const path of paths) {
    const hit = cache.get(`${bucket}:${path}`);
    if (hit && hit.expires > Date.now()) out.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, seconds);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        cache.set(`${bucket}:${row.path}`, {
          url: row.signedUrl,
          expires: Date.now() + (seconds - 60) * 1000,
        });
        out.set(row.path, row.signedUrl);
      }
    }
  }
  return out;
}

export function randomFileName(extension: string) {
  return `${crypto.randomUUID().replace(/-/g, "")}.${extension.replace(/^\./, "")}`;
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
