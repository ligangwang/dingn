// The runtime image copies the server's scripts one by one. A script the
// server imports but the Dockerfile leaves out only fails when Cloud Run
// starts the container, so check every local import is copied.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("the runtime image copies every script the server imports", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const copied = new Set(
    dockerfile
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("COPY --chown") && line.includes(" ./scripts/"),
      )
      .flatMap((line) => line.match(/scripts\/[\w.-]+\.mjs/g) ?? []),
  );
  const needed = new Set();
  const visit = (file) => {
    if (needed.has(file)) return;
    needed.add(file);
    const source = readFileSync(file, "utf8");
    for (const [, spec] of source
      .matchAll(
        /(?:import|export)\s[^"']*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
      )
      .map((m) => [m[0], m[1] ?? m[2]])) {
      const target = path.posix.join(path.posix.dirname(file), spec);
      if (target.startsWith("scripts/") && target.endsWith(".mjs"))
        visit(target);
    }
  };
  visit("scripts/preview.mjs");
  const missing = [...needed].filter((file) => !copied.has(file));
  assert.deepEqual(
    missing,
    [],
    `Add to the Dockerfile's runtime COPY: ${missing.join(" ")}`,
  );
});
