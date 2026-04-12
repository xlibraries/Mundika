/**
 * Normalize GitHub Pages / subpath prefix (no trailing slash).
 */
export function normalizeBasePath(raw: string | undefined): string {
  const t = (raw ?? "").trim().replace(/\/$/, "");
  if (!t || t === "/") return "";
  return t.startsWith("/") ? t : `/${t}`;
}

/**
 * Absolute app root for OAuth `redirectTo` and similar (must match Supabase
 * allowed redirect URLs). On the client, uses `window.location.origin` so
 * GitHub Pages works without committing a fixed origin.
 */
export function getSiteUrl(): string {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const root = basePath ? `${origin}${basePath}` : origin;
    return root.endsWith("/") ? root : `${root}/`;
  }

  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  url = url.startsWith("http") ? url : `https://${url}`;
  url = url.replace(/\/$/, "");
  if (basePath && !url.endsWith(basePath)) {
    url = `${url}${basePath}`;
  }
  return `${url}/`;
}

/**
 * Full URL for `window.location` assignments (Next `Link`/`router` already
 * apply `basePath`; hard redirects do not).
 */
export function withBasePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

  if (typeof window !== "undefined") {
    return `${window.location.origin}${basePath}${p}`;
  }

  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  url = url.startsWith("http") ? url : `https://${url}`;
  url = url.replace(/\/$/, "");
  if (basePath && !url.endsWith(basePath)) {
    url = `${url}${basePath}`;
  }
  return `${url}${p}`;
}
