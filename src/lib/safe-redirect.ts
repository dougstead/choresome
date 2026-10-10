/** Only same-site paths are allowed as post-login destinations -- never `//evil.com` or `https://...` (open redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
