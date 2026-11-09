// Admin API for the game platform: see every game's published versions and
// move the live and beta pointers, or show and hide a game in the catalog.
// Building and uploading a new version stays in CI (scripts/publish-game.mjs),
// so every version comes from the repository and passed its tests.
//
// Only accounts whose Firebase ID token has `admin: true` (the same claim as
// the feedback inbox) may call these, and only as same-origin POSTs.
import { ApiError, readBody, refresh, validateOrigin } from "./api.mjs";
import {
  ID,
  VERSION,
  clearRegistryCache,
  compareVersions,
  listRecords,
  pointChannel,
  updateRecord,
} from "./game-registry.mjs";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";
export const adminGameRoutes = ["/api/admin/games", "/api/admin/games/update"];

let authPromise;
async function auth() {
  authPromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const app =
      getApps().find((a) => a.name === "dingn-games-admin") ||
      initializeApp({ projectId: PROJECT }, "dingn-games-admin");
    return getAuth(app);
  })();
  return authPromise;
}

/** The signed-in account, verified by the Admin SDK, if it is an admin. */
async function requireAdmin(req, res, verify, exchange) {
  const token = await exchange(req, res);
  let decoded;
  try {
    decoded = await verify(token);
  } catch {
    throw new ApiError(401, "invalid-credential");
  }
  if (decoded.admin !== true) throw new ApiError(403, "admin-required");
  return decoded;
}

/** What the admin page shows for one game: newest version first. */
export function adminGame(record) {
  return {
    id: record.id,
    status: record.status ?? "unlisted",
    live: record.live ?? null,
    beta: record.beta ?? null,
    updatedAt: record.updatedAt ?? null,
    versions: Object.entries(record.versions ?? {})
      .map(([version, v]) => ({
        version,
        title: v.title,
        publishedAt: v.publishedAt ?? null,
      }))
      .sort((a, b) => compareVersions(b.version, a.version)),
  };
}

/** Applies one admin change to a record. Throws ApiError for a bad request. */
export function applyChange(
  record,
  { action, version },
  now = new Date().toISOString(),
) {
  if (!record) throw new ApiError(404, "not-found");
  switch (action) {
    case "set-live":
    case "set-beta":
      if (
        typeof version !== "string" ||
        !VERSION.test(version) ||
        !record.versions?.[version]
      )
        throw new ApiError(400, "unknown-version");
      return pointChannel(
        record,
        version,
        action === "set-live" ? "live" : "beta",
        now,
      );
    case "clear-beta":
      return { ...record, beta: null, updatedAt: now };
    case "list":
    case "unlist":
      return {
        ...record,
        status: action === "list" ? "listed" : "unlisted",
        updatedAt: now,
      };
    default:
      throw new ApiError(400, "invalid-request");
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

/**
 * `verify` and `exchange` replace the Admin SDK token check and the session
 * cookie exchange in tests.
 */
export async function handleAdminGames(
  req,
  res,
  pathname,
  { verify, exchange = refresh } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    const body = await readBody(req);
    await requireAdmin(
      req,
      res,
      verify ?? (async (t) => (await auth()).verifyIdToken(t)),
      exchange,
    );
    if (pathname === "/api/admin/games") {
      const records = await listRecords();
      return send(res, 200, {
        games: records.map(adminGame).sort((a, b) => a.id.localeCompare(b.id)),
      });
    }
    if (typeof body.id !== "string" || !ID.test(body.id))
      throw new ApiError(400, "invalid-request");
    const updated = await updateRecord(body.id, (record) =>
      applyChange(record, body),
    );
    clearRegistryCache();
    console.log("games admin", body.id, body.action, body.version ?? "");
    return send(res, 200, { game: adminGame(updated) });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("games admin", error);
    return send(res, 503, { error: "unavailable" });
  }
}
