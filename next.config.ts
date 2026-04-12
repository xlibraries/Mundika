import type { NextConfig } from "next";

/** Set by GitHub Actions (`configure-pages` → `NEXT_PUBLIC_BASE_PATH`) for project Pages. */
const rawBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const basePath =
  rawBase === "" || rawBase === "/"
    ? ""
    : rawBase.startsWith("/")
      ? rawBase.replace(/\/$/, "")
      : `/${rawBase.replace(/\/$/, "")}`;

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
