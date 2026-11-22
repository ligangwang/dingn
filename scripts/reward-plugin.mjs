// Reward systems as plugins, loaded at run time like games. A reward system
// (src/data/reward-systems.ts) uploads a bundle (a zip, see kingdom's
// scripts/build-plugin.mjs):
//
//   reward.json      { system, version, api, rules, ui, css, assets }
//   rules.mjs        its rules in one module with no imports
//   ui.js + chunks   its pages, drawn into an element (mountKingdomPage, …)
//   kingdom.css      their styles
//   assets/…         models and pictures
//
// The files are kept beside the games' (the games bucket, `rewards/<system>/
// <version>/`) and served at /rewards/<system>/<version>/<file>, but only
// once an admin approved the version (scripts/reward-releases.mjs). The
// approved version marked live is the one dingn runs: this server imports its
// rules.mjs (checked against the hash taken at upload) and the pages load its
// ui.js (src/lib/reward-plugin.ts). dingn ships no copy of its own: until a
// version is live and loaded, the rules aren't there and the reward API
// answers 503 (RulesUnavailable).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bucket, localDir, types } from "./game-registry.mjs";
import { getDoc } from "./platform-store.mjs";
import { RELEASE_SYSTEMS, RELEASE_VERSION } from "./reward-systems.mjs";

/** The plugin contract this dingn speaks (kingdom's PLUGIN_API). */
export const PLUGIN_API = 1;

/** What dingn needs of a rules module, by module: the names it calls. */
const NEEDED = {
  rewards: ["grant", "total"],
  coins: ["DAILY_GAME_COINS", "MAX_EARN", "MAX_GAME_COINS", "TIER_COINS"],
  levels: [
    "levelFor",
    "levelProgress",
    "capPlayXp",
    "xpToReach",
    "DAILY_XP_CAP",
  ],
  honors: ["HONORS", "honorName", "honorOf"],
  ledger: [
    "RewardError",
    "awardBadge",
    "badgeXpOwed",
    "buyItem",
    "earnCoins",
    "payBadgeXp",
    "publicBadges",
    "wallet",
  ],
  kingdom: [
    "KingdomError",
    "STAGES",
    "buildIn",
    "building",
    "kingdomView",
    "moveIn",
    "publicKingdom",
    "settleDoc",
  ],
};

/** No version of the rules is loaded yet, or none is live: try again later. */
export class RulesUnavailable extends Error {
  constructor() {
    super("rewards-unavailable");
    this.status = 503;
    this.code = "rewards-unavailable";
  }
}

let current = null;
// The error classes of every rules module loaded, so an error thrown by the
// live rules is still known after a newer version is swapped in.
const ruleErrors = new Set([RulesUnavailable]);

/** The kingdom's rules dingn runs now: the live plugin's. Throws RulesUnavailable. */
export function rules() {
  if (!current) throw new RulesUnavailable();
  return current;
}

/**
 * Runs `module` (a plugin's rules.mjs, as kingdom/rules exports it) as the
 * live rules, or none with null: for tests.
 */
export function setRules(module, version = "test") {
  if (module) {
    checkRules(module);
    ruleErrors.add(module.ledger.RewardError);
    ruleErrors.add(module.kingdom.KingdomError);
  }
  current = module ? Object.freeze({ ...module, version }) : null;
  loadedFor = module ? `set:${version}` : null;
  problem = null;
  return current;
}

/** Whether an error is a rule refusing a request (it carries a status). */
export const isRuleError = (error) =>
  [...ruleErrors].some((type) => error instanceof type);

/** Throws unless `module` has everything dingn calls. */
export function checkRules(module) {
  if (module?.PLUGIN_API !== PLUGIN_API)
    throw new Error(`plugin API ${module?.PLUGIN_API} is not ${PLUGIN_API}`);
  for (const [part, names] of Object.entries(NEEDED))
    for (const name of names)
      if (module[part]?.[name] === undefined)
        throw new Error(`rules have no ${part}.${name}`);
}

// ---------------------------------------------------------------------------
// Bundles: checking an upload, keeping its files, reading them back.

