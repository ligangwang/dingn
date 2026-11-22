// Saved challenges (src/data/challenge.mjs). When a game asks for a challenge
// link (dingn.challengeLink), the player page saves the challenge here and
// the link carries only its id, so the score a friend sees is the one the
// game reported, not one typed into the address.
//
//   POST /api/challenges { game, mode, seed?, score, unit, rules? } → { id }
//   GET  /api/challenges/<id> → { id, game, mode, seed?, score, unit, rules?, name, mine }
//
// Each one is a server-only Firestore document, `challenges/{id}`:
//
//   { game, mode, seed, score, unit, rules, uid, name, createdAt, public: false,
//     test? }
//
// `test` is true when an admin's test account made it (scripts/test-accounts.mjs):
// friends it brings earn no referral coins (scripts/referrals.mjs).
//
// `rules` is the game's own note of the rules the round was played with
// (upgrades, helpers allowed), so the friend plays under the same ones.
//
// `uid` is the signed-in player who made it and `name` their dingn nickname
// when they made it, the one leaderboards show (both null for a guest), so a
// link can say "Ada reached …" instead of "A friend reached …". Challenges are
// private: only someone with the link can open one, and nothing lists them.
// Opening one shows the nickname, never the uid, and `mine` says whether the
// signed-in player opening it is the one who made it (their own score to
// beat).
// `public` is always false for now; it is there so a player can later choose
// to share a challenge with the dingn community.
import { randomBytes } from "node:crypto";
import {
  ApiError,
  hasSession,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import { ID, cachedRecord } from "./game-registry.mjs";
import { getDoc, mergeDoc } from "./platform-store.mjs";
import { CHALLENGE_ID, validChallenge } from "../src/data/challenge.mjs";

export const isChallengePath = (pathname) =>
  pathname === "/api/challenges" || pathname.startsWith("/api/challenges/");

/** Challenges one player (or guest) may save in 10 minutes. */
export const MAX_PER_WINDOW = 30;
/** Challenges all guests together may save on one server in 10 minutes. */
export const MAX_GUESTS_PER_WINDOW = 600;
const WINDOW_MS = 600_000;
const recent = new Map();

/**
 * Who a guest is, for their quota: the browser's address as forwarded by the
 * proxy in front (Cloud Run's own address is shared by many guests). A
 * browser can make that header up, which is why guests also share one
 * overall quota.
 */
export function guestKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] ?? "")
    .split(",")[0]
    .trim();
  return `ip:${forwarded || req.socket.remoteAddress || "unknown"}`;
}

function limit(key, max = MAX_PER_WINDOW, now = Date.now()) {
  for (const [k, times] of recent)
    if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= max) throw new ApiError(429, "too-many-requests");
  times.push(now);
  recent.set(key, times);
}

/** A new challenge id: 12 random URL-safe characters (72 bits). */
export const newChallengeId = () => randomBytes(9).toString("base64url");

/**
 * The nickname a challenge shows for its maker: their dingn nickname, else
 * the first word of their sign-in name, at most 24 characters; or null.
 * Control and text-direction characters are dropped, so a name can't
 * rearrange the words around it.
 */
export function nickname(userName, tokenName) {
  const clean = (text) =>
    typeof text === "string"
      ? text
          .replace(
            /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
            "",
          )
          .trim()
      : "";
  const pick = clean(userName) || clean(tokenName).split(/\s+/)[0];
  return pick ? [...pick].slice(0, 24).join("") : null;
}

/** What anyone with the link may see of a saved challenge. */
export function shownChallenge(id, doc) {
  if (!doc || typeof doc.game !== "string") return null;
  const challenge = validChallenge(doc);
  if (!challenge) return null;
  return { id, game: doc.game, ...challenge, name: nickname(doc.name) };
}

/** The saved challenge `id` (checked, with its maker's nickname but not their uid), or null. */
export async function findChallenge(id) {
  if (typeof id !== "string" || !CHALLENGE_ID.test(id)) return null;
  return shownChallenge(id, await getDoc("challenges", id));
}

/** The signed-in player's token claims, or null for a guest (or a stale session). */
async function signedIn(req, res, verify, exchange) {
  if (!hasSession(req)) return null;
  try {
    const token = await exchange(req, res);
    const check =
      verify ??
      (async (t) =>
        (
          await (await import("./games-admin.mjs")).firebaseAuth()
        ).verifyIdToken(t));
    const claims = await check(token);
    return claims?.uid ? claims : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in player's uid and nickname, or nulls for a guest (or a stale
 * session), and whether they are a test account.
 */
async function maker(req, res, verify, exchange, account) {
  const claims = await signedIn(req, res, verify, exchange);
  if (!claims) return { uid: null, name: null, test: false };
  const profile = await account(claims.uid).catch(() => null);
  return {
    uid: claims.uid,
    name: nickname(profile?.user_name, claims.name),
    test: claims.tester === true,
  };
}

const send = (res, status, body, cache = "no-store") => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache,
  });
  res.end(JSON.stringify(body));
};

export async function handleChallenges(
  req,
  res,
  pathname,
  {
    verify,
    exchange = refresh,
    // The player's dingn profile, where their nickname is.
    account = (uid) => getDoc("accounts", uid),
  } = {},
) {
  try {
    if (pathname !== "/api/challenges") {
      if (req.method !== "GET") throw new ApiError(405, "method-not-allowed");
      throttle(req);
      const id = pathname.slice("/api/challenges/".length);
      const doc = CHALLENGE_ID.test(id) ? await getDoc("challenges", id) : null;
      const found = shownChallenge(id, doc);
      if (!found) throw new ApiError(404, "not-found");
      // Whether the player opening it made it: then it's their own score to
      // beat. Only a yes or no; the uid itself is never sent. The answer
      // depends on who asks, so nothing may cache it.
      const viewer = doc.uid
        ? await signedIn(req, res, verify, exchange)
        : null;
      return send(res, 200, {
        ...found,
        mine: !!viewer && viewer.uid === doc.uid,
      });
    }
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    throttle(req);
    const body = await readBody(req);
    const challenge = validChallenge(body);
    if (!challenge || typeof body.game !== "string" || !ID.test(body.game))
      throw new ApiError(400, "invalid-request");
    // Only games on dingn, so made-up ids can't fill the store.
    if (!(await cachedRecord(body.game))) throw new ApiError(404, "not-found");
    const { uid, name, test } = await maker(
      req,
      res,
      verify,
      exchange,
      account,
    );
    if (uid) limit(uid);
    else {
      limit(guestKey(req));
      limit("guests", MAX_GUESTS_PER_WINDOW);
    }
    const id = newChallengeId();
    await mergeDoc("challenges", id, {
      game: body.game,
      ...challenge,
      seed: challenge.seed ?? null,
      rules: challenge.rules ?? null,
      uid,
      name,
      createdAt: new Date().toISOString(),
      public: false,
      // Made by a test account: it brings no referral coins.
      ...(test ? { test: true } : {}),
    });
    return send(res, 200, { id });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("challenges", error);
    send(res, 503, { error: "unavailable" });
  }
}
