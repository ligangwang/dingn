#!/usr/bin/env node
// Publishes one game without deploying the website.
//
//   npm run publish:game -- <id>                 build, upload, make it live
//   npm run publish:game -- <id> --beta          upload as beta (play at /play/<id>/?v=beta)
//   npm run publish:game -- <id> --set-live 1.2.0   release or roll back to a published version
//   npm run publish:game -- <id> --listed | --unlisted   show or hide it in the catalog
//   add --local to publish into .games-local/ for `npm run preview -- --local-games`
//   add --dry-run to build and check without uploading
//   add --if-new to skip quietly when this version is already published (CI)
//
// Files go to gs://$GAMES_BUCKET/games/<id>/<version>/ and are never
// overwritten; then the registry's pointer moves. See docs/game-platform.md.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = args.find(
  (a, i) =>
    !a.startsWith("--") &&
    args[i - 1] !== "--set-live" &&
    args[i - 1] !== "--set-beta",
);

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
function run(command, commandArgs, options = {}) {
  console.log(`$ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) fail(`${command} failed`);
  return result;
}

if (!id)
  fail(
    "Usage: npm run publish:game -- <game id> [--beta] [--local] [--dry-run]",
  );
if (flag("--local"))
  process.env.GAMES_LOCAL_DIR ||= path.join(repo, ".games-local");

const registry = await import("./game-registry.mjs");
const gameDir = path.join(repo, "games", id);
const manifestPath = path.join(gameDir, "game.json");
if (!existsSync(manifestPath)) fail(`No games/${id}/game.json`);

let manifest;
try {
  manifest = registry.validateManifest(
    JSON.parse(readFileSync(manifestPath, "utf8")),
  );
} catch (error) {
  fail(error.message);
}
if (manifest.id !== id)
  fail(
    `games/${id}/game.json has id "${manifest.id}"; it must match the folder name.`,
  );

const where = registry.localDir()
  ? `local registry in ${registry.localDir()}`
  : "production registry";
const listed = flag("--listed") ? true : flag("--unlisted") ? false : undefined;

// ---- Moving a pointer only (release, rollback, listing) ----
const setLive = option("--set-live"),
  setBeta = option("--set-beta");
if (setLive || setBeta || listed != null) {
  if (flag("--dry-run"))
    fail("--dry-run only applies to publishing a new version");
  const record = await registry
    .updateRecord(id, (current) => {
      let next = current;
      if (setLive) next = registry.pointChannel(next, setLive, "live");
      if (setBeta) next = registry.pointChannel(next, setBeta, "beta");
      if (!next) throw new Error("That game has never been published.");
      if (listed != null)
        next = {
          ...next,
          status: listed ? "listed" : "unlisted",
          updatedAt: new Date().toISOString(),
        };
      return next;
    })
    .catch((error) => fail(error.message));
  console.log(
    `✓ ${id}: live ${record.live ?? "none"}, beta ${record.beta ?? "none"}, ${record.status} (${where})`,
  );
  process.exit(0);
}

// ---- Publishing a new version ----
const existing = await registry.getRecord(id);
if (existing?.versions?.[manifest.version] && flag("--if-new")) {
  console.log(`${id} ${manifest.version} is already published; nothing to do.`);
  process.exit(0);
}
if (existing?.versions?.[manifest.version])
  fail(
    `${id} ${manifest.version} is already published. Bump "version" in games/${id}/game.json.`,
  );

// A game with a package.json build script is built to dist/. Otherwise the
// folder is a static game: its files are published as they are, plus the
// game SDK as ./dingn-sdk.js.
const pkgPath = path.join(gameDir, "package.json");
const pkg = existsSync(pkgPath)
  ? JSON.parse(readFileSync(pkgPath, "utf8"))
  : null;
const staging = path.join(repo, ".games-build", id, manifest.version);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
if (pkg?.scripts?.build) {
  if (existsSync(path.join(gameDir, "package-lock.json")))
    run("npm", ["ci"], { cwd: gameDir });
  if (pkg.scripts.test) run("npm", ["test"], { cwd: gameDir });
  run("npm", ["run", "build"], { cwd: gameDir });
  const dist = path.join(gameDir, "dist");
  if (!existsSync(dist)) fail(`games/${id}: the build did not create dist/`);
  cpSync(dist, staging, { recursive: true });
} else {
  const skip = new Set([
    "node_modules",
    "package.json",
    "package-lock.json",
    "dist",
    "README.md",
  ]);
  cpSync(gameDir, staging, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      return src === gameDir || (!name.startsWith(".") && !skip.has(name));
    },
  });
  cpSync(
    path.join(repo, "packages", "game-sdk", "dingn-sdk.js"),
    path.join(staging, "dingn-sdk.js"),
  );
}
if (!existsSync(path.join(staging, manifest.entry)))
  fail(`The published files have no ${manifest.entry}`);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(path.relative(staging, full).split(path.sep).join("/"));
  }
})(staging);
const bad = files.filter(
  (f) => !registry.parseGamePath(`/g/${id}/${manifest.version}/${f}`),
);
if (bad.length)
  fail(
    `These files cannot be served (hidden or unsafe names):\n  ${bad.join("\n  ")}`,
  );
console.log(`\n${id} ${manifest.version}: ${files.length} files`);

if (flag("--dry-run")) {
  console.log(`✓ Dry run: built into ${staging}. Nothing was uploaded.`);
  process.exit(0);
}

if (registry.localDir()) {
  const target = path.join(registry.localDir(), "games", id, manifest.version);
  if (existsSync(target)) fail(`${target} already exists`);
  mkdirSync(target, { recursive: true });
  cpSync(staging, target, { recursive: true });
} else {
  const destination = `gs://${registry.bucket()}/games/${id}/${manifest.version}/`;
  // Never overwrite a published version, even if the registry missed it.
  const listing = spawnSync("gcloud", ["storage", "ls", destination], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (listing.status === 0 && listing.stdout.trim())
    fail(`${destination} already has files`);
  run("gcloud", [
    "storage",
    "rsync",
    "--recursive",
    "--no-clobber",
    staging,
    destination,
  ]);
}

const channel = flag("--beta") ? "beta" : "live";
const record = await registry
  .updateRecord(id, (current) =>
    registry.addVersion(current, manifest, { channel }),
  )
  .catch((error) => fail(error.message));
const play = channel === "beta" ? `/play/${id}/?v=beta` : `/play/${id}/`;
console.log(
  `\n✓ Published ${id} ${manifest.version} as ${channel} (${where}).`,
);
console.log(
  `  live ${record.live ?? "none"}, beta ${record.beta ?? "none"}, ${record.status}`,
);
console.log(`  Play it at ${play} (visitors see it within about 30 seconds).`);
