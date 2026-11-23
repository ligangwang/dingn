// Saved challenges (src/data/challenge.mjs). When a game asks for a challenge
// link (dingn.challengeLink), the player page saves the challenge here and
// the link carries only its id, so the score a friend sees is the one the
// game reported, not one typed into the address.
//
//   POST /api/challenges { game, mode, seed?, score, unit, rules? } → { id }
//   GET  /api/challenges/<id> → { id, game, mode, seed?, score, unit, rules?,
//                                 name, mine, results, players }
//   POST /api/challenges/<id>/results { score } → { best, rank, players, improved, beat }
//   POST /api/challenges/<id>/close  → { closed: true }   (its maker, or an admin)
//   POST /api/challenges/<id>/delete → { deleted: true }  (its maker, or an admin)
//   GET  /api/challenges[?game=<id>] → { challenges: [ … ] }  (the open ones)
//
// Each one is a server-only Firestore document, `challenges/{id}`. Its id is
// unique across dingn: all games share the collection, and a new challenge
// is saved only under an id no challenge has ever had.
//
//   { game, mode, seed, score, unit, rules, uid, name, createdAt, public,
//     results, players, test? }
//
// `test` is true when an admin's test account made it (scripts/test-accounts.mjs):
// friends it brings earn no referral coins (scripts/referrals.mjs).
//
// `rules` is the game's own note of the rules the round was played with
// (upgrades, helpers allowed), so the friend plays under the same ones.
//
// `uid` is the signed-in player who made it and `name` their dingn nickname
// when they made it, the one leaderboards show (both null for a guest), so a
// link can say "Ada reached …" instead of "A friend reached …". Opening one
// shows the nickname, never the uid, and `mine` says whether the signed-in
// player opening it is the one who made it (their own score to beat).
//
// A challenge is a thread: its maker's score comes first, and every signed-in
// player who takes it and finishes posts their result under it
// (`results`, each player's best, highest first, at most MAX_RESULTS kept;
// `players` counts everyone who posted). Each player's own best under a
// challenge is also kept on its own, server-only, in
// `challengeResults/{id}_{uid}`, so a player below the kept results is still
// counted once and keeps their best. Scores are the ones games report, so a
// thread pays nothing.
//
// Its maker (or an admin) can close it: it stays readable by its link, takes
// no more results and leaves the list (`closed`, `closedAt`). They can also
// delete it: the document is kept but nothing shows it any more, so its link
// opens the game without a challenge (`deleted`, `deletedAt`). A guest's
// challenge has no maker to do either.
//
// `public` says whether dingn lists it ("Challenge anyone"): true for a
// signed-in player's challenge, false for a guest's, a test account's and
// every challenge from before threads, which only someone with the link can
// open. The open ones of each game are kept, newest first, in one small
// server-only document, `challengeBoards/{game}` ({ threads: [ … ] }, at most
// MAX_LISTED), so listing them reads no more than one document per game.
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
import {
  createDoc,
  getDoc,
  listDocs,
  updateDoc,
  updateMany,
} from "./platform-store.mjs";
import {
  CHALLENGE_ID,
  MAX_SCORE,
  validChallenge,
} from "../src/data/challenge.mjs";
import { hasRole } from "./roles.mjs";

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
/** How many ids a new challenge tries before giving up. */
const ID_TRIES = 5;

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

/** Results a thread keeps and shows: each player's best, highest first. */
export const MAX_RESULTS = 50;
/** Open challenges kept for each game's list. */
export const MAX_LISTED = 20;

/** Highest score first; of equal scores, the one made first. */
const byScore = (a, b) => b.score - a.score || (a.at < b.at ? -1 : 1);

/**
 * A saved challenge's results: the ones posted under it, or, for a challenge
 * from before threads, just its maker's score.
 */
export function resultsOf(doc) {
  if (Array.isArray(doc?.results)) return doc.results;
  return [
    {
      uid: doc.uid ?? null,
      name: doc.name ?? null,
      score: doc.score,
      at: doc.createdAt ?? "",
    },
  ];
}

