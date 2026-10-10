import { hardNavigate } from "./navigate";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * A 401 means the session expired or was revoked (signed out elsewhere,
 * password changed). Send the browser to sign in, then straight back here --
 * important for the always-on wall display, which would otherwise just show
 * stale data forever.
 */
const SIGNED_OUT_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/invite"];

function redirectToLoginIfSignedOut(status: number) {
  if (status !== 401 || typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (SIGNED_OUT_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
  const here = `${pathname}${search}`;
  hardNavigate(`/login?next=${encodeURIComponent(here)}`);
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  redirectToLoginIfSignedOut(res.status);
  return new ApiError(body.error ?? "Request failed", res.status, body.code);
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json().catch(() => ({}))) as T;
}

export function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  return sendJson<T>("POST", url, body);
}

export function patchJson<T = unknown>(url: string, body: unknown): Promise<T> {
  return sendJson<T>("PATCH", url, body);
}

export function deleteJson<T = unknown>(url: string, body?: unknown): Promise<T> {
  return sendJson<T>("DELETE", url, body);
}
