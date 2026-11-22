// Copies the kingdom's models and textures from the kingdom package to
// public/models/kingdom, where its 3D scene loads them (/models/kingdom/).
// Runs before `dev` and `build`; the copy is not committed (.gitignore).
import { cp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkg = path.dirname(require.resolve("kingdom/package.json"));
const from = path.join(pkg, "assets", "kingdom");
const to = path.resolve("public/models/kingdom");
await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
console.log(
  `kingdom assets: ${path.relative(process.cwd(), from)} -> ${path.relative(process.cwd(), to)}`,
);
