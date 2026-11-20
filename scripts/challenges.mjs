// Saved challenges (src/data/challenge.mjs). When a game asks for a challenge
// link (dingn.challengeLink), the player page saves the challenge here and
// the link carries only its id, so the score a friend sees is the one the
// game reported, not one typed into the address.
//
//   POST /api/challenges { game, mode, seed?, score, unit } → { id }
//   GET  /api/challenges/<id> → { id, game, mode, seed?, score, unit }
//
// Each one is a server-only Firestore document, `challenges/{id}`:
//
//   { game, mode, seed, score, unit, uid, createdAt, public: false }
//
// `uid` is the signed-in player who made it (null for a guest). Challenges are
// private: only someone with the link can open one, and nothing lists them.
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

/** Challenges one player (or address, for guests) may save in 10 minutes. */
export const MAX_PER_WINDOW = 30;
const WINDOW_MS = 600_000;
const recent = new Map();

function limit(key, now = Date.now()) {
  for (const [k, times] of recent)
    if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW)
    throw new ApiError(429, "too-many-requests");
  times.push(now);
  recent.set(key, times);
}

/** A new challenge id: 12 random URL-safe characters (72 bits). */
export const newChallengeId = () => randomBytes(9).toString("base64url");

/** What anyone with the link may see of a saved challenge. */
export function shownChallenge(id, doc) {
  if (!doc || typeof doc.game !== "string") return null;
  const challenge = validChallenge(doc);
  return challenge ? { id, game: doc.game, ...challenge } : null;
}

/** The saved challenge `id` (checked, without who made it), or null. */
export async function findChallenge(id) {
  if (typeof id !== "string" || !CHALLENGE_ID.test(id)) return null;
  return shownChallenge(id, await getDoc("challenges", id));
}

/** The signed-in player's uid, or null for a guest (or a stale session). */
async function maker(req, res, verify, exchange) {
  if (!hasSession(req)) return null;
  try {
    const token = await exchange(req, res);
    const check =
      verify ??
      (async (t) =>
        (
          await (await import("./games-admin.mjs")).firebaseAuth()
        ).verifyIdToken(t));
    return (await check(token)).uid ?? null;
  } catch {
    return null;
  }
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
  { verify, exchange = refresh } = {},
) {
  try {
    if (pathname !== "/api/challenges") {
      if (req.method !== "GET") throw new ApiError(405, "method-not-allowed");
      throttle(req);
      const found = await findChallenge(
        pathname.slice("/api/challenges/".length),
      );
      if (!found) throw new ApiError(404, "not-found");
      // A saved challenge never changes, but one may be taken down.
      return send(res, 200, found, "public, max-age=300");
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
    const uid = await maker(req, res, verify, exchange);
    limit(uid ?? `ip:${req.socket.remoteAddress ?? "unknown"}`);
    const id = newChallengeId();
    await mergeDoc("challenges", id, {
      game: body.game,
      ...challenge,
      seed: challenge.seed ?? null,
      uid,
      createdAt: new Date().toISOString(),
      public: false,
    });
    return send(res, 200, { id });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("challenges", error);
    send(res, 503, { error: "unavailable" });
  }
}
