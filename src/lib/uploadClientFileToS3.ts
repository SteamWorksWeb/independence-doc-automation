/**
 * src/lib/uploadClientFileToS3.ts
 *
 * Client-side S3 direct-upload helper.
 *
 * Three-step flow
 * ───────────────
 *  1. POST /api/client/documents/presigned-url
 *       → { url: string; s3Key: string }
 *  2. fetch PUT  <url>  (raw File body, matching Content-Type header)
 *       → uploads bytes directly to S3, bypassing Next.js
 *  3. POST /api/client/documents/confirm
 *       Body: { s3Key, fileName, fileType, fileSize, category, title }
 *       → { document: ConfirmedDocument }   (persisted in DB)
 *
 * Auth
 * ────
 * All requests to /api/* are proxied through Next.js Route Handlers which read
 * the HttpOnly borrower_session / client_token cookie. The browser never sees
 * the JWT directly.
 *
 * Usage
 * ─────
 *   import { uploadClientFileToS3 } from "@/lib/uploadClientFileToS3";
 *
 *   const doc = await uploadClientFileToS3(file, "tax_returns");
 *   // doc.id, doc.fileName, doc.s3Key ...
 *
 * Progress callback (optional)
 * ────────────────────────────
 *   await uploadClientFileToS3(file, "pay_stubs", (pct) => setProgress(pct));
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PresignedUrlResponse {
  url: string;
  s3Key: string;
}

export interface ConfirmedDocument {
  id: string;
  s3Key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  title?: string | null;
  uploadedAt: string;
  [key: string]: unknown;
}

export interface UploadOptions {
  /** Called with integer 0–100 during the upload phase */
  onProgress?: (percent: number) => void;
  /**
   * Custom human-readable title shown to Admins.
   * Required by the backend /confirm endpoint; falls back to the original
   * filename when not explicitly provided (e.g. message attachments).
   */
  title?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface ErrorPayload {
  message?: string;
  error?: string;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    const p = payload as ErrorPayload;
    if (typeof p.message === "string" && p.message.trim()) return p.message.trim();
    if (typeof p.error   === "string" && p.error.trim())   return p.error.trim();
  }
  return fallback;
}

/**
 * Upload bytes to an S3 presigned PUT URL, tracking progress via XMLHttpRequest.
 * Falls back to a plain fetch when `onProgress` is not supplied.
 */
async function putToS3(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!onProgress) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`S3 PUT failed: HTTP ${res.status}`);
    }
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`S3 PUT failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("S3 PUT network error"))
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("S3 PUT aborted"))
    );

    xhr.send(file);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Upload a file to S3 using the three-step presigned-URL flow and return the
 * confirmed document record from the database.
 *
 * @param file      The browser File object to upload
 * @param category  Document bucket (e.g. "tax_returns", "pay_stubs", "message-attachment")
 * @param options   { title (human-readable label; falls back to filename), onProgress (0–100) }
 */
export async function uploadClientFileToS3(
  file: File,
  category = "other",
  options: UploadOptions = {}
): Promise<ConfirmedDocument> {
  const { onProgress, title = file.name } = options;

  // ── Step 1: Obtain presigned URL ───────────────────────────────────────────
  const presignedRes = await fetch("/api/client/documents/presigned-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
    }),
  });

  const presignedPayload: unknown = await presignedRes.json().catch(() => ({}));

  if (!presignedRes.ok) {
    throw new Error(
      extractMessage(presignedPayload, "Unable to get upload URL. Please try again.")
    );
  }

  const { url, s3Key } = presignedPayload as PresignedUrlResponse;

  if (!url || !s3Key) {
    throw new Error("Invalid presigned URL response from server.");
  }

  // ── Step 2: PUT directly to S3 ────────────────────────────────────────────
  if (onProgress) onProgress(0);

  await putToS3(url, file, onProgress);

  // ── Step 3: Confirm with backend ──────────────────────────────────────────
  const confirmRes = await fetch("/api/client/documents/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      category,
      title,
    }),
  });

  const confirmPayload: unknown = await confirmRes.json().catch(() => ({}));

  if (!confirmRes.ok) {
    throw new Error(
      extractMessage(confirmPayload, "Upload succeeded but confirmation failed. Contact support.")
    );
  }

  // Normalise various backend response shapes
  const payload = confirmPayload as Record<string, unknown>;
  const document =
    (payload.document as ConfirmedDocument | undefined) ??
    (payload.data     as ConfirmedDocument | undefined) ??
    (confirmPayload   as ConfirmedDocument);

  return document;
}
