import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024;

export type UploadHandle = {
  promise: Promise<void>;
  abort: () => void;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again to continue the upload.");
  return token;
}

/**
 * Direct single-request upload with real progress, used as a fallback when the
 * resumable (TUS) endpoint rejects a file (e.g. 413 on large plan sets).
 */
function directUpload(options: {
  bucket: string;
  path: string;
  file: File;
  contentType: string;
  token: string;
  onProgress: (fraction: number) => void;
  onXhr?: (xhr: XMLHttpRequest) => void;
}): Promise<void> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    options.onXhr?.(xhr);
    xhr.open("POST", `${baseUrl}/storage/v1/object/${options.bucket}/${options.path}`);
    xhr.setRequestHeader("authorization", `Bearer ${options.token}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("content-type", options.contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress(0.05 + 0.9 * (e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error."));
    xhr.onabort = () => reject(new Error("Cancelled"));
    xhr.send(options.file);
  });
}

/**
 * Uploads directly to the private bucket. Files above 6 MB use the resumable
 * (TUS) endpoint so the browser streams 6 MB chunks instead of buffering the
 * whole plan set, and an interrupted upload can be retried from where it stopped.
 */
export function uploadToStorage(options: {
  bucket: string;
  path: string;
  file: File;
  contentType: string;
  onProgress: (fraction: number) => void;
}): UploadHandle {
  let aborted = false;
  let upload: tus.Upload | null = null;
  let fallbackXhr: XMLHttpRequest | null = null;

  const promise = (async () => {
    const token = await accessToken();
    if (aborted) throw new Error("Cancelled");

    if (options.file.size <= RESUMABLE_THRESHOLD) {
      options.onProgress(0.05);
      const { error } = await supabase.storage
        .from(options.bucket)
        .upload(options.path, options.file, { contentType: options.contentType, upsert: true });
      if (error) throw new Error(error.message);
      options.onProgress(1);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        // TUS rejects large files with 413 — fall back to a direct upload.
        if (/\b413\b/.test(message) || /maximum size exceeded/i.test(message)) {
          directUpload({
            bucket: options.bucket,
            path: options.path,
            file: options.file,
            contentType: options.contentType,
            token,
            onProgress: options.onProgress,
            onXhr: (xhr) => {
              fallbackXhr = xhr;
              if (aborted) xhr.abort();
            },
          }).then(resolve, reject);
          return;
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      upload = new tus.Upload(options.file, {
        endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 6000, 12000],
        headers: {
          authorization: `Bearer ${token}`,
          "x-upsert": "true",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: options.bucket,
          objectName: options.path,
          contentType: options.contentType,
          cacheControl: "3600",
        },
        chunkSize: CHUNK_SIZE,
        onError: (error) => fail(error),
        onProgress: (sent, total) => options.onProgress(total ? sent / total : 0),
        onSuccess: () => resolve(),
      });
      upload.findPreviousUploads().then((previous) => {
        if (previous.length) upload?.resumeFromPreviousUpload(previous[0]);
        upload?.start();
      });
    });
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      void upload?.abort(true);
      fallbackXhr?.abort();
    },
  };
}
