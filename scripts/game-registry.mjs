// The game registry: which games exist and which published version of each
// is live. Games are built and published on their own (scripts/publish-game.mjs)
// to a storage bucket at an immutable path per version, and this registry is
// the only thing that changes when a game is released or rolled back. The
// website reads it at request time, so publishing a game never needs a site
// deploy.
//
// Storage:
// - Production: Firestore `games/{id}`, written only by the publisher through
//   the Admin SDK (firestore.rules deny every browser read and write).
// - Local: set GAMES_LOCAL_DIR and the registry is `<dir>/registry.json`, with
//   game files under `<dir>/games/<id>/<version>/`.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import https from "node:https";
import path from "node:path";

export const ID = /^[a-z][a-z0-9]{1,30}$/;
export const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const MAX_TITLE = 80,
  MAX_DESCRIPTION = 300;

// Badges a game can award (scripts/rewards.mjs). dingn draws them, so a game
// picks a tier and either a level number or one of these icons.
export const BADGE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const TIERS = ["bronze", "silver", "gold", "diamond"];
export const BADGE_ICONS = [
  "boss",
  "stars",
  "star",
  "squad",
  "trophy",
  "crown",
  "bolt",
  "heart",
  "target",
  "clock",
];
export const MAX_BADGES = 50;
/**
 * What a badge pays. dingn sets it by tier, the same in every game, so no game
 * can pay more than another for the same effort; review checks the tiers.
 */
export const TIER_COINS = { bronze: 10, silver: 25, gold: 50, diamond: 100 };
/** Most coins all of one game's badges can pay together. */
export const MAX_GAME_COINS = 1000;
// Coins a game may pay a player each UTC day for play itself (rewards.earn),
// such as a failed level that still got somewhere. Apart from MAX_GAME_COINS.
export const DAILY_GAME_COINS = 30;
// The most one rewards.earn call may ask for.
export const MAX_EARN = 10;
const MAX_BADGE_TITLE = 60;

/** Checks a game.json `badges` list. Adds what is wrong to `problems`. */
export function validateBadges(raw, problems) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_BADGES) {
    problems.push(`badges must be a list of up to ${MAX_BADGES}`);
    return [];
  }
  const seen = new Set();
  let total = 0;
  const badges = raw.map((b, i) => {
    const at = `badges[${i}]`;
    const badge = b && typeof b === "object" ? b : {};
    if (typeof badge.id !== "string" || !BADGE_ID.test(badge.id))
      problems.push(
        `${at}.id must be 1-40 lowercase letters, digits or dashes`,
      );
    else if (seen.has(badge.id))
      problems.push(`${at}.id "${badge.id}" is used twice`);
    seen.add(badge.id);
    if (!TIERS.includes(badge.tier))
      problems.push(`${at}.tier must be one of ${TIERS.join(", ")}`);
    const hasLevel = badge.level != null,
      hasIcon = badge.icon != null;
    if (hasLevel === hasIcon)
      problems.push(`${at} needs either a level or an icon`);
    if (
      hasLevel &&
      !(
        Number.isInteger(badge.level) &&
        badge.level >= 1 &&
        badge.level <= 9999
      )
    )
      problems.push(`${at}.level must be a whole number from 1 to 9999`);
    if (hasIcon && !BADGE_ICONS.includes(badge.icon))
      problems.push(`${at}.icon must be one of ${BADGE_ICONS.join(", ")}`);
    const coins = TIER_COINS[badge.tier] ?? 0;
    total += coins;
    for (const lang of ["en", "zh"])
      if (!text(badge.title?.[lang], MAX_BADGE_TITLE))
        problems.push(
          `${at}.title.${lang} is required (up to ${MAX_BADGE_TITLE} characters)`,
        );
    return {
      id: badge.id,
      tier: badge.tier,
      ...(hasLevel ? { level: badge.level } : { icon: badge.icon }),
      coins,
      title: { en: badge.title?.en?.trim(), zh: badge.title?.zh?.trim() },
    };
  });
  if (total > MAX_GAME_COINS)
    problems.push(
      `badges pay ${total} coins in all (${Object.entries(TIER_COINS)
        .map(([tier, n]) => `${tier} ${n}`)
        .join(", ")}); a game can pay at most ${MAX_GAME_COINS}`,
    );
  return badges;
}

