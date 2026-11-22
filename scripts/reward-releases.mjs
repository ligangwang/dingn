// Releases of dingn's reward systems, reviewed like games. A reward system
// (its own repository, src/data/reward-systems.ts) builds a plugin bundle
// for each version, and its CI uploads the zip here with an upload key of an
// admin, as a developer uploads a game. The version waits on the admin
// Rewards page (/admin/rewards/) until an admin approves or rejects it there,
// or with a review key (scripts/upload-keys.mjs), as with games.
//
// Approving makes the version live: dingn's servers run its rules and its
// pages load its UI within about a minute, with no rebuild
// (scripts/reward-plugin.mjs). Approving an older approved version makes it
// live again, to roll back.
//
//   POST /api/rewards/upload         a zip body                upload key of an admin
//   POST /api/admin/rewards          {}                        admin or review key
//   POST /api/admin/rewards/update   { system, version, action: "approve" | "reject", reason? }
//
// The releases are kept in rewardReleases/{system} (`versions`, and `live`,
// the version dingn runs), which firestore.rules leave closed to browsers.
import { ApiError, readBody, refresh, validateOrigin } from "./api.mjs";
import { VERSION, compareVersions } from "./game-registry.mjs";
import { firebaseAuth } from "./games-admin.mjs";
import { getDoc, updateDoc } from "./platform-store.mjs";
import {
  adminKeyClaims,
  hasAdminKey,
  hasUploadKey,
  keyClaims,
} from "./upload-keys.mjs";
import { queueMail, reviewers } from "./mail.mjs";
import { RELEASE_SYSTEMS, releaseUrl } from "./reward-systems.mjs";
import { hasRole } from "./roles.mjs";
import { ZipError, unzip } from "./zip.mjs";
import {
  BundleError,
  checkBundle,
  clearReleaseCache,
  refreshPlugins,
  runtimeStatus,
  saveBundle,
} from "./reward-plugin.mjs";
export { RELEASE_SYSTEMS, releaseUrl } from "./reward-systems.mjs";

/** A bundle's limits: its models make it bigger than most games. */
export const BUNDLE_LIMITS = {
  maxZip: 40 * 1024 * 1024,
  maxTotal: 80 * 1024 * 1024,
  maxFile: 20 * 1024 * 1024,
  maxFiles: 2000,
};

export const rewardReleaseRoutes = [
  "/api/rewards/upload",
  "/api/admin/rewards",
  "/api/admin/rewards/update",
];
const MAX_REASON = 500;

function checkSystem(system) {
  if (typeof system !== "string" || !Object.hasOwn(RELEASE_SYSTEMS, system))
    throw new ApiError(400, "unknown-reward-system");
}
function checkVersion(version) {
  if (typeof version !== "string" || !VERSION.test(version))
    throw new ApiError(400, "invalid-version");
}

/**
 * Adds an uploaded version to a system's record, waiting for review.
 * Uploading a version that is already there changes nothing.
 */
export function addRelease(record, bundle, by, now) {
  const versions = record?.versions ?? {};
  const { system: _system, version, ...kept } = bundle;
  if (versions[version]) return record;
  return {
    ...record,
    versions: {
      ...versions,
      [version]: { uploadedAt: now, uploadedBy: by, bundle: kept },
    },
  };
}

/** Approves or rejects a waiting version. */
export function reviewRelease(record, { version, action, reason }, by, now) {
  const release = record?.versions?.[version];
  if (!release) throw new ApiError(404, "no-such-version");
  let change;
  // Approving makes a version live. Approving an approved version again
  // makes it live again, to roll back to it; sending one back is too late
  // by then.
  if (action === "approve") {
    if (!release.bundle) throw new ApiError(409, "no-bundle");
    change = release.approvedAt ? {} : { approvedAt: now, approvedBy: by };
  } else if (release.approvedAt) throw new ApiError(409, "already-approved");
  else if (action === "reject") {
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why || why.length > MAX_REASON)
      throw new ApiError(400, "reason-required");
    change = { rejectedAt: now, rejectedBy: by, rejectReason: why };
  } else throw new ApiError(400, "invalid-request");
  const { rejectedAt, rejectedBy, rejectReason, ...kept } = release;
  return {
    ...record,
    ...(action === "approve" ? { live: version } : {}),
    versions: { ...record.versions, [version]: { ...kept, ...change } },
  };
}

