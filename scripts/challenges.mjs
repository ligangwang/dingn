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
//   { game, mode, seed, score, unit, rules, uid, createdAt, public, results,
//     players, test? }
//
// `test` is true when an admin's test account made it (scripts/test-accounts.mjs):
// friends it brings earn no referral coins (scripts/referrals.mjs).
//
// `rules` is the game's own note of the rules the round was played with
// (upgrades, helpers allowed), so the friend plays under the same ones.
//
// `uid` is the signed-in player who made it (null for a guest). A player is
// kept only as their uid, on the challenge and on each result: their
// nickname, public number and avatar are read from their account whenever a
// challenge is shown, so a link can say "Ada reached …" instead of "A friend
// reached …" and a player who changes their nickname is renamed everywhere.
// Opening one shows the nickname, never the uid, and `mine` says whether the
// signed-in player opening it is the one who made it (their own score to
// beat). (Challenges and results from before this also hold the `name`,
// `number` and `avatar` of the time, used only if the account can't be read.)
//
// A challenge is a thread: its maker's score comes first, and every signed-in
// player who takes it and finishes posts their result under it
// (`results`, each player's best, highest first, at most MAX_RESULTS kept;
// `players` counts everyone who posted; a result is { uid, score, at }). Each player's own best under a
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
// One level has one open challenge. A level is a game's round: the game,
// mode, seed and unit (`roundKey`), whatever rules it was played with, and
// `challengeRounds/{key}` ({ id }) names the challenge open for it. The first
// signed-in player to challenge a level owns its challenge and can close or
// delete it; a player who challenges a level that already has one joins it
// instead: their score is posted under it and they are told their place.
// Once it is closed or deleted, the next challenge of that level starts a new
// one, with a new owner. (A guest's and a test account's challenges stay
// their own, by their link only.)
//
// `public` says whether dingn lists it ("Challenge anyone"): true for a
// signed-in player's challenge, false for a guest's, a test account's and
// every challenge from before threads, which only someone with the link can
// open. The open ones of each game are kept, newest first, in one small
// server-only document, `challengeBoards/{game}` ({ threads: [ … ] }, at most
// MAX_LISTED), so listing them reads no more than one document per game.
import { createHash, randomBytes } from "node:crypto";
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
import { photoOf } from "./player-photos.mjs";

export const isChallengePath = (pathname) =>
  pathname === "/api/challenges" || pathname.startsWith("/api/challenges/");

