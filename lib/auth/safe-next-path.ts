export function safeNextPath(raw: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  // Reject backslash forms (e.g. "/\\evil.test") that can be interpreted
  // inconsistently by clients and proxies.
  if (raw.includes("\\")) return fallback;

  return raw;
}
