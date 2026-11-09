// Upload keys: let a developer upload from a script or CI (such as a GitHub
// Action) instead of the My games page. A developer creates a key on
// /developers/games/ and sends it as `Authorization: Bearer <key>` with the
// zip to /api/developer/games/upload. The key acts as that developer, with
// the same ownership, limits and review as an upload from the page.
//
// A key is `dgk.<uid>.<id>.<secret>`. Only a SHA-256 hash of the secret is
// stored, in the developer's `developers/{uid}` record (`keys`), so the key is
// shown once, when it is created. Every use checks the account's current
// claims, so removing or blocking a developer stops their keys at once.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "./api.mjs";
import { getDoc, updateDoc } from "./platform-store.mjs";

/** How many keys one developer can have at a time. */
export const MAX_KEYS = 5;
const PREFIX = "dgk";

const hash = (secret) => createHash("sha256").update(secret).digest("hex");

/** What the page may see of a key: never its hash. */
export const publicKey = ({ id, name, createdAt, lastUsedAt }) => ({
  id,
  name,
  createdAt,
  lastUsedAt: lastUsedAt ?? null,
});

/** The developer's keys, newest first. */
export async function listKeys(uid) {
  const keys = (await getDoc("developers", uid))?.keys ?? [];
  return keys.map(publicKey).reverse();
}

/** Creates a key and returns it, in full, with the key list. */
export async function createKey(uid, rawName, now = new Date().toISOString()) {
  const name = String(rawName ?? "")
    .trim()
    .slice(0, 60);
  if (!name) throw new ApiError(400, "key-name-required");
  const id = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  await updateDoc("developers", uid, (record) => {
    const keys = record?.keys ?? [];
    if (keys.length >= MAX_KEYS) throw new ApiError(400, "too-many-keys");
    return {
      ...record,
      keys: [...keys, { id, name, hash: hash(secret), createdAt: now }],
    };
  });
  return { key: `${PREFIX}.${uid}.${id}.${secret}`, keys: await listKeys(uid) };
}

/** Revokes one key. Revoking a key that is already gone is not an error. */
export async function revokeKey(uid, id) {
  await updateDoc("developers", uid, (record) => ({
    ...record,
    keys: (record?.keys ?? []).filter((k) => k.id !== id),
  }));
  return { keys: await listKeys(uid) };
}

/** Whether a request carries an upload key rather than a session. */
export const hasUploadKey = (req) =>
  /^Bearer dgk\./.test(req.headers.authorization ?? "");

/**
 * Checks the request's upload key and returns the claims of the account it
 * belongs to, as the account has them now. Throws ApiError 401 for an unknown
 * or revoked key.
 */
export async function keyClaims(req, users, now = new Date().toISOString()) {
  const parts = String(req.headers.authorization)
    .slice("Bearer ".length)
    .trim()
    .split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== PREFIX ||
    !parts.every((part) => /^[A-Za-z0-9_-]{1,128}$/.test(part))
  )
    throw new ApiError(401, "invalid-key");
  const [, uid, id, secret] = parts;
  const stored = (await getDoc("developers", uid))?.keys?.find(
    (k) => k.id === id,
  );
  const given = Buffer.from(hash(secret), "hex");
  const expected = Buffer.from(stored?.hash ?? "", "hex");
  if (
    !stored ||
    expected.length !== given.length ||
    !timingSafeEqual(given, expected)
  )
    throw new ApiError(401, "invalid-key");

  let user;
  try {
    user = await users.getUser(uid);
  } catch {
    throw new ApiError(401, "invalid-key");
  }
  const claims = user.customClaims ?? {};
  if (claims.developerBlocked === true)
    throw new ApiError(403, "developer-blocked");
  // Best effort: a failed note of when the key was used never fails an upload.
  await updateDoc("developers", uid, (record) => ({
    ...record,
    keys: (record?.keys ?? []).map((k) =>
      k.id === id ? { ...k, lastUsedAt: now } : k,
    ),
  })).catch(() => {});
  return {
    uid,
    email: user.email ?? "",
    developer: claims.developer === true,
    admin: claims.admin === true,
  };
}
