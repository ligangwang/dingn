// Uploads by outside developers. A developer (an account with the
// `developer: true` claim, which admins grant on /admin/games/) uploads a zip
// of their built game on /developers/games/. The server checks it, stores it
// at the same immutable path as every published version, and adds it to the
// registry as the game's beta. Only an admin making it live publishes it, so
// every upload is reviewed first.
//
// A game uploaded this way belongs to the developer who first uploaded its
// id: `owner` on the registry record. Nobody else can upload to it, and games
// published from the repository (which have no owner) cannot be uploaded to.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, refresh, validateOrigin } from "./api.mjs";
import { firebaseAuth } from "./games-admin.mjs";
import {
  addVersion,
  bucket,
  clearRegistryCache,
  compareVersions,
  isPreview,
  listRecords,
  localDir,
  parseGamePath,
  types,
  updateRecord,
  validateManifest,
} from "./game-registry.mjs";
import { ZIP_LIMITS, ZipError, unzip } from "./zip.mjs";

export const developerGameRoutes = [
  "/api/developer/games",
  "/api/developer/games/upload",
];

/** An upload that fails a check, with what to fix in `detail`. */
export class UploadError extends ApiError {
  constructor(status, code, detail = "") {
    super(status, code);
    this.detail = detail;
  }
}

/** How long an interrupted upload keeps its version reserved. */
const PENDING_MS = 10 * 60 * 1000;

/**
 * Turns the files of an uploaded zip into a manifest and the files to
 * publish. game.json may be at the top of the zip or inside one folder.
 * Throws UploadError.
 */
export function prepareUpload(zipped) {
  let prefix = "";
  if (!zipped["game.json"]) {
    const tops = new Set(Object.keys(zipped).map((n) => n.split("/")[0]));
    const [top] = tops;
    if (tops.size === 1 && zipped[`${top}/game.json`]) prefix = `${top}/`;
    else throw new UploadError(400, "no-manifest");
  }
  const files = {};
  for (const [name, data] of Object.entries(zipped))
    if (name.startsWith(prefix)) files[name.slice(prefix.length)] = data;

  let manifest;
  try {
    manifest = validateManifest(
      JSON.parse(files["game.json"].toString("utf8")),
    );
  } catch (error) {
    throw new UploadError(
      400,
      "invalid-manifest",
      error instanceof SyntaxError
        ? "game.json is not valid JSON."
        : error.message,
    );
  }
  const unsupported = [],
    bad = [];
  for (const name of Object.keys(files)) {
    if (!types[path.extname(name).toLowerCase()]) unsupported.push(name);
    const encoded = name.split("/").map(encodeURIComponent).join("/");
    if (!parseGamePath(`/g/${manifest.id}/${manifest.version}/${encoded}`))
      bad.push(name);
  }
  if (bad.length) throw new UploadError(400, "bad-file", bad.join(", "));
  if (unsupported.length)
    throw new UploadError(400, "unsupported-type", unsupported.join(", "));
  if (!files[manifest.entry])
    throw new UploadError(400, "missing-entry", manifest.entry);
  return { manifest, files };
}

/**
 * Reserves an id and version for a developer before any file is stored, so
 * two developers can never write the same game's files. Throws UploadError.
 */
export function reserveUpload(record, manifest, developer, now = Date.now()) {
  if (record && record.owner !== developer.uid)
    throw new UploadError(403, "not-your-game", manifest.id);
  if (record?.versions?.[manifest.version])
    throw new UploadError(409, "version-exists", manifest.version);
  const pending = record?.pending?.[manifest.version];
  if (pending && now - Date.parse(pending.startedAt) < PENDING_MS)
    throw new UploadError(409, "upload-in-progress");
  return {
    id: manifest.id,
    status: "unlisted",
    live: null,
    beta: null,
    versions: {},
    ...record,
    owner: developer.uid,
    ownerEmail: developer.email,
    pending: {
      ...record?.pending,
      [manifest.version]: { startedAt: new Date(now).toISOString() },
    },
  };
}

/** Adds the stored version as the game's beta. */
export function finishUpload(
  record,
  manifest,
  developer,
  now = new Date().toISOString(),
) {
  if (!record || record.owner !== developer.uid)
    throw new UploadError(403, "not-your-game", manifest.id);
  const { [manifest.version]: _done, ...pending } = record.pending ?? {};
  const next = addVersion({ ...record, pending }, manifest, {
    channel: "beta",
    now,
  });
  next.versions[manifest.version].uploadedBy = developer.uid;
  return next;
}

