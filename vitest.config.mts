import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve("src") } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
    // Every language pack, as the language layouts give each page its own.
    setupFiles: ["tests/setup-packs.ts", "tests/setup-kingdom.ts"],
  },
});