export class BundleError extends Error {
  constructor(code, detail = "") {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** A file name inside a bundle: relative, no hidden parts, no "..". */
const SAFE_FILE = /^[\w-][\w.-]*(\/[\w-][\w.-]*)*$/;

/**
 * Checks an unzipped bundle ({ path: Buffer }) and returns its manifest
 * (reward.json) with the hash of its rules. Throws BundleError.
 */
export function checkBundle(files) {
  const raw = files["reward.json"];
  if (!raw) throw new BundleError("no-manifest");
  let manifest;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new BundleError("invalid-manifest", "reward.json is not JSON");
  }
  const {
    system,
    version,
    api,
    rules: rulesFile,
    ui,
    css,
    assets,
  } = manifest ?? {};
  if (typeof system !== "string" || !Object.hasOwn(RELEASE_SYSTEMS, system))
    throw new BundleError("unknown-reward-system");
  if (typeof version !== "string" || !RELEASE_VERSION.test(version))
    throw new BundleError("invalid-version");
  if (api !== PLUGIN_API)
    throw new BundleError(
      "unsupported-api",
      `dingn speaks plugin API ${PLUGIN_API}, not ${api}`,
    );
  for (const name of Object.keys(files))
    if (!SAFE_FILE.test(name) || !types[path.extname(name).toLowerCase()])
      throw new BundleError("bad-file", name);
  for (const [field, file] of Object.entries({ rules: rulesFile, ui, css }))
    if (typeof file !== "string" || !files[file])
      throw new BundleError("missing-file", `${field}: ${file}`);
  if (typeof assets !== "string" || !SAFE_FILE.test(assets.replace(/\/$/, "")))
    throw new BundleError("invalid-manifest", "assets must be a folder");
  return {
    system,
    version,
    api,
    rules: rulesFile,
    ui,
    css,
    assets: assets.endsWith("/") ? assets : `${assets}/`,
    rulesHash: sha256(files[rulesFile]),
  };
}

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

let storagePromise;
async function storageBucket() {
  storagePromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase-admin/app");
    const { getStorage } = await import("firebase-admin/storage");
    const app =
      getApps().find((a) => a.name === "dingn-rewards-upload") ||
      initializeApp(
        { projectId: process.env.FIREBASE_PROJECT_ID || "dingn-193716" },
        "dingn-rewards-upload",
      );
    return getStorage(app).bucket(bucket());
  })();
  return storagePromise;
}

const objectPath = (system, version, name) =>
  ["rewards", system, version, ...name.split("/")].join("/");

/** Keeps every file of a checked bundle. */
export async function saveBundle(system, version, files) {
  for (const [name, data] of Object.entries(files)) {
    if (localDir()) {
      const target = path.join(
        localDir(),
        "rewards",
        system,
        version,
        ...name.split("/"),
      );
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
      continue;
    }
    await (
      await storageBucket()
    )
      .file(objectPath(system, version, name))
      .save(data, {
        resumable: false,
        contentType: types[path.extname(name).toLowerCase()],
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      });
  }
}

