import type { NextConfig } from "next";
import pkg from "./package.json";
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  // The version the footer shows: package.json's, and the commit it was
  // built from (GIT_COMMIT, which the Website workflow gives the image).
  env: {
    NEXT_PUBLIC_DINGN_VERSION: pkg.version,
    NEXT_PUBLIC_DINGN_COMMIT: (process.env.GIT_COMMIT ?? "").slice(0, 7),
  },
};
export default config;