/** Challenges one player (or guest) may save in 10 minutes. */
export const MAX_PER_WINDOW = 30;
/** Times one player (or guest) may ask where a score would stand in 10 minutes. */
export const MAX_STANDINGS_PER_WINDOW = 120;
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
export const byScore = (a, b) => b.score - a.score || (a.at < b.at ? -1 : 1);

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
export function postResult(doc, { uid, score, now }, own = null) {
  const before = resultsOf(doc);
  const mine = own ?? before.find((r) => r.uid === uid);
  const improved = !mine || score > mine.score;
  const results = improved
    ? [...before.filter((r) => r.uid !== uid), { uid, score, at: now }]
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

/** A player's chosen avatar (a short word such as "fox"), or null. */
export const playerAvatar = (value) =>
  typeof value === "string" && /^[a-z0-9-]{1,32}$/.test(value) ? value : null;

/** A thread's first results, as its line on a game's list keeps them. */
const firstResults = (doc) =>
  resultsOf(doc)
    .slice(0, LISTED_RESULTS)
    .map((r) => ({
      uid: r.uid ?? null,
      score: r.score,
      // Only on results from before players were kept by uid alone.
      ...(typeof r.name === "string" ? { name: r.name } : {}),
      ...(playerNumber(r.number) ? { number: r.number } : {}),
      ...(typeof r.avatar === "string" ? { avatar: r.avatar } : {}),
    }));

// Players' profiles (nickname, public number, avatar), kept for half a minute so
// a list of challenges reads each account once.
const profiles = new Map();
const PROFILE_TTL_MS = 30_000;
/** Forgets the kept profiles (between tests). */
export const forgetProfiles = () => profiles.clear();

/** A player's dingn profile as it is now, from the short cache. */
async function profileOf(uid, now = Date.now()) {
  const kept = profiles.get(uid);
  if (kept && now - kept.at < PROFILE_TTL_MS) return kept.profile;
  const profile = await getDoc("accounts", uid);
  profiles.set(uid, { at: now, profile });
  return profile;
}

/**
 * Results as anyone may see them: each with the player's nickname, score,
 * public number (which links their page) and chosen avatar, never their uid.
 * The nickname, number and avatar are the player's own as they are now, read
 * from their account, so a player who changes their nickname is renamed
 * everywhere; what was kept with the result stands in if the account can't
 * be read. `viewer` marks the signed-in player's own.
 */
export async function shownResults(
  results,
  viewer = null,
  account = profileOf,
) {
  return Promise.all(
    results.map(async (r) => {
      const profile = r.uid
        ? await Promise.resolve(account(r.uid)).catch(() => null)
        : null;
      const number = playerNumber(profile?.player_no) ?? playerNumber(r.number);
      const avatar = profile
        ? playerAvatar(profile.avatar)
        : playerAvatar(r.avatar);
      // Without a chosen avatar, their sign-in photo, as on their own page.
      const photo = profile ? await photoOf(r.uid, profile.avatar) : null;
      return {
        name: nickname(profile?.user_name) ?? nickname(r.name),
        score: r.score,
        ...(number ? { number } : {}),
        ...(avatar ? { avatar } : {}),
        ...(photo ? { photo } : {}),
        ...(viewer && r.uid === viewer ? { mine: true } : {}),
      };
    }),
  );
}

/** The nickname a challenge's maker goes by now (the one kept with it if their account can't be read). */
async function makerName(doc, account = profileOf) {
  if (!doc?.uid) return nickname(doc?.name);
  const [maker] = await shownResults(
    [{ uid: doc.uid, name: doc.name, score: doc.score }],
    null,
    account,
  );
  return maker.name;
}

/**
 * A challenge's line on its game's list of open challenges: what the list
 * needs of it, with players kept by uid like the challenge itself.
 */
export function listed(id, doc) {
  const results = resultsOf(doc);
  return {
    id,
    mode: doc.mode,
    // Which round it is, so the list can say "Level 28".
    ...(typeof doc.seed === "string" ? { seed: doc.seed } : {}),
    score: doc.score,
    unit: doc.unit,
    // Who made it (never sent): their name, page and avatar are read from
    // their account.
    uid: doc.uid ?? null,
    // Only on a challenge from before players were kept by uid alone.
    ...(typeof doc.name === "string" ? { name: nickname(doc.name) } : {}),
    players: typeof doc.players === "number" ? doc.players : results.length,
    // Its first results, highest first, to show on the list itself.
    results: firstResults(doc),
    createdAt: doc.createdAt,
  };
}

/**
 * The key of a level: a game's round (mode, seed and unit), whatever its
 * score and whatever rules it was played with. A game's `rules` (upgrades,
 * helpers) are the challenger's own and differ from player to player, so a
 * level keyed by them would have a challenge for each player; the level's
 * challenge keeps its owner's rules, and whoever opens it plays under them.
 */
export const roundKey = (game, round) =>
  createHash("sha256")
    .update(JSON.stringify([game, round.mode, round.seed ?? null, round.unit]))
    .digest("hex");

/** Whether a saved challenge still takes results: neither closed nor deleted. */
const isOpen = (doc) => !!doc && doc.closed !== true && doc.deleted !== true;

/** The open challenge of a level, as { id, doc }, or null when it has none. */
export async function openRound(game, round) {
  const held = await getDoc("challengeRounds", roundKey(game, round));
  if (typeof held?.id !== "string") return null;
  const doc = await getDoc("challenges", held.id);
  return isOpen(doc) ? { id: held.id, doc } : null;
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
export async function openChallenges(
  game = null,
  now = Date.now(),
  account = profileOf,
) {
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
      // Its maker as they are now: nickname, public number and avatar.
      // (A line saved before it kept who made it finds them in its results.)
      // (`top` was kept on lines from before results were.)
      const { uid: makerUid, top: _top, ...line } = thread;
      const makerRow = makerUid
        ? (kept.find((r) => r.uid === makerUid) ?? { uid: makerUid })
        : kept.find((r) => r.uid && nickname(r.name) === thread.name);
      const [maker] = makerRow
        ? await shownResults([makerRow], null, account)
        : [];
      const results = await shownResults(kept, null, account);
      list.push({
        game: board.id,
        ...line,
        name: maker?.name ?? line.name ?? null,
        ...(maker?.number ? { number: maker.number } : {}),
        ...(maker?.avatar ? { avatar: maker.avatar } : {}),
        ...(maker?.photo ? { photo: maker.photo } : {}),
        // The leader, for pages from before lists carried every result.
        top: results[0]
          ? { name: results[0].name, score: results[0].score }
          : null,
        results,
      });
    }
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  lists.set(key, { at: now, list });
  return list;
}

/** The saved challenge `id` (checked, with its maker's nickname but not their uid), or null. */
export async function findChallenge(id) {
  const { id: at, doc } = await savedChallenge(id);
  const found = shownChallenge(at, doc);
  return found && { ...found, name: await makerName(doc) };
}

/**
 * The saved challenge an id names, as { id, doc }. A challenge that was
 * merged into its level's one (`mergedInto`, when levels came to have a
 * single challenge) names that one, so its old link still opens the level's
 * challenge.
 */
async function savedChallenge(id) {
  if (typeof id !== "string" || !CHALLENGE_ID.test(id))
    return { id, doc: null };
  const doc = await getDoc("challenges", id);
  const into = doc?.deleted === true ? doc.mergedInto : null;
  return typeof into === "string" && CHALLENGE_ID.test(into)
    ? { id: into, doc: await getDoc("challenges", into) }
    : { id, doc };
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
 * The signed-in player's uid, or null for a guest (or a stale session), and
 * whether they are a test account.
 */
async function maker(req, res, verify, exchange) {
  const claims = await signedIn(req, res, verify, exchange);
  return claims
    ? { uid: claims.uid, test: hasRole(claims, "tester") }
    : { uid: null, test: false };
}

/**
 * Posts the signed-in player's result under the challenge `id`. A test
 * account's is checked but not saved ({ test: true }), as its play stays off
 * every board.
 */
async function addResult(req, res, id, { verify, exchange }) {
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
  const { uid, test } = await maker(req, res, verify, exchange);
  if (!uid) throw new ApiError(401, "signed-out");
  limit(uid);
  const saved = await getDoc("challenges", id);
  if (!shownChallenge(id, saved)) throw new ApiError(404, "not-found");
  if (saved.closed === true) throw new ApiError(409, "closed");
  return postUnder(id, saved, { uid, score, test });
}

/**
 * Posts `uid`'s score under the open challenge `id` (whose document is
 * `saved`) and returns what to tell them: their best, their place, how many
 * played, whether this improved their best and whether it beats the
 * challenge's score. A test account's is worked out but not saved.
 */
async function postUnder(id, saved, { uid, score, test = false }) {
  const now = new Date().toISOString();
  const post = (doc, own = null) => postResult(doc, { uid, score, now }, own);
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
 * Where a score would stand in its level's open challenge, without posting
 * it: whose challenge it is and its score to beat, the place the score would
 * take (counting the player's own best, if they already posted a better
 * one) and how many players there would be. Null for a level with no open
 * challenge. A game asks at the end of a round, to offer "join the
 * challenge" instead of "challenge anyone".
 */
async function standing(req, res, { verify, exchange, account }) {
  if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
  validateOrigin(req);
  throttle(req);
  const body = await readBody(req);
  const challenge = validChallenge(body);
  if (!challenge || typeof body.game !== "string" || !ID.test(body.game))
    throw new ApiError(400, "invalid-request");
  const { uid, test } = await maker(req, res, verify, exchange);
  // Asked after every round, so it has a quota of its own.
  limit(`standing:${uid ?? guestKey(req)}`, MAX_STANDINGS_PER_WINDOW);
  // A test account's challenge stays its own, so it has none to join.
  const open = test ? null : await openRound(body.game, challenge);
  if (!open) return { challenge: null };
  const { id, doc } = open;
  const own = uid ? await getDoc("challengeResults", `${id}_${uid}`) : null;
  // A visitor is placed as a player nobody has seen yet: what signing in
  // would bring, since only a signed-in player joins a level's challenge.
  const { outcome } = postResult(
    doc,
    { uid: uid ?? "", score: challenge.score, now: new Date().toISOString() },
    own,
  );
  return {
    challenge: {
      name: await makerName(doc, account),
      score: doc.score,
      mine: !!uid && doc.uid === uid,
      rank: outcome.rank,
      players: outcome.players,
    },
  };
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
    // A player's dingn profile, where their nickname is.
    account = profileOf,
    newId = newChallengeId,
  } = {},
) {
  try {
    if (pathname !== "/api/challenges") {
      const [id, part, ...more] = pathname
        .slice("/api/challenges/".length)
        .split("/");
      // (No challenge's id is this short, so the word can't hide one.)
      if (id === "standing" && part === undefined)
        return send(
          res,
          200,
          await standing(req, res, { verify, exchange, account }),
        );
      if (part === "results" && !more.length)
        return send(
          res,
          200,
          await addResult(req, res, id, { verify, exchange }),
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
      const { id: at, doc } = await savedChallenge(id);
      const found = shownChallenge(at, doc);
      if (!found) throw new ApiError(404, "not-found");
      // Whether the player opening it made it: then it's their own score to
      // beat. Only a yes or no; the uid itself is never sent. The answer
      // depends on who asks, so nothing may cache it.
      const viewer = await signedIn(req, res, verify, exchange);
      return send(res, 200, {
        ...found,
        name: await makerName(doc, account),
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
      return send(res, 200, {
        challenges: await openChallenges(game, Date.now(), account),
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
    const { uid, test } = await maker(req, res, verify, exchange);
    if (uid) limit(uid);
    else {
      limit(guestKey(req));
      limit("guests", MAX_GUESTS_PER_WINDOW);
    }
    // One level, one challenge: a level that already has an open one is
    // joined, not challenged again. The player's score goes under it and
    // they are told their place.
    const shared = !!uid && !test;
    const joined = async ({ id, doc }) => {
      const outcome = await postUnder(id, doc, {
        uid,
        score: challenge.score,
      });
      return send(res, 200, {
        id,
        joined: true,
        // Their own level, challenged again: still theirs to close or delete.
        owner: doc.uid === uid,
        best: outcome.best,
        rank: outcome.rank,
        players: outcome.players,
      });
    };
    if (shared) {
      const open = await openRound(body.game, challenge);
      if (open) return joined(open);
    }
    const createdAt = new Date().toISOString();
    const doc = {
      game: body.game,
      ...challenge,
      seed: challenge.seed ?? null,
      rules: challenge.rules ?? null,
      // Who made it: their uid only. Their name is read from their account.
      uid,
      createdAt,
      // "Challenge anyone": a signed-in player's challenge is listed. A
      // guest's has nobody behind it, so only its link opens it.
      public: !!uid && !test,
      // The thread starts with its maker's score.
      results: [{ uid, score: challenge.score, at: createdAt }],
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
    if (shared) {
      // This player owns the level's challenge, unless another player made
      // one at the same moment: the first to be named for the level keeps
      // it, and this one is withdrawn and joins theirs.
      const made = id;
      const key = roundKey(body.game, challenge);
      // An id the level names that no longer names an open challenge (it was
      // closed or deleted): replaced only if it is still the one named, so
      // two players replacing it at once can't both win.
      let stale = null;
      for (let tries = 0; tries < ID_TRIES; tries++) {
        const replaced = stale;
        const held = await updateDoc(
          "challengeRounds",
          key,
          // (Pure: Firestore may run it again.)
          (now) => (!now || now.id === replaced ? { id: made } : now),
        );
        if (held.id === made) break;
        const theirs = await getDoc("challenges", held.id);
        if (isOpen(theirs)) {
          await updateDoc("challenges", made, (mine) => ({
            ...mine,
            deleted: true,
            deletedAt: createdAt,
          }));
          return joined({ id: held.id, doc: theirs });
        }
        stale = held.id;
      }
    }
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