let storagePromise;
async function storageBucket() {
  storagePromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase-admin/app");
    const { getStorage } = await import("firebase-admin/storage");
    const app =
      getApps().find((a) => a.name === "dingn-games-upload") ||
      initializeApp(
        { projectId: process.env.FIREBASE_PROJECT_ID || "dingn-193716" },
        "dingn-games-upload",
      );
    return getStorage(app).bucket(bucket());
  })();
  return storagePromise;
}

/** Stores one game file where /g/<id>/<version>/<name> serves it. */
async function saveFile(id, version, name, data) {
  if (localDir()) {
    const target = path.join(
      localDir(),
      "games",
      id,
      version,
      ...name.split("/"),
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return;
  }
  await (
    await storageBucket()
  )
    .file(`games/${id}/${version}/${name}`)
    .save(data, {
      resumable: false,
      contentType: types[path.extname(name).toLowerCase()],
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
}

/** What a developer sees about one of their games. */
export function developerGame(record) {
  return {
    id: record.id,
    status: record.status ?? "unlisted",
    live: record.live ?? null,
    beta: record.beta ?? null,
    versions: Object.entries(record.versions ?? {})
      .map(([version, v]) => ({
        version,
        title: v.title,
        publishedAt: v.publishedAt ?? null,
        reviewed: !isPreview(record, v),
      }))
      .sort((a, b) => compareVersions(b.version, a.version)),
  };
}

async function readZip(req, max) {
  if (Number(req.headers["content-length"]) > max)
    throw new UploadError(413, "too-large");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new UploadError(413, "too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

/**
 * POST /api/developer/games         → { developer, games } for the signed-in account
 * POST /api/developer/games/upload  → a zip body; adds it as the game's beta
 *
 * `verify`, `exchange` and `save` replace the Admin SDK token check, the
 * session cookie exchange and file storage in tests.
 */
export async function handleDeveloperGames(
  req,
  res,
  pathname,
  { verify, exchange = refresh, save = saveFile } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const uploading = pathname === "/api/developer/games/upload";
    validateOrigin(req, uploading ? "application/zip" : "application/json");
    const token = await exchange(req, res);
    let claims;
    try {
      claims = await (
        verify ?? (async (t) => (await firebaseAuth()).verifyIdToken(t))
      )(token);
    } catch {
      throw new ApiError(401, "invalid-credential");
    }
    const isDeveloper = claims.developer === true || claims.admin === true;
    const developer = { uid: claims.uid, email: claims.email ?? "" };

    if (!uploading) {
      if (!isDeveloper) return send(res, 200, { developer: false, games: [] });
      const games = (await listRecords())
        .filter((r) => r.owner === developer.uid)
        .map(developerGame)
        .sort((a, b) => a.id.localeCompare(b.id));
      return send(res, 200, { developer: true, games });
    }

    if (!isDeveloper) throw new ApiError(403, "developer-required");
    let zipped;
    try {
      zipped = unzip(await readZip(req, ZIP_LIMITS.maxZip));
    } catch (error) {
      if (error instanceof ZipError)
        throw new UploadError(
          error.code === "too-large" ? 413 : 400,
          error.code,
          error.detail,
        );
      throw error;
    }
    const { manifest, files } = prepareUpload(zipped);
    await updateRecord(manifest.id, (record) =>
      reserveUpload(record, manifest, developer),
    );
    const names = Object.keys(files);
    for (let i = 0; i < names.length; i += 8)
      await Promise.all(
        names
          .slice(i, i + 8)
          .map((name) =>
            save(manifest.id, manifest.version, name, files[name]),
          ),
      );
    const record = await updateRecord(manifest.id, (current) =>
      finishUpload(current, manifest, developer),
    );
    clearRegistryCache();
    console.log(
      "developer upload",
      manifest.id,
      manifest.version,
      developer.uid,
      names.length,
    );
    return send(res, 200, {
      game: developerGame(record),
      version: manifest.version,
      play: `/play/${manifest.id}/?v=${manifest.version}`,
    });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, {
        error: error.message,
        ...(error.detail ? { detail: error.detail } : {}),
      });
    console.error("developer games", error);
    return send(res, 503, { error: "unavailable" });
  }
}
