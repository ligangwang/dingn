// Releases of dingn's reward systems, reviewed like games. A reward system
// (its own repository and package, src/data/reward-systems.ts) publishes a
// version as a GitHub release; its CI then announces the version here with
// an admin's upload key. The version waits on the admin Rewards page
// (/admin/rewards/) until an admin approves or rejects it there, or with a
// review key (scripts/upload-keys.mjs), as with games.
//
// dingn bundles a reward system when it builds, so approving a version
// can't swap it in at once: it starts the Website workflow, which installs
// the version on main and deploys the site (GitHub's workflow_dispatch, with
// a token in GITHUB_DISPATCH_TOKEN that may run dingn's workflows).
//
//   POST /api/rewards/upload         { system, version }   upload key of an admin
//   POST /api/admin/rewards          {}                     admin or review key
//   POST /api/admin/rewards/update   { system, version, action: "approve" | "reject", reason? }
//
// The releases are kept in rewardReleases/{system}, which firestore.rules
// leave closed to browsers.
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
export { RELEASE_SYSTEMS, releaseUrl } from "./reward-systems.mjs";

/** dingn's repository and the workflow that installs and deploys. */
const DINGN = { repo: "ligangwang/dingn", workflow: "website.yml" };

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
export function addRelease(record, version, by, now) {
  const versions = record?.versions ?? {};
  if (versions[version]) return record;
  return {
    ...record,
    versions: {
      ...versions,
      [version]: { uploadedAt: now, uploadedBy: by },
    },
  };
}

/** Approves or rejects a waiting version. */
export function reviewRelease(record, { version, action, reason }, by, now) {
  const release = record?.versions?.[version];
  if (!release) throw new ApiError(404, "no-such-version");
  if (release.approvedAt) throw new ApiError(409, "already-approved");
  let change;
  if (action === "approve") change = { approvedAt: now, approvedBy: by };
  else if (action === "reject") {
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why || why.length > MAX_REASON)
      throw new ApiError(400, "reason-required");
    change = { rejectedAt: now, rejectedBy: by, rejectReason: why };
  } else throw new ApiError(400, "invalid-request");
  const { rejectedAt, rejectedBy, rejectReason, ...kept } = release;
  return {
    ...record,
    versions: { ...record.versions, [version]: { ...kept, ...change } },
  };
}

/** What the admin page sees of a system's releases, newest first. */
export function adminReleases(system, record) {
  const { repo } = RELEASE_SYSTEMS[system];
  return {
    system,
    versions: Object.entries(record?.versions ?? {})
      .map(([version, v]) => ({
        version,
        url: releaseUrl(system, version),
        notes: `https://github.com/${repo}/releases/tag/v${version}`,
        uploadedAt: v.uploadedAt ?? null,
        approvedAt: v.approvedAt ?? null,
        rejected: v.rejectReason ?? null,
      }))
      .sort((a, b) => compareVersions(b.version, a.version)),
  };
}

/**
 * Starts the Website workflow to install an approved version on main and
 * deploy it. Throws ApiError 503 when dingn can't start workflows.
 */
export async function dispatchInstall(
  system,
  version,
  { token = process.env.GITHUB_DISPATCH_TOKEN, fetchImpl = fetch } = {},
) {
  if (!token) throw new ApiError(503, "deploy-unavailable");
  const response = await fetchImpl(
    `https://api.github.com/repos/${DINGN.repo}/actions/workflows/${DINGN.workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "dingn",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { reward: system, reward_version: version },
      }),
    },
  );
  if (!response.ok) {
    console.error(
      "reward install dispatch",
      response.status,
      await response.text().catch(() => ""),
    );
    throw new ApiError(503, "deploy-unavailable");
  }
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
  if (decoded.admin !== true) throw new ApiError(403, "admin-required");
  return { uid: decoded.uid };
}

/**
 * `verify`, `exchange`, `users`, `dispatch` and `now` replace the token
 * check, the session cookie exchange, the Admin SDK's auth, starting the
 * workflow and the clock in tests.
 */
export async function handleRewardReleases(
  req,
  res,
  pathname,
  {
    verify,
    exchange = refresh,
    users,
    dispatch = dispatchInstall,
    now = () => new Date().toISOString(),
  } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");

    if (pathname === "/api/rewards/upload") {
      // Only from CI, with an admin's upload key: a developer's key can't
      // announce a reward system.
      if (!hasUploadKey(req)) throw new ApiError(401, "upload-key-required");
      const account = await keyClaims(req, users ?? (await firebaseAuth()));
      if (!account.admin) throw new ApiError(403, "admin-required");
      const body = await readBody(req);
      checkSystem(body.system);
      checkVersion(body.version);
      let added = false;
      const record = await updateDoc("rewardReleases", body.system, (r) => {
        const next = addRelease(r, body.version, account.uid, now());
        added = next !== r;
        return next;
      });
      console.log("reward release", body.system, body.version, account.uid);
      if (added)
        await queueMail(
          reviewers(),
          `dingn: ${body.system} ${body.version} is waiting for review`,
          `${body.system} ${body.version} was published.\n\nRelease notes: https://github.com/${RELEASE_SYSTEMS[body.system].repo}/releases/tag/v${body.version}\n\nApprove it to install and deploy it: https://dingn.com/admin/rewards/`,
        ).catch((e) => console.error("reward release mail", e));
      return send(res, 200, adminReleases(body.system, record));
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
          adminReleases(id, await getDoc("rewardReleases", id)),
        ),
      );
      return send(res, 200, { systems });
    }

    if (pathname === "/api/admin/rewards/update") {
      checkSystem(body.system);
      checkVersion(body.version);
      // Check the review before starting a deploy, and save the approval
      // only once the deploy has started.
      const current = await getDoc("rewardReleases", body.system);
      reviewRelease(current, body, admin.uid, now());
      if (body.action === "approve") await dispatch(body.system, body.version);
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
      return send(res, 200, adminReleases(body.system, record));
    }
    throw new ApiError(404, "not-found");
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("reward releases", error);
    return send(res, 503, { error: "unavailable" });
  }
}