/** What the admin page sees of a system's releases, newest first. */
export function adminReleases(system, record, status = null) {
  const { repo } = RELEASE_SYSTEMS[system];
  return {
    system,
    live: record?.live ?? null,
    // What this server runs, and why not the live version if it doesn't.
    running: status,
    versions: Object.entries(record?.versions ?? {})
      .map(([version, v]) => ({
        version,
        url: releaseUrl(system, version),
        notes: `https://github.com/${repo}/releases/tag/v${version}`,
        uploadedAt: v.uploadedAt ?? null,
        approvedAt: v.approvedAt ?? null,
        rejected: v.rejectReason ?? null,
        // Versions sent before bundles can't be made live.
        bundle: Boolean(v.bundle),
      }))
      .sort((a, b) => compareVersions(b.version, a.version)),
  };
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function signedInAdmin(req, res, verify, exchange) {
  const token = await exchange(req, res);
  let decoded;
  try {
    decoded = await (
      verify ?? (async (t) => (await firebaseAuth()).verifyIdToken(t))
    )(token);
  } catch {
    throw new ApiError(401, "invalid-credential");
  }
  if (!hasRole(decoded, "admin")) throw new ApiError(403, "admin-required");
  return { uid: decoded.uid };
}

/** Reads a request body of at most `max` bytes. */
async function readZip(req, max) {
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > max) throw new ApiError(413, "too-large");
    parts.push(part);
  }
  return Buffer.concat(parts);
}

/**
 * `verify`, `exchange`, `users`, `save`, `reload` and `now` replace the
 * token check, the session cookie exchange, the Admin SDK's auth, keeping
 * the bundle's files, loading the live version and the clock in tests.
 */
export async function handleRewardReleases(
  req,
  res,
  pathname,
  {
    verify,
    exchange = refresh,
    users,
    save = saveBundle,
    reload = refreshPlugins,
    now = () => new Date().toISOString(),
  } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");

    if (pathname === "/api/rewards/upload") {
      // Only from CI, with an admin's upload key: the bundle's rules run on
      // dingn's servers once approved, so a developer's key can't send one.
      if (!hasUploadKey(req)) throw new ApiError(401, "upload-key-required");
      const account = await keyClaims(req, users ?? (await firebaseAuth()));
      if (!hasRole(account, "admin")) throw new ApiError(403, "admin-required");
      const files = unzip(
        await readZip(req, BUNDLE_LIMITS.maxZip),
        BUNDLE_LIMITS,
      );
      const bundle = checkBundle(files);
      const known = await getDoc("rewardReleases", bundle.system);
      let record = known;
      if (!known?.versions?.[bundle.version]) {
        await save(bundle.system, bundle.version, files);
        record = await updateDoc("rewardReleases", bundle.system, (r) =>
          addRelease(r, bundle, account.uid, now()),
        );
        console.log(
          "reward release",
          bundle.system,
          bundle.version,
          account.uid,
        );
        await queueMail(
          reviewers(),
          `dingn: ${bundle.system} ${bundle.version} is waiting for review`,
          `${bundle.system} ${bundle.version} was uploaded.\n\nRelease notes: https://github.com/${RELEASE_SYSTEMS[bundle.system].repo}/releases/tag/v${bundle.version}\n\nApprove it to make it live: https://dingn.com/admin/rewards/`,
        ).catch((e) => console.error("reward release mail", e));
      }
      return send(res, 200, adminReleases(bundle.system, record));
    }

    // Reviewing: an admin on the website, or an admin's review key.
    const keyed = hasAdminKey(req);
    if (!keyed) validateOrigin(req);
    const body = await readBody(req);
    const admin = keyed
      ? await adminKeyClaims(req, users ?? (await firebaseAuth()))
      : await signedInAdmin(req, res, verify, exchange);

    if (pathname === "/api/admin/rewards") {
      const systems = await Promise.all(
        Object.keys(RELEASE_SYSTEMS).map(async (id) =>
          adminReleases(
            id,
            await getDoc("rewardReleases", id),
            id === "kingdom" ? runtimeStatus() : null,
          ),
        ),
      );
      return send(res, 200, { systems });
    }

    if (pathname === "/api/admin/rewards/update") {
      checkSystem(body.system);
      checkVersion(body.version);
      const record = await updateDoc("rewardReleases", body.system, (r) =>
        reviewRelease(r, body, admin.uid, now()),
      );
      console.log(
        "reward review",
        body.system,
        body.version,
        body.action,
        keyed ? `by key of ${admin.uid}` : admin.uid,
      );
      // This server runs it at once; the others within a minute.
      clearReleaseCache();
      if (body.action === "approve") await reload();
      return send(
        res,
        200,
        adminReleases(
          body.system,
          record,
          body.system === "kingdom" ? runtimeStatus() : null,
        ),
      );
    }
    throw new ApiError(404, "not-found");
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    if (error instanceof ZipError || error instanceof BundleError)
      return send(res, 400, {
        error: error.code,
        ...(error.detail ? { detail: error.detail } : {}),
      });
    console.error("reward releases", error);
    return send(res, 503, { error: "unavailable" });
  }
}
