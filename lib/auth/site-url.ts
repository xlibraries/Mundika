export function getSiteUrl() {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  url = url.startsWith("http") ? url : `https://${url}`;
  return url.endsWith("/") ? url : `${url}/`;
}
