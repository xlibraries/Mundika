import type { NextConfig } from "next";

/** Set by GitHub Actions (`configure-pages` → `NEXT_PUBLIC_BASE_PATH`) for project Pages. */
const rawBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const basePath =
  rawBase === "" || rawBase === "/"
    ? ""
    : rawBase.startsWith("/")
      ? rawBase.replace(/\/$/, "")
      : `/${rawBase.replace(/\/$/, "")}`;

/** When you open dev via LAN IP (e.g. http://192.168.1.52:3000), Next must allow that host for `/_next/*` and HMR WebSockets. */
const allowedDevOrigins =
  process.env.NODE_ENV !== "production" && process.env.NEXT_DEV_ALLOWED_ORIGINS
    ? process.env.NEXT_DEV_ALLOWED_ORIGINS.split(/[,;\s]+/).filter(Boolean)
    : undefined;

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
};

export default nextConfig;