// Upgrades a game sells for dingn coins (scripts/rewards.mjs). Each one is
// bought once and kept, like a stronger weapon; `requires` names an upgrade
// that must be bought first, for tiers such as power-1, power-2.
export const MAX_SHOP_ITEMS = 30;
export const MAX_PRICE = 1000;

/** Checks a game.json `shop` list. Adds what is wrong to `problems`. */
export function validateShop(raw, problems) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_SHOP_ITEMS) {
    problems.push(`shop must be a list of up to ${MAX_SHOP_ITEMS}`);
    return [];
  }
  const seen = new Set();
  return raw.map((it, i) => {
    const at = `shop[${i}]`;
    const item = it && typeof it === "object" ? it : {};
    if (typeof item.id !== "string" || !BADGE_ID.test(item.id))
      problems.push(
        `${at}.id must be 1-40 lowercase letters, digits or dashes`,
      );
    else if (seen.has(item.id))
      problems.push(`${at}.id "${item.id}" is used twice`);
    if (!(
      Number.isInteger(item.price) &&
      item.price >= 1 &&
      item.price <= MAX_PRICE
    ))
      problems.push(
        `${at}.price must be a whole number from 1 to ${MAX_PRICE}`,
      );
    if (item.requires != null && !seen.has(item.requires))
      problems.push(`${at}.requires must name an item listed before it`);
    seen.add(item.id);
    for (const lang of ["en", "zh"])
      if (!text(item.title?.[lang], MAX_BADGE_TITLE))
        problems.push(
          `${at}.title.${lang} is required (up to ${MAX_BADGE_TITLE} characters)`,
        );
    return {
      id: item.id,
      price: item.price,
      ...(item.requires != null ? { requires: item.requires } : {}),
      title: { en: item.title?.en?.trim(), zh: item.title?.zh?.trim() },
    };
  });
}

const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";
export const bucket = () => process.env.GAMES_BUCKET || "dingn-193716-games";
export const localDir = () =>
  process.env.GAMES_LOCAL_DIR ? path.resolve(process.env.GAMES_LOCAL_DIR) : "";

