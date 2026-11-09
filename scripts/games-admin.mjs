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
  isPreview,
  listRecords,
  pointChannel,
  updateRecord,
} from "./game-registry.mjs";
import { closeReport, openReports } from "./game-reports.mjs";
import { allPlays } from "./game-stats.mjs";
import { queueMail } from "./mail.mjs";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";
export const adminGameRoutes = [
  "/api/admin/games",
  "/api/admin/games/update",
  "/api/admin/developers",
  "/api/admin/developers/update",
  "/api/admin/reports",
  "/api/admin/reports/update",
];
const MAX_REASON = 500;

let authPromise;
/** The Firebase Admin SDK's auth, shared with the developer uploads API. */
export async function firebaseAuth() {
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
export function adminGame(record, plays = null) {
  return {
    id: record.id,
    status: record.status ?? "unlisted",
    removedReason: record.removedReason ?? null,
    plays,
    live: record.live ?? null,
    beta: record.beta ?? null,
    updatedAt: record.updatedAt ?? null,
    // The outside developer who uploads this game, if it is not dingn's own.
    owner: record.owner ? (record.ownerEmail ?? record.owner) : null,
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

/**
 * Developer access: the `developer: true` claim on an account, which lets it
 * upload games on /developers/games/. `users` is the Admin SDK's auth.
 */
async function developers(pathname, body, users) {
  if (pathname === "/api/admin/developers") {
    const list = [];
    let pageToken;
    do {
      const page = await users.listUsers(1000, pageToken);
      for (const user of page.users)
        if (user.customClaims?.developer === true)
          list.push({ uid: user.uid, email: user.email ?? "" });
      pageToken = page.pageToken;
    } while (pageToken);
    return { developers: list.sort((a, b) => a.email.localeCompare(b.email)) };
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !["add", "remove"].includes(body.action))
    throw new ApiError(400, "invalid-request");
  let user;
  try {
    user = await users.getUserByEmail(email);
  } catch {
    throw new ApiError(404, "user-not-found");
  }
  const {
    developer: _old,
    developerBlocked: _blocked,
    ...claims
  } = user.customClaims ?? {};
  // Removing access also stops the account from signing up again by itself.
  await users.setCustomUserClaims(
    user.uid,
    body.action === "add"
      ? { ...claims, developer: true }
      : { ...claims, developerBlocked: true },
  );
  console.log("games admin developer", body.action, user.uid);
  return { developer: { uid: user.uid, email: user.email ?? email } };
}

const reasonOf = (value) => {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason || reason.length > MAX_REASON)
    throw new ApiError(400, "reason-required");
  return reason;
};

/** The developer account with this email. Throws ApiError. */
async function developerByEmail(value, users) {
  const email = typeof value === "string" ? value.trim() : "";
  if (!email) throw new ApiError(400, "invalid-request");
  let user;
  try {
    user = await users.getUserByEmail(email);
  } catch {
    throw new ApiError(404, "user-not-found");
  }
  // They must have signed up (accepting the agreement) or been added.
  if (user.customClaims?.developer !== true)
    throw new ApiError(400, "not-a-developer");
  return { uid: user.uid, email: user.email ?? email };
}

/** Applies one admin change to a record. Throws ApiError for a bad request. */
export function applyChange(
  record,
  { action, version, reason },
  now = new Date().toISOString(),
) {
  if (!record) throw new ApiError(404, "not-found");
  const removed = record.status === "removed";
  if (removed && action !== "restore") throw new ApiError(400, "game-removed");
  const known = () => {
    if (
      typeof version !== "string" ||
      !VERSION.test(version) ||
      !record.versions?.[version]
    )
      throw new ApiError(400, "unknown-version");
  };
  switch (action) {
    case "set-live":
    case "set-beta": {
      known();
      const next = pointChannel(
        record,
        version,
        action === "set-live" ? "live" : "beta",
        now,
      );
      if (action === "set-live" && next.versions[version].rejectReason) {
        const {
          rejectReason: _r,
          rejectedAt: _a,
          ...kept
        } = next.versions[version];
        next.versions = { ...next.versions, [version]: kept };
      }
      return next;
    }
    case "reject": {
      // Sends a developer's upload back with what to change.
      known();
      if (version === record.live) throw new ApiError(400, "version-is-live");
      return {
        ...record,
        beta: record.beta === version ? null : (record.beta ?? null),
        versions: {
          ...record.versions,
          [version]: {
            ...record.versions[version],
            rejectReason: reasonOf(reason),
            rejectedAt: now,
          },
        },
        updatedAt: now,
      };
    }
    case "clear-beta":
      return { ...record, beta: null, updatedAt: now };
    case "list":
    case "unlist":
      return {
        ...record,
        status: action === "list" ? "listed" : "unlisted",
        updatedAt: now,
      };
    case "take-down":
      // Stops the game everywhere: the player, its files and the catalog.
      return {
        ...record,
        status: "removed",
        removedReason: reasonOf(reason),
        removedAt: now,
        updatedAt: now,
      };
    case "restore": {
      if (!removed) throw new ApiError(400, "invalid-request");
      const { removedReason: _r, removedAt: _a, ...kept } = record;
      return { ...kept, status: "unlisted", updatedAt: now };
    }
    default:
      throw new ApiError(400, "invalid-request");
  }
}

/**
 * Gives a game to a developer, so it is published like any developer's game:
 * from their uploads, through the review queue. The versions it already has
 * were published by dingn, so they count as reviewed.
 */
export function transferGame(record, user, now = new Date().toISOString()) {
  if (!record) throw new ApiError(404, "not-found");
  if (record.status === "removed") throw new ApiError(400, "game-removed");
  const versions = Object.fromEntries(
    Object.entries(record.versions ?? {}).map(([version, v]) => [
      version,
      { ...v, reviewedAt: v.reviewedAt ?? v.publishedAt ?? now },
    ]),
  );
  return {
    ...record,
    versions,
    pending: {},
    owner: user.uid,
    ownerEmail: user.email ?? "",
    updatedAt: now,
  };
}

/** Tells an outside developer what happened to their game. */
export function ownerMail(before, after, { action, version }) {
  const to = after.owner ? after.ownerEmail : "";
  if (!to) return null;
  const title = (v) => after.versions?.[v]?.title?.en ?? after.id;
  const play = `https://dingn.com/play/${after.id}/`;
  if (
    action === "set-live" &&
    !before.versions?.[version]?.reviewedAt &&
    after.versions?.[version]?.reviewedAt
  )
    return {
      to,
      subject: `${title(version)} ${version} is live on dingn`,
      text: `dingn reviewed ${title(version)} ${version}, and it is now the version everyone plays:\n${play}`,
    };
  if (action === "reject")
    return {
      to,
      subject: `${title(version)} ${version} needs changes`,
      text: `dingn reviewed ${title(version)} ${version} and did not make it live yet:\n\n${after.versions[version].rejectReason}\n\nFix it, raise "version" in game.json and upload again at https://dingn.com/developers/games/`,
    };
  if (action === "take-down")
    return {
      to,
      subject: `${title(after.live ?? after.beta)} was taken down from dingn`,
      text: `dingn took ${after.id} down, so players can no longer open it:\n\n${after.removedReason}\n\nReply to this email if you think this is a mistake.`,
    };
  if (action === "transfer")
    return {
      to,
      subject: `${after.id} is now yours on dingn`,
      text: `dingn gave you ${after.id}. Upload its new versions at https://dingn.com/developers/games/, and dingn reviews each one before it goes live.`,
    };
  if (action === "restore")
    return {
      to,
      subject: `${after.id} is back on dingn`,
      text: `dingn restored ${after.id}. It plays again at ${play}`,
    };
  return null;
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
  { verify, exchange = refresh, users } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    const body = await readBody(req);
    const admin = await requireAdmin(
      req,
      res,
      verify ?? (async (t) => (await firebaseAuth()).verifyIdToken(t)),
      exchange,
    );
    if (pathname.startsWith("/api/admin/developers"))
      return send(
        res,
        200,
        await developers(pathname, body, users ?? (await firebaseAuth())),
      );
    if (pathname === "/api/admin/reports")
      return send(res, 200, { reports: await openReports() });
    if (pathname === "/api/admin/reports/update") {
      await closeReport(body.id, body.action, admin.uid);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/games") {
      const [records, plays] = await Promise.all([listRecords(), allPlays()]);
      return send(res, 200, {
        games: records
          .map((r) => adminGame(r, plays[r.id] ?? null))
          .sort((a, b) => a.id.localeCompare(b.id)),
      });
    }
    if (typeof body.id !== "string" || !ID.test(body.id))
      throw new ApiError(400, "invalid-request");
    let before = null;
    let change = applyChange;
    if (body.action === "transfer") {
      const user = await developerByEmail(
        body.email,
        users ?? (await firebaseAuth()),
      );
      change = (record) => transferGame(record, user);
    }
    const updated = await updateRecord(body.id, (record) => {
      before = record;
      return change(record, body);
    });
    clearRegistryCache();
    console.log("games admin", body.id, body.action, body.version ?? "");
    const mail = ownerMail(before, updated, body);
    if (mail) await queueMail(mail.to, mail.subject, mail.text);
    return send(res, 200, { game: adminGame(updated) });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("games admin", error);
    return send(res, 503, { error: "unavailable" });
  }
}
