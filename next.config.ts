import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  // The reward system (github.com/ligangwang/kingdom) ships its 3D scene as
  // TypeScript source.
  transpilePackages: ["kingdom"],
};
export default config;