/**
 * The thread after `uid` posts `score`: a player keeps only their best, so a
 * lower score changes nothing. `own` is the player's best so far under this
 * challenge ({ score }, kept in `challengeResults`), or null for their first
 * result; a thread keeps only its top results, so a player below them is
 * known only by it. Returns the next document and what to tell the player.
 */
export function postResult(
  doc,
  { uid, name, score, now, number = null },
  own = null,
) {
  const before = resultsOf(doc);
  const mine = own ?? before.find((r) => r.uid === uid);
  const improved = !mine || score > mine.score;
  const results = improved
    ? [
        ...before.filter((r) => r.uid !== uid),
        { uid, name, score, at: now, ...(number ? { number } : {}) },
      ]
        .sort(byScore)
        .slice(0, MAX_RESULTS)
    : before;
  const best = improved ? score : mine.score;
  const at = results.findIndex((r) => r.uid === uid);
  const players =
    (typeof doc.players === "number" ? doc.players : before.length) +
    (mine ? 0 : 1);
  return {
    next: improved ? { ...doc, results, players, activeAt: now } : doc,
    outcome: {
      best,
      // Null for a score below every result the thread keeps.
      rank: at < 0 ? null : at + 1,
      players,
      improved,
      beat: score > doc.score,
    },
  };
}

/** Results of each challenge that a game's list shows with it. */
export const LISTED_RESULTS = 5;

/** A player's public number (ten digits, as scripts/game-api.mjs draws them), or null. */
export const playerNumber = (value) =>
  typeof value === "string" && /^[1-9]\d{9}$/.test(value) ? value : null;

/** A thread's first results, as its line on a game's list keeps them. */
const firstResults = (doc) =>
  resultsOf(doc)
    .slice(0, LISTED_RESULTS)
    .map((r) => ({
      uid: r.uid ?? null,
      name: r.name ?? null,
      score: r.score,
      ...(playerNumber(r.number) ? { number: r.number } : {}),
    }));

/**
 * Results as anyone may see them: each with the player's nickname, score and
 * public number (which links their page), never their uid. A result saved
 * before numbers were kept gets its player's from their account. `viewer`
 * marks the signed-in player's own.
 */
export async function shownResults(
  results,
  viewer = null,
  account = (uid) => getDoc("accounts", uid),
) {
  return Promise.all(
    results.map(async (r) => {
      const number =
        playerNumber(r.number) ??
        (r.uid
          ? playerNumber(
              (await Promise.resolve(account(r.uid)).catch(() => null))
                ?.player_no,
            )
          : null);
      return {
        name: nickname(r.name),
        score: r.score,
        ...(number ? { number } : {}),
        ...(viewer && r.uid === viewer ? { mine: true } : {}),
      };
    }),
  );
}

/** What a game's list of open challenges shows of one. */
function listed(id, doc) {
  const results = resultsOf(doc);
  const top = results[0];
  return {
    id,
    mode: doc.mode,
    score: doc.score,
    unit: doc.unit,
    name: nickname(doc.name),
    players: typeof doc.players === "number" ? doc.players : results.length,
    top: top ? { name: nickname(top.name), score: top.score } : null,
    // Its first results, highest first, to show on the list itself.
    results: firstResults(doc),
    createdAt: doc.createdAt,
  };
}

/** A game's list with the challenge `id` added or brought up to date, newest first. */
export function boardWith(board, id, doc) {
  const threads = [
    listed(id, doc),
    ...(board?.threads ?? []).filter((t) => t.id !== id),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_LISTED);
  return { threads };
}

/** A game's list without the challenge `id`. */
export const boardWithout = (board, id) => ({
  threads: (board?.threads ?? []).filter((t) => t.id !== id),
});

/** What anyone with the link may see of a saved challenge; a deleted one shows nothing. */
export function shownChallenge(id, doc) {
  if (!doc || typeof doc.game !== "string" || doc.deleted === true) return null;
  const challenge = validChallenge(doc);
  if (!challenge) return null;
  return {
    id,
    game: doc.game,
    ...challenge,
    name: nickname(doc.name),
    ...(doc.closed === true ? { closed: true } : {}),
  };
}