/** Orders "1.10.0" after "1.9.3". */
export function compareVersions(a, b) {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

const text = (value, max) =>
  typeof value === "string" && value.trim() && value.length <= max;

/**
 * Checks a game's `game.json`. Returns the cleaned manifest or throws with a
 * message that says what to fix.
 */
export function validateManifest(raw) {
  const problems = [];
  const m = raw && typeof raw === "object" ? raw : {};
  if (!ID.test(m.id ?? ""))
    problems.push(
      "id must be 2-31 lowercase letters or digits, starting with a letter",
    );
  if (!VERSION.test(m.version ?? ""))
    problems.push('version must look like "1.2.3"');
  for (const lang of ["en", "zh"]) {
    if (!text(m.title?.[lang], MAX_TITLE))
      problems.push(
        `title.${lang} is required (up to ${MAX_TITLE} characters)`,
      );
    if (
      m.description?.[lang] != null &&
      !text(m.description[lang], MAX_DESCRIPTION)
    )
      problems.push(
        `description.${lang} must be up to ${MAX_DESCRIPTION} characters`,
      );
  }
  const entry = m.entry ?? "index.html";
  if (
    typeof entry !== "string" ||
    !/^[\w.-]+(\/[\w.-]+)*\.html$/.test(entry) ||
    entry.includes("..")
  )
    problems.push("entry must be a relative .html path");
  const badges = validateBadges(m.badges, problems);
  const shop = validateShop(m.shop, problems);
  if (problems.length)
    throw new Error(`game.json is invalid:\n- ${problems.join("\n- ")}`);
  return {
    id: m.id,
    version: m.version,
    title: { en: m.title.en.trim(), zh: m.title.zh.trim() },
    description: {
      en: m.description?.en?.trim() ?? "",
      zh: m.description?.zh?.trim() ?? "",
    },
    entry,
    badges,
    shop,
  };
}

/**
 * The version to serve for a request: the live version by default, the beta
 * version for `?v=beta`, or any published version by number (for testing and
 * for links that pin a version). Returns null when there is nothing to serve.
 */
export function resolveVersion(record, requested) {
  if (!record) return null;
  const published = record.versions ?? {};
  let version = record.live;
  if (requested === "beta") version = record.beta || record.live;
  else if (requested && VERSION.test(requested)) version = requested;
  if (!version || !published[version]) return null;
  return { version, ...published[version] };
}

/** True for an outside developer's version that was never made live. */
export const isPreview = (record, version) =>
  !!record?.owner && !version?.reviewedAt;

/** What the website receives about one game: never the full history. */
export function publicGame(record, requested) {
  // A game an admin took down plays nowhere.
  if (record?.status === "removed") return null;
  const resolved = resolveVersion(record, requested);
  if (!resolved) return null;
  return {
    id: record.id,
    version: resolved.version,
    title: resolved.title,
    description: resolved.description,
    entry: resolved.entry,
    url: `/g/${record.id}/${resolved.version}/${resolved.entry}`,
    // The badges this version can award, for the player page.
    badges: resolved.badges ?? [],
    // The upgrades this version sells for coins.
    shop: resolved.shop ?? [],
    // A version an outside developer uploaded that dingn has not made live
    // yet. The player page says so.
    preview: isPreview(record, resolved),
  };
}

// ---- Registry storage ----

let adminPromise;
/** The Admin SDK's Firestore, shared by the platform's server modules. */
export async function firestore() {
  adminPromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app =
      getApps().find((a) => a.name === "dingn-games") ||
      initializeApp({ projectId: PROJECT }, "dingn-games");
    return getFirestore(app);
  })();
  return adminPromise;
}

async function readLocal() {
  try {
    return JSON.parse(
      await readFile(path.join(localDir(), "registry.json"), "utf8"),
    );
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}

export async function getRecord(id) {
  if (!ID.test(id)) return null;
  if (localDir()) return (await readLocal())[id] ?? null;
  const snap = await (await firestore()).collection("games").doc(id).get();
  return snap.exists ? snap.data() : null;
}

export async function listRecords() {
  if (localDir()) return Object.values(await readLocal());
  const snap = await (await firestore()).collection("games").get();
  return snap.docs.map((d) => d.data());
}

/**
 * Applies `change(record)` to one game's record. In Firestore this runs in a
 * transaction, so two publishes at once cannot lose each other's versions.
 */
export async function updateRecord(id, change) {
  if (!ID.test(id)) throw new Error(`Invalid game id "${id}"`);
  if (localDir()) {
    const all = await readLocal();
    all[id] = change(all[id] ?? null);
    await mkdir(localDir(), { recursive: true });
    await writeFile(
      path.join(localDir(), "registry.json"),
      JSON.stringify(all, null, 2) + "\n",
    );
    return all[id];
  }
  const db = await firestore();
  const ref = db.collection("games").doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = change(snap.exists ? snap.data() : null);
    tx.set(ref, next);
    return next;
  });
}

