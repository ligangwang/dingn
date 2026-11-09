import { defineConfig } from "vite";
export default defineConfig({
  // Published under /g/crowd/<version>/, so every URL stays relative.
  base: "./",
  esbuild: { jsx: "automatic" },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // three.js is one large chunk, loaded after the menu is on screen.
    chunkSizeWarningLimit: 800,
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.tsx"] },
});