// The lists of open challenges, kept for half a minute.
const lists = new Map();
const LIST_TTL_MS = 30_000;
/** Forgets the kept lists (after a change, and between tests). */
export const forgetLists = () => lists.clear();

/** The open challenges of one game, or of every game, newest first. */
export async function openChallenges(game = null, now = Date.now()) {
  const key = game ?? "";
  const kept = lists.get(key);
  if (kept && now - kept.at < LIST_TTL_MS) return kept.list;
  const boards = game
    ? [{ id: game, ...(await getDoc("challengeBoards", game)) }]
    : await listDocs("challengeBoards");
  const list = [];
  for (const board of boards) {
    // Only games in the catalog: one that is unlisted or was taken down
    // lists nothing.
    const record = await cachedRecord(board.id);
    if (!record?.live || record.status !== "listed") continue;
    for (const thread of board.threads ?? []) {
      // A line saved before lists carried results: read them from the
      // challenge itself, until its next result saves them on the line.
      const kept =
        thread.results ??
        (await getDoc("challenges", thread.id)
          .then((doc) => (doc ? firstResults(doc) : []))
          .catch(() => []));
      list.push({
        game: board.id,
        ...thread,
        results: await shownResults(kept),
      });
    }
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  lists.set(key, { at: now, list });
  return list;
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
  if (!claims) return { uid: null, name: null, number: null, test: false };
  const profile = await account(claims.uid).catch(() => null);
  return {
    uid: claims.uid,
    name: nickname(profile?.user_name, claims.name),
    // Their public number, which names their page (/player/<number>/).
    number: playerNumber(profile?.player_no),
    test: hasRole(claims, "tester"),
  };
}

/**
 * Posts the signed-in player's result under the challenge `id`. A test
 * account's is checked but not saved ({ test: true }), as its play stays off
 * every board.
 */
async function addResult(req, res, id, { verify, exchange, account }) {
  if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
  validateOrigin(req);
  throttle(req);
  const { score } = await readBody(req);
  if (
    !CHALLENGE_ID.test(id) ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  )
    throw new ApiError(400, "invalid-request");
  const { uid, name, number, test } = await maker(
    req,
    res,
    verify,
    exchange,
    account,
  );
  if (!uid) throw new ApiError(401, "signed-out");
  limit(uid);
  const saved = await getDoc("challenges", id);
  if (!shownChallenge(id, saved)) throw new ApiError(404, "not-found");
  if (saved.closed === true) throw new ApiError(409, "closed");
  const now = new Date().toISOString();
  const post = (doc, own = null) =>
    postResult(doc, { uid, name, score, now, number }, own);
  if (test) return { ...post(saved).outcome, test: true };
  // The thread, its line on the game's list and the player's own best
  // change together.
  let outcome;
  await updateMany(
    [
      ["challenges", id],
      ["challengeBoards", saved.game],
      ["challengeResults", `${id}_${uid}`],
    ],
    ([doc, board, own]) => {
      // Closed or deleted meanwhile: nothing is posted.
      outcome = null;
      if (doc?.closed === true || doc?.deleted === true)
        return [undefined, undefined, undefined];
      const posted = post(doc ?? saved, own);
      outcome = posted.outcome;
      if (!outcome.improved) return [undefined, undefined, undefined];
      return [
        posted.next,
        posted.next.public ? boardWith(board, id, posted.next) : undefined,
        { challenge: id, uid, score, at: now },
      ];
    },
  );
  if (!outcome) throw new ApiError(409, "closed");
  if (outcome.improved && saved.public) forgetLists();
  return outcome;
}

/**
 * Closes or deletes the challenge `id` for its maker, or for an admin (who
 * can take any challenge off dingn). Either way it leaves its game's list.
 * Doing it twice changes nothing.
 */
async function endChallenge(req, res, id, how, { verify, exchange }) {
  if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
  validateOrigin(req);
  throttle(req);
  const claims = await signedIn(req, res, verify, exchange);
  if (!claims) throw new ApiError(401, "signed-out");
  const saved = CHALLENGE_ID.test(id) ? await getDoc("challenges", id) : null;
  if (!shownChallenge(id, saved)) throw new ApiError(404, "not-found");
  if (saved.uid !== claims.uid && !hasRole(claims, "administrator"))
    throw new ApiError(403, "forbidden");
  const now = new Date().toISOString();
  const end = (doc) =>
    how === "delete"
      ? { ...doc, deleted: true, deletedAt: doc.deletedAt ?? now }
      : { ...doc, closed: true, closedAt: doc.closedAt ?? now };
  await updateMany(
    [
      ["challenges", id],
      ["challengeBoards", saved.game],
    ],
    ([doc, board]) => [
      end(doc ?? saved),
      board?.threads?.some((t) => t.id === id)
        ? boardWithout(board, id)
        : undefined,
    ],
  );
  forgetLists();
  return how === "delete" ? { deleted: true } : { closed: true };
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
    newId = newChallengeId,
  } = {},
) {
  try {
    if (pathname !== "/api/challenges") {
      const [id, part, ...more] = pathname
        .slice("/api/challenges/".length)
        .split("/");
      if (part === "results" && !more.length)
        return send(
          res,
          200,
          await addResult(req, res, id, { verify, exchange, account }),
        );
      if ((part === "close" || part === "delete") && !more.length)
        return send(
          res,
          200,
          await endChallenge(req, res, id, part, { verify, exchange }),
        );
      if (part !== undefined) throw new ApiError(404, "not-found");
      if (req.method !== "GET") throw new ApiError(405, "method-not-allowed");
      throttle(req);
      const doc = CHALLENGE_ID.test(id) ? await getDoc("challenges", id) : null;
      const found = shownChallenge(id, doc);
      if (!found) throw new ApiError(404, "not-found");
      // Whether the player opening it made it: then it's their own score to
      // beat. Only a yes or no; the uid itself is never sent. The answer
      // depends on who asks, so nothing may cache it.
      const viewer = await signedIn(req, res, verify, exchange);
      return send(res, 200, {
        ...found,
        mine: !!viewer && !!doc.uid && viewer.uid === doc.uid,
        results: await shownResults(resultsOf(doc), viewer?.uid, account),
        players:
          typeof doc.players === "number" ? doc.players : resultsOf(doc).length,
      });
    }
    if (req.method === "GET") {
      throttle(req);
      const game = new URL(req.url, "http://x").searchParams.get("game");
      if (game != null && !ID.test(game))
        throw new ApiError(400, "invalid-request");
      return send(res, 200, { challenges: await openChallenges(game) });
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
    const { uid, name, number, test } = await maker(
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
    const createdAt = new Date().toISOString();
    const doc = {
      game: body.game,
      ...challenge,
      seed: challenge.seed ?? null,
      rules: challenge.rules ?? null,
      uid,
      name,
      createdAt,
      // "Challenge anyone": a signed-in player's challenge is listed. A
      // guest's has nobody behind it, so only its link opens it.
      public: !!uid && !test,
      // The thread starts with its maker's score.
      results: [
        {
          uid,
          name,
          score: challenge.score,
          at: createdAt,
          ...(number ? { number } : {}),
        },
      ],
      players: 1,
      // Made by a test account: it brings no referral coins.
      ...(test ? { test: true } : {}),
    };
    // One id names one challenge across all of dingn, for good: every game's
    // challenges share this collection, and a challenge is only ever created
    // under an id nothing holds (a deleted challenge keeps its id too). Ids
    // are random, so a taken one is next to impossible; if it happens, the
    // challenge gets another.
    let id = null;
    for (let i = 0; i < ID_TRIES && id == null; i++) {
      const tried = newId();
      if (!CHALLENGE_ID.test(tried)) throw new Error("bad challenge id");
      if (await createDoc("challenges", tried, doc)) id = tried;
    }
    if (id == null) throw new Error("no free challenge id");
    if (doc.public) {
      // The link works without its place on the list, so a failure here
      // doesn't lose the challenge.
      await updateDoc("challengeBoards", body.game, (board) =>
        boardWith(board, id, doc),
      ).catch((error) => console.error("challenges: list", error));
      forgetLists();
    }
    return send(res, 200, { id });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("challenges", error);
    send(res, 503, { error: "unavailable" });
  }
}
