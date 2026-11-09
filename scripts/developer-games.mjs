// Uploads by outside developers. A developer (an account with the
// `developer: true` claim, which admins grant on /admin/games/) uploads a zip
// of their built game on /developers/games/. The server checks it, stores it
// at the same immutable path as every published version, and adds it to the
// registry as the game's beta. Only an admin making it live publishes it, so
// every upload is reviewed first.
//
// Anyone with a verified email can become a developer on that page by
// accepting the developer agreement (/developers/agreement/), which sets the
// claim and records the acceptance in Firestore `developers/{uid}`. An admin
// who removes a developer also blocks them from signing up again.
//
// A game uploaded this way belongs to the developer who first uploaded its
// id: `owner` on the registry record. Nobody else can upload to it, and games
// published from the repository (which have no owner) cannot be uploaded to.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, readBody, refresh, validateOrigin } from "./api.mjs";
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
import { queueMail, reviewers } from "./mail.mjs";
import { mergeDoc } from "./platform-store.mjs";
import { playsFor } from "./game-stats.mjs";

export const developerGameRoutes = [
  "/api/developer/games",
  "/api/developer/games/upload",
  "/api/developer/join",
];

/** The developer agreement's version; /developers/agreement/ shows it. */
export const AGREEMENT_VERSION = "2026-11-09";
/** How many games one developer can own, and upload in a day. */
export const LIMITS = { games: 10, uploadsPerDay: 20 };

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
  if (record?.status === "removed")
    throw new UploadError(403, "game-removed", manifest.id);
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

/**
 * Checks a developer's upload against LIMITS, given the games they own.
 * Throws UploadError.
 */
export function checkLimits(owned, manifest, developer, now = Date.now()) {
  if (!owned.some((r) => r.id === manifest.id) && owned.length >= LIMITS.games)
    throw new UploadError(403, "too-many-games", String(LIMITS.games));
  const dayAgo = now - 86_400_000;
  let recent = 0;
  for (const record of owned) {
    for (const v of Object.values(record.versions ?? {}))
      if (v.uploadedBy === developer.uid && Date.parse(v.publishedAt) > dayAgo)
        recent++;
    for (const p of Object.values(record.pending ?? {}))
      if (Date.parse(p.startedAt) > dayAgo) recent++;
  }
  if (recent >= LIMITS.uploadsPerDay)
    throw new UploadError(429, "upload-limit", String(LIMITS.uploadsPerDay));
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
export function developerGame(record, plays = null) {
  return {
    id: record.id,
    status: record.status ?? "unlisted",
    removedReason: record.removedReason ?? null,
    plays,
    live: record.live ?? null,
    beta: record.beta ?? null,
    versions: Object.entries(record.versions ?? {})
      .map(([version, v]) => ({
        version,
        title: v.title,
        publishedAt: v.publishedAt ?? null,
        reviewed: !isPreview(record, v),
        rejected: v.rejectReason ?? null,
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
 * Makes the signed-in account a developer once it accepts the agreement.
 * `users` is the Admin SDK's auth.
 */
async function join(claims, body, users) {
  if (body.agree !== true || body.agreement !== AGREEMENT_VERSION)
    throw new ApiError(400, "agreement-required");
  if (claims.developerBlocked === true)
    throw new ApiError(403, "developer-blocked");
  // Review results are emailed, so the address must be the developer's own.
  if (claims.email_verified !== true || !claims.email)
    throw new ApiError(403, "email-not-verified");
  const user = await users.getUser(claims.uid);
  if (user.customClaims?.developerBlocked === true)
    throw new ApiError(403, "developer-blocked");
  await mergeDoc("developers", claims.uid, {
    email: claims.email,
    agreement: AGREEMENT_VERSION,
    agreedAt: new Date().toISOString(),
  });
  await users.setCustomUserClaims(claims.uid, {
    ...user.customClaims,
    developer: true,
  });
  console.log("developer joined", claims.uid);
}

/**
 * POST /api/developer/games         → { developer, games } for the signed-in account
 * POST /api/developer/games/upload  → a zip body; adds it as the game's beta
 * POST /api/developer/join          → { agree: true, agreement } signs up
 *
 * `verify`, `exchange`, `save` and `users` replace the Admin SDK token check,
 * the session cookie exchange, file storage and user accounts in tests.
 */
export async function handleDeveloperGames(
  req,
  res,
  pathname,
  { verify, exchange = refresh, save = saveFile, users } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    const uploading = pathname === "/api/developer/games/upload";
    validateOrigin(req, uploading ? "application/zip" : "application/json");
    const body =
      pathname === "/api/developer/join" ? await readBody(req) : null;
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

    if (body) {
      if (!isDeveloper)
        await join(claims, body, users ?? (await firebaseAuth()));
      return send(res, 200, { developer: true });
    }

    if (!uploading) {
      if (!isDeveloper)
        return send(res, 200, {
          developer: false,
          blocked: claims.developerBlocked === true,
          emailVerified: claims.email_verified === true,
          agreement: AGREEMENT_VERSION,
          games: [],
        });
      const owned = (await listRecords()).filter(
        (r) => r.owner === developer.uid,
      );
      const games = (
        await Promise.all(
          owned.map(async (r) =>
            developerGame(r, await playsFor(r.id).catch(() => null)),
          ),
        )
      ).sort((a, b) => a.id.localeCompare(b.id));
      return send(res, 200, {
        developer: true,
        agreement: AGREEMENT_VERSION,
        limits: LIMITS,
        games,
      });
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
    if (claims.admin !== true)
      checkLimits(
        (await listRecords()).filter((r) => r.owner === developer.uid),
        manifest,
        developer,
      );
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
    const title = manifest.title.en;
    await queueMail(
      reviewers(),
      `dingn: ${title} ${manifest.version} is waiting for review`,
      `${developer.email || developer.uid} uploaded ${title} (${manifest.id}) ${manifest.version}.\n\nTry it: https://dingn.com/play/${manifest.id}/?v=${manifest.version}\nReview it: https://dingn.com/admin/games/`,
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