/** One file of a kept bundle, or null if there is none. */
async function readBundleFile(system, version, name) {
  if (localDir()) {
    const target = path.join(
      localDir(),
      "rewards",
      system,
      version,
      ...name.split("/"),
    );
    return existsSync(target) ? readFile(target) : null;
  }
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: "storage.googleapis.com",
          path: `/${bucket()}/${objectPath(system, version, name)
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        },
        (response) => {
          if (response.statusCode === 404) {
            response.resume();
            return resolve(null);
          }
          if (response.statusCode !== 200) {
            response.resume();
            return reject(new Error(`storage ${response.statusCode}`));
          }
          const parts = [];
          response.on("data", (part) => parts.push(part));
          response.on("end", () => resolve(Buffer.concat(parts)));
          response.on("error", reject);
        },
      )
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// The live version: which one it is, and loading its rules on this server.

/** The live version of a system's releases record, with its manifest, or null. */
export function liveRelease(record) {
  const version = record?.live;
  const release = version && record.versions?.[version];
  if (!release?.approvedAt || !release.bundle) return null;
  return { version, ...release.bundle };
}

/** What the pages need to load a system's live plugin, or null with none live. */
export function livePlugin(system, record) {
  const live = liveRelease(record);
  if (!live) return null;
  const base = `/rewards/${system}/${live.version}/`;
  return {
    version: live.version,
    base,
    rules: base + live.rules,
    ui: base + live.ui,
    css: base + live.css,
    assets: base + live.assets,
  };
}

let loading = null;
let loadedFor = null;
let problem = null;

/** The version this server runs and why it isn't the live one, if it isn't. */
export const runtimeStatus = () => ({
  version: current?.version ?? null,
  problem,
});

/**
 * Makes this server run the live version in `record` (the kingdom's
 * rewardReleases document): imports its rules once, checked against the hash
 * taken at upload. With no live version, no rules. A version that fails to
 * load leaves the rules as they were. `read` replaces the storage
 * in tests.
 */
export async function useLive(record, { read = readBundleFile } = {}) {
  const live = liveRelease(record);
  const want = live ? `${live.version}:${live.rulesHash}` : null;
  if (want === loadedFor) return current;
  if (!live) {
    current = null;
    loadedFor = null;
    problem = "no version is live";
    return current;
  }
  try {
    const data = await read("kingdom", live.version, live.rules);
    if (!data) throw new Error(`no ${live.rules} kept`);
    if (sha256(data) !== live.rulesHash)
      throw new Error(`${live.rules} does not match its upload`);
    const dir = path.join(os.tmpdir(), "dingn-rewards");
    await mkdir(dir, { recursive: true });
    const file = path.join(
      dir,
      `kingdom-${live.version}-${live.rulesHash}.mjs`,
    );
    await writeFile(file, data);
    const module = await import(pathToFileURL(file).href);
    checkRules(module);
    ruleErrors.add(module.ledger.RewardError);
    ruleErrors.add(module.kingdom.KingdomError);
    current = Object.freeze({ ...module, version: live.version });
    loadedFor = want;
    problem = null;
    console.log("rewards plugin", "kingdom", live.version);
  } catch (error) {
    // Keep running what was running, and say why on the Rewards page. The
    // next refresh tries again, in case the failure was passing (storage).
    problem = `kingdom ${live.version}: ${error.message}`;
    console.error("rewards plugin", problem);
  }
  return current;
}

/** Reads the kingdom's releases and runs its live version; one read at a time. */
export function refreshPlugins() {
  loading ??= getDoc("rewardReleases", "kingdom")
    .then((record) => useLive(record))
    .catch((error) => console.error("rewards plugin refresh", error))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/**
 * Checks for a new live version now and every minute, so an approval
 * reaches every server instance within about a minute. Resolves once the
 * first check is done.
 */
export async function startPluginRefresh(every = 60_000) {
  const first = refreshPlugins();
  const timer = setInterval(() => void refreshPlugins(), every);
  timer.unref?.();
  await first;
  return timer;
}

// ---------------------------------------------------------------------------
// Serving: GET /rewards/<system>/<version>/<file>, and GET /api/rewards/live.

export const isRewardFilePath = (pathname) => pathname.startsWith("/rewards/");
export const pluginRoutes = ["/api/rewards/live"];

/**
 * Splits /rewards/<system>/<version>/<file>; null for anything else. The
 * version may be "live", for a link that always reaches the live version
 * (the kingdom's credits).
 */
export function parseRewardPath(pathname) {
  const match = /^\/rewards\/([a-z][a-z0-9-]*)\/([^/]+)\/(.+)$/.exec(pathname);
  if (!match) return null;
  let file;
  try {
    file = decodeURIComponent(match[3]);
  } catch {
    return null;
  }
  const [, system, version] = match;
  if (
    !Object.hasOwn(RELEASE_SYSTEMS, system) ||
    (version !== "live" && !RELEASE_VERSION.test(version))
  )
    return null;
  if (!SAFE_FILE.test(file)) return null;
  return { system, version, file };
}

// The releases records, read at most every 30 seconds per instance.
const records = new Map();
async function cachedReleases(system, load = getDoc) {
  const hit = records.get(system);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = load("rewardReleases", system);
  records.set(system, { value, until: Date.now() + 30_000 });
  value.catch(() => records.delete(system));
  return value;
}
export const clearReleaseCache = () => records.clear();

function notFound(res) {
  res.writeHead(404, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
  });
  res.end("Not found");
}

/**
 * Serves a file of an approved version. A version waiting for review, or
 * sent back, is never served: its code runs with dingn's origin.
 */
export async function serveRewardFile(req, res, pathname, { load } = {}) {
  const parsed = parseRewardPath(pathname);
  if (!parsed || (req.method !== "GET" && req.method !== "HEAD"))
    return notFound(res);
  const { system, version, file } = parsed;
  let record;
  try {
    record = await cachedReleases(system, load);
  } catch (error) {
    console.error("reward file", error);
    res.writeHead(503, { "Cache-Control": "no-store" });
    return res.end();
  }
  if (version === "live") {
    const live = liveRelease(record);
    if (!live) return notFound(res);
    res.writeHead(302, {
      Location: `/rewards/${system}/${live.version}/${file
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      "Cache-Control": "public, max-age=60",
    });
    return res.end();
  }
  if (!record?.versions?.[version]?.approvedAt) return notFound(res);
  let data;
  try {
    data = await readBundleFile(system, version, file);
  } catch (error) {
    console.error("reward file", error);
    res.writeHead(502, { "Cache-Control": "no-store" });
    return res.end();
  }
  if (!data) return notFound(res);
  res.writeHead(200, {
    "Content-Type":
      types[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": String(data.length),
    // A version's files never change.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

/** GET /api/rewards/live: where the pages load each live plugin from. */
export async function handlePlugins(req, res, { load } = {}) {
  try {
    const systems = {};
    for (const system of Object.keys(RELEASE_SYSTEMS))
      systems[system] = livePlugin(system, await cachedReleases(system, load));
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      // An approval reaches the pages within a minute.
      "Cache-Control": "public, max-age=60",
    });
    res.end(JSON.stringify(systems));
  } catch (error) {
    console.error("rewards live", error);
    res.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error: "unavailable" }));
  }
}