/** Adds a published version to a record, optionally making it live or beta. */
export function addVersion(
  record,
  manifest,
  { channel = "live", listed, now = new Date().toISOString() } = {},
) {
  const versions = { ...(record?.versions ?? {}) };
  if (versions[manifest.version])
    throw new Error(
      `${manifest.id} ${manifest.version} is already published. Published versions never change, so bump "version" in game.json.`,
    );
  versions[manifest.version] = {
    title: manifest.title,
    description: manifest.description,
    entry: manifest.entry,
    ...(manifest.badges?.length ? { badges: manifest.badges } : {}),
    ...(manifest.shop?.length ? { shop: manifest.shop } : {}),
    publishedAt: now,
  };
  return {
    // Keeps fields such as an outside developer's ownership.
    ...record,
    id: manifest.id,
    // "listed" games appear in the catalog; "unlisted" ones play only by URL.
    status:
      listed == null
        ? (record?.status ?? "unlisted")
        : listed
          ? "listed"
          : "unlisted",
    live: channel === "live" ? manifest.version : (record?.live ?? null),
    beta: channel === "beta" ? manifest.version : (record?.beta ?? null),
    versions,
    updatedAt: now,
  };
}

/** Points a channel at an already-published version (a release or a rollback). */
export function pointChannel(
  record,
  version,
  channel = "live",
  now = new Date().toISOString(),
) {
  if (!record) throw new Error("That game has never been published.");
  if (!record.versions?.[version])
    throw new Error(
      `Version ${version} was never published. Published: ${
        Object.keys(record.versions ?? {})
          .sort(compareVersions)
          .join(", ") || "none"
      }`,
    );
  // Making a version live is how dingn approves a developer's upload.
  const versions =
    channel === "live" && !record.versions[version].reviewedAt
      ? {
          ...record.versions,
          [version]: { ...record.versions[version], reviewedAt: now },
        }
      : record.versions;
  return { ...record, versions, [channel]: version, updatedAt: now };
}

// ---- HTTP: the registry API and the game files ----

// Registry reads are cached briefly per server instance, so a release reaches
// every visitor within this many milliseconds.
const CACHE_MS = 30_000;
const cache = new Map();
async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await load();
  cache.set(key, { value, until: Date.now() + CACHE_MS });
  return value;
}
export const clearRegistryCache = () => cache.clear();
/** Every game's record, from the short cache. */
export const cachedRecords = () => cached("list", listRecords);
/** One game's record, from the short cache. */
export const cachedRecord = (id) => cached(`game:${id}`, () => getRecord(id));

function sendJson(res, status, body, maxAge = 0) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
  });
  res.end(JSON.stringify(body));
}

/** True for the paths handleGames serves. */
export const isGamesPath = (pathname) =>
  pathname === "/api/games" ||
  pathname.startsWith("/api/games/") ||
  pathname.startsWith("/g/");

/**
 * GET /api/games            → listed games, live versions
 * GET /api/games/<id>?v=…   → one game at the requested version
 * GET /g/<id>/<version>/…   → a published game file
 */
export async function handleGames(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  try {
    if (pathname.startsWith("/g/"))
      return await serveGameFile(req, res, pathname);
    const url = new URL(req.url, "http://localhost");
    if (pathname === "/api/games" || pathname === "/api/games/") {
      const games = await cached("list", listRecords);
      return sendJson(
        res,
        200,
        {
          games: games
            .filter((r) => r.status === "listed")
            .map((r) => publicGame(r))
            .filter(Boolean),
        },
        30,
      );
    }
    const id = pathname.slice("/api/games/".length).replace(/\/$/, "");
    const requested = url.searchParams.get("v") ?? "";
    const game = publicGame(await cachedRecord(id), requested);
    if (!game) return sendJson(res, 404, { error: "not_found" });
    // A pinned version never changes; the live pointer can move at any time.
    return sendJson(
      res,
      200,
      game,
      requested && requested !== "beta" ? 3600 : 30,
    );
  } catch (error) {
    console.error("games api", error);
    if (!res.headersSent) sendJson(res, 503, { error: "unavailable" });
    else res.end();
  }
}

export const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".bin": "application/octet-stream",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml",
  ".atlas": "text/plain; charset=utf-8",
  ".fnt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/**
 * Splits /g/<id>/<version>/<file> and rejects anything that could leave the
 * game's own folder. Returns null for an invalid path.
 */
