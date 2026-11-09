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

/** What the website receives about one game: never the full history. */
export function publicGame(record, requested) {
  const resolved = resolveVersion(record, requested);
  if (!resolved) return null;
  return {
    id: record.id,
    version: resolved.version,
    title: resolved.title,
    description: resolved.description,
    entry: resolved.entry,
    url: `/g/${record.id}/${resolved.version}/${resolved.entry}`,
  };
}

// ---- Registry storage ----

let adminPromise;
async function firestore() {
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
    publishedAt: now,
  };
  return {
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
  return { ...record, [channel]: version, updatedAt: now };
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
    const game = publicGame(
      await cached(`game:${id}`, () => getRecord(id)),
      requested,
    );
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

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
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
  };
  if (file.endsWith(".html")) headers["Content-Security-Policy"] = GAME_CSP;
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
