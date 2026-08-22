/**
 * Sanitize a ?next= redirect target. Only same-site absolute paths are
 * allowed — anything else (external URLs, protocol-relative "//host",
 * javascript: etc.) falls back, closing the open-redirect hole.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