export function parseGamePath(pathname) {
  const match = /^\/g\/([^/]+)\/([^/]+)\/(.+)$/.exec(pathname);
  if (!match) return null;
  const [, id, version, rest] = match;
  let file;
  try {
    file = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (!ID.test(id) || !VERSION.test(version)) return null;
  const parts = file.split("/");
  if (
    parts.some(
      (p) =>
        !p || p === "." || p === ".." || p.startsWith(".") || /[\\\0]/.test(p),
    )
  )
    return null;
  return { id, version, file };
}

// Game pages always run sandboxed: even opened directly in a tab, a game gets
// an opaque origin, so it can never use the visitor's dingn session cookie or
// storage. It talks to the website only through the game SDK's messages.
export const GAME_CSP =
  "sandbox allow-scripts allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-forms; frame-ancestors 'self'";

/** File types a browser can open as a page that runs scripts. */
const isPage = (file) =>
  [".html", ".htm", ".xhtml", ".svg", ".xml"].includes(
    path.extname(file).toLowerCase(),
  );

function fileHeaders(file) {
  const headers = {
    "Content-Type":
      types[path.extname(file).toLowerCase()] || "application/octet-stream",
    // Published versions are immutable.
    "Cache-Control": "public, max-age=31536000, immutable",
    // The sandboxed game has an opaque ("null") origin, so module scripts and
    // fetches from it are cross-origin requests.
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
    // Every game file is sandboxed, whatever its type, so no file a game
    // ships can ever run with dingn's origin.
    "Content-Security-Policy": GAME_CSP,
  };
  if (isPage(file)) {
    // Pages are checked on every request, because the same URL either plays
    // in the player's frame or redirects to the player (serveGameFile).
    headers["Cache-Control"] = "no-cache";
    headers["Vary"] = "Sec-Fetch-Dest";
  }
  return headers;
}

async function serveGameFile(req, res, pathname) {
  const parsed = parseGamePath(pathname);
  if (!parsed) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  const { id, version, file } = parsed;
  if ((await cachedRecord(id))?.status === "removed") {
    res.writeHead(404, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    });
    res.end("Not found");
    return;
  }
  // A game page opened on its own in a tab goes to the player page instead,
  // so a game is always shown inside dingn's player, with its notices.
  if (isPage(file) && req.headers["sec-fetch-dest"] === "document") {
    res.writeHead(302, {
      Location: `/play/${id}/?v=${version}`,
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }
  if (localDir()) {
    const root = path.join(localDir(), "games", id, version);
    const target = path.resolve(root, file);
    if (
      !target.startsWith(root + path.sep) ||
      !existsSync(target) ||
      !statSync(target).isFile()
    ) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, fileHeaders(file));
    if (req.method === "HEAD") return res.end();
    createReadStream(target).pipe(res);
    return;
  }
  // The bucket is publicly readable (published games are public anyway), so
  // the server only relays the files under its own domain.
  const objectPath = ["games", id, version, ...file.split("/")]
    .map(encodeURIComponent)
    .join("/");
  await new Promise((resolve) => {
    const upstream = https.request(
      {
        hostname: "storage.googleapis.com",
        path: `/${bucket()}/${objectPath}`,
        method: req.method,
      },
      (response) => {
        const status = response.statusCode || 502;
        if (status !== 200) {
          response.resume();
          res.writeHead(status === 403 || status === 404 ? 404 : 502, {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
          });
          res.end(
            status === 403 || status === 404
              ? "Not found"
              : "Game temporarily unavailable",
          );
          return resolve();
        }
        const headers = fileHeaders(file);
        if (response.headers["content-length"])
          headers["Content-Length"] = response.headers["content-length"];
        res.writeHead(200, headers);
        response.on("error", () => res.destroy());
        response.pipe(res).on("finish", resolve);
      },
    );
    upstream.setTimeout(15000, () =>
      upstream.destroy(new Error("Upstream timeout")),
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Game temporarily unavailable");
      resolve();
    });
    req.on("aborted", () => upstream.destroy());
    upstream.end();
  });
}
