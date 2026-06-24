/**
 * src/lib/api-client.ts
 *
 * Dedicated fetch wrapper for Next.js server components to communicate
 * with the isolated AWS Node.js backend.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Next.js (Vercel)  ──→  apiFetch()  ──→  AWS API Gateway / Node.js backend
 *
 * This module is SERVER-SIDE ONLY. It must never be imported into:
 *   - Client components ("use client")
 *   - Pages with client-side data fetching
 *
 * AWS credentials and the backend URL are read exclusively from server-side
 * environment variables (no NEXT_PUBLIC_ prefix for secrets).
 *
 * ── Environment variables required ───────────────────────────────────────────
 *
 *   NEXT_PUBLIC_AWS_API_URL  — Base URL of the AWS backend (e.g. API Gateway)
 *                              NEXT_PUBLIC_ because the URL itself is not secret.
 *                              It is read server-side here but can also be used
 *                              in server components for display purposes.
 *
 *   AWS_API_SECRET           — Bearer token / API key for the backend.
 *                              NEVER prefixed with NEXT_PUBLIC_.
 *                              Never exposed to the browser.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a Server Component or Route Handler:
 *   import { apiGet, apiPost } from "@/lib/api-client";
 *
 *   const client = await apiGet<Client>("/clients/123");
 *   const created = await apiPost<NewCase>("/cases", { clientId: "123", ... });
 *
 * ── Error handling ───────────────────────────────────────────────────────────
 *
 *   All methods throw ApiError on non-2xx responses. Callers should:
 *
 *   try {
 *     const data = await apiGet("/endpoint");
 *   } catch (err) {
 *     if (err instanceof ApiError) {
 *       // err.status   — HTTP status code (e.g. 404, 500)
 *       // err.code     — Machine-readable code from backend (if available)
 *       // err.message  — Human-readable description
 *     }
 *   }
 */

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNotFound(): boolean { return this.status === 404; }
  get isUnauthorized(): boolean { return this.status === 401; }
  get isForbidden(): boolean { return this.status === 403; }
  get isServerError(): boolean { return this.status >= 500; }
}

// ── Environment validation ────────────────────────────────────────────────────

interface ApiConfig {
  baseUrl: string;
  secret: string;
}

function getApiConfig(): ApiConfig {
  const baseUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
  const secret  = process.env.AWS_API_SECRET;

  const missing: string[] = [];
  if (!baseUrl) missing.push("NEXT_PUBLIC_AWS_API_URL");
  if (!secret)  missing.push("AWS_API_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `[api-client] Missing required environment variables: ${missing.join(", ")}. ` +
      "See .env.example for setup instructions."
    );
  }

  return {
    baseUrl: baseUrl!.replace(/\/$/, ""), // strip trailing slash
    secret: secret!,
  };
}

// ── Request options ───────────────────────────────────────────────────────────

export interface ApiRequestOptions {
  /** Additional headers to merge (never override Authorization or Content-Type) */
  headers?: Record<string, string>;
  /** Next.js fetch cache/revalidation options */
  next?: RequestInit["next"];
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Override the base URL (useful for presigned S3 URLs etc.) */
  baseUrlOverride?: string;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

/**
 * Low-level fetch wrapper. All public convenience methods delegate here.
 *
 * Features:
 *   - Automatic Authorization: Bearer header from AWS_API_SECRET
 *   - JSON request/response serialization
 *   - AbortController timeout
 *   - Structured ApiError on non-2xx responses
 *   - Server-side request logging (path + status)
 */
export async function apiFetch<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeoutMs = 10_000, next, headers: extraHeaders, baseUrlOverride } = options;

  const config = getApiConfig();
  const base   = baseUrlOverride ?? config.baseUrl;
  const url    = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  // Build headers — authorization is always from the server-side secret
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.secret}`,
    "Accept": "application/json",
    "X-Client": "independence-law-portal/1.0",
    ...extraHeaders,
  };

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // Pass Next.js cache options (e.g. { revalidate: 60 } or { cache: "no-store" })
      next,
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        408,
        `Request to ${path} timed out after ${timeoutMs}ms`,
        "REQUEST_TIMEOUT"
      );
    }

    throw new ApiError(
      0,
      `Network error reaching AWS backend: ${err instanceof Error ? err.message : "Unknown"}`,
      "NETWORK_ERROR"
    );
  }

  clearTimeout(timeoutId);

  // Log server-side (visible in Vercel function logs, never in browser)
  console.log(`[api-client] ${method} ${path} → ${response.status}`);

  // ── Parse response ────────────────────────────────────────────────────────
  let responseBody: unknown;

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
  } else {
    // Non-JSON response (e.g. 204 No Content, plain text errors)
    responseBody = await response.text().catch(() => null);
  }

  // ── Handle errors ─────────────────────────────────────────────────────────
  if (!response.ok) {
    const body = responseBody as Record<string, unknown> | null;

    const message =
      (typeof body?.message === "string" ? body.message : null) ??
      (typeof body?.error   === "string" ? body.error   : null) ??
      `AWS backend returned ${response.status}`;

    const code =
      typeof body?.code === "string" ? body.code : undefined;

    console.error(
      `[api-client] Error ${response.status} on ${method} ${path}:`,
      message
    );

    throw new ApiError(response.status, message, code, body);
  }

  return responseBody as T;
}

// ── Convenience methods ───────────────────────────────────────────────────────

/** GET request — returns typed response */
export function apiGet<T = unknown>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  return apiFetch<T>("GET", path, undefined, options);
}

/** POST request with JSON body — returns typed response */
export function apiPost<T = unknown>(
  path: string,
  body: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiFetch<T>("POST", path, body, options);
}

/** PUT request with JSON body — returns typed response */
export function apiPut<T = unknown>(
  path: string,
  body: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiFetch<T>("PUT", path, body, options);
}

/** PATCH request with JSON body — returns typed response */
export function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiFetch<T>("PATCH", path, body, options);
}

/** DELETE request — returns typed response */
export function apiDelete<T = unknown>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  return apiFetch<T>("DELETE", path, undefined, options);
}

// ── Domain-specific API helpers ───────────────────────────────────────────────
// These are thin wrappers that encode the backend's route structure.
// Expand as the AWS backend API surface grows.

export interface BackendClient {
  id: string;
  email: string;
  fullName: string;
  status: "pending" | "active" | "suspended";
  emailVerified: boolean;
  createdAt: string;
}

export interface BackendCase {
  id: string;
  clientId: string;
  title: string;
  status: "open" | "closed" | "pending";
  createdAt: string;
  updatedAt: string;
}

export interface S3PresignedUrl {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

/** [db-stub] Fetch a client record by ID from the AWS backend */
export async function getClientById(clientId: string): Promise<BackendClient> {
  return apiGet<BackendClient>(`/clients/${clientId}`, {
    next: { revalidate: 30 }, // cache for 30s
  });
}

/** [db-stub] Fetch all cases for a client */
export async function getClientCases(clientId: string): Promise<BackendCase[]> {
  return apiGet<BackendCase[]>(`/clients/${clientId}/cases`, {
    next: { revalidate: 60 },
  });
}

/** [db-stub] Request a presigned S3 URL for document upload */
export async function requestUploadUrl(opts: {
  clientId: string;
  fileName: string;
  contentType: string;
}): Promise<S3PresignedUrl> {
  return apiPost<S3PresignedUrl>("/documents/upload-url", opts, {
    next: { cache: "no-store" }, // presigned URLs must never be cached
  });
}
