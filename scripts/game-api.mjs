// XP and leaderboard API served by the dingn web server. All scoring happens
// here with the Firebase Admin SDK; Firestore rules deny browser writes to
// `players` and `plays`, so XP can only change through these endpoints.
import { randomInt } from "node:crypto";
import { ApiError, hasSession, refresh, validateOrigin } from "./api.mjs";
import {
  GAMES,
  GameError,
  checkStart,
  levelProgress,
  newChallenge,
  publicName,
  settle,
} from "./game-core.mjs";
import { readSettings } from "./site-settings.mjs";
import { publicKingdom } from "kingdom/kingdom";
import { publicBadges } from "kingdom/ledger";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";
let adminPromise;
function admin() {
  adminPromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app =
      getApps().find((a) => a.name === "dingn-api") ||
      initializeApp({ projectId: PROJECT }, "dingn-api");
    return { auth: getAuth(app), db: getFirestore(app) };
  })();
  return adminPromise;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 4096) {
        reject(new GameError(413, "too_large", "Request too large."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {});
      } catch {
        reject(new GameError(400, "bad_json", "Invalid request."));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Signed-in player from the HttpOnly session cookie managed by api.mjs. The
 * refresh exchange returns a fresh Google-issued ID token, which the Admin
 * SDK verifies before its uid is trusted.
 */
async function verify(req, res) {
  let token;
  try {
    token = await refresh(req, res);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401)
      throw new GameError(401, "signed_out", "Sign in to earn XP.");
    throw e;
  }
  const { auth } = await admin();
  try {
    return await auth.verifyIdToken(token);
  } catch {
    throw new GameError(
      401,
      "bad_token",
      "Your sign-in expired. Sign in again.",
    );
  }
}

/**
 * The top ten players. `shown` says whether everyone may see them: an admin
 * makes the leaderboard public from the admin pages; until then only admins
 * see it.
 */
let board = { at: 0, entries: null };
/** Whether the request comes from a signed-in admin. Never throws. */
async function isAdmin(req, res) {
  if (!hasSession(req)) return false;
  try {
    return (await verify(req, res)).admin === true;
  } catch {
    return false;
  }
}

/**
 * The ten players with the most XP, each with their public number and
 * avatar, and their account id (which only admins are sent).
 */
export async function topPlayers(db) {
  const snap = await db
    .collection("players")
    .orderBy("xp", "desc")
    .limit(10)
    .get();
  // Each player's public number links their name to their page.
  const accounts = snap.empty
    ? []
    : await db.getAll(
        ...snap.docs.map((d) => db.collection("accounts").doc(d.id)),
      );
  // Every name on the board is the player's own nickname and opens their
  // page: a top player who hasn't visited since nicknames and numbers began
  // gets their default nickname ("Player<number>") and public number now.
  // One after the other, as both write the same account.
  const who = await Promise.all(
    snap.docs.map(async (d, i) => {
      const account = accounts[i]?.data() ?? {};
      const name = await ensureNickname(db, d.id).catch(
        () => cleanNickname(account.user_name) ?? d.data().name ?? null,
      );
      const number = isPlayerNumber(account.player_no)
        ? account.player_no
        : await ensurePlayerNumber(db, d.id).catch(() => null);
      return { name, number };
    }),
  );
  const entries = snap.docs.map((d, i) => {
    const p = d.data();
    const account = accounts[i]?.data() ?? {};
    return {
      uid: d.id,
      name: who[i].name || p.name || "Player",
      xp: p.xp || 0,
      level: p.level || 1,
      ...(who[i].number ? { number: who[i].number } : {}),
      avatar: typeof account.avatar === "string" ? account.avatar : "",
    };
  });
  return entries;
}

/**
 * The top ten players, each with their public number for their page. An
 * admin also gets each one's account id, so the board can link to them on
 * the Players admin page; nobody else does.
 */
async function leaderboard(req, res) {
  // (Not named `admin`: that is the Admin SDK's initializer below.)
  const [shown, forAdmin] = await Promise.all([
    readSettings().then((s) => s.leaderboardPublic),
    isAdmin(req, res),
  ]);
  const visible = (entries) =>
    forAdmin ? entries : entries.map(({ uid: _uid, ...entry }) => entry);
  if (board.entries && Date.now() - board.at < 30_000)
    return { shown, entries: visible(board.entries) };
  const { db } = await admin();
  const entries = await topPlayers(db);
  board = { at: Date.now(), entries };
  return { shown, entries: visible(entries) };
}

async function start(req, res) {
  const token = await verify(req, res);
  const { game } = await readJson(req);
  if (!GAMES.includes(game))
    throw new GameError(400, "bad_game", "Unknown game.");
  const { db } = await admin();
  const playerRef = db.collection("players").doc(token.uid);
  const playRef = db.collection("plays").doc();
  const now = Date.now();
  const challenge = newChallenge(game, randomInt);
  await db.runTransaction(async (tx) => {
    const player = (await tx.get(playerRef)).data();
    tx.set(playerRef, checkStart(player, now), { merge: true });
    tx.create(playRef, {
      uid: token.uid,
      game,
      challenge,
      startedAt: now,
      status: "open",
    });
  });
  return { playId: playRef.id, challenge };
}

async function finish(req, res) {
  const token = await verify(req, res);
  const { playId, answers } = await readJson(req);
  if (typeof playId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(playId))
    throw new GameError(400, "bad_play", "Unknown game.");
  const { db } = await admin();
  const playRef = db.collection("plays").doc(playId);
  const playerRef = db.collection("players").doc(token.uid);
  const accountRef = db.collection("accounts").doc(token.uid);
  const result = await db.runTransaction(async (tx) => {
    const [playSnap, playerSnap, accountSnap] = await Promise.all([
      tx.get(playRef),
      tx.get(playerRef),
      tx.get(accountRef),
    ]);
    const settled = settle({
      play: playSnap.data(),
      player: playerSnap.data(),
      uid: token.uid,
      answers,
      now: Date.now(),
    });
    tx.update(playRef, {
      status: "scored",
      score: settled.result.score,
      xpGained: settled.result.xpGained,
      finishedAt: Date.now(),
    });
    tx.set(
      playerRef,
      {
        ...settled.player,
        name: publicName(accountSnap.data()?.user_name, token.name),
      },
      { merge: true },
    );
    return settled.result;
  });
  board.at = 0;
  return result;
}

/** The shortest and longest nickname, in characters. */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;

/**
 * A nickname as it is kept: control and direction-changing characters
 * removed, spaces collapsed, NICKNAME_MIN to NICKNAME_MAX characters. Null
 * when it can't be one.
 */
export function cleanNickname(text) {
  if (typeof text !== "string") return null;
  const name = text
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...name].length;
  return length >= NICKNAME_MIN && length <= NICKNAME_MAX ? name : null;
}

/**
 * The register's key for a nickname: names that differ only in capitals,
 * spacing or look-alike forms (NFKC) are the same name.
 */
export function nicknameKey(name) {
  return encodeURIComponent(
    name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(),
  );
}

/**
 * Nicknames are unique: `nicknames/{key}` holds the uid of the one player
 * each name belongs to, and a name is only ever taken in a transaction that
 * checks it is free. Players can't write it (firestore.rules); only these
 * functions do.
 */
const nicknames = (db) => db.collection("nicknames");

/**
 * The player's nickname, giving one first to a player who has none:
 * "Player<their public number>", unique because the number is. A player who
 * chose a name before names were unique has it registered on their next
 * visit, if no one holds it yet.
 */
export async function ensureNickname(db, uid) {
  const accountRef = db.collection("accounts").doc(uid);
  const account = (await accountRef.get()).data() ?? {};
  const current = cleanNickname(account.user_name);
  // Most players are named and registered already: no transaction.
  if (current && account.name_key !== undefined) return current;
  // A default nickname is the player's own public number: one number for
  // their name and their page.
  const number = await ensurePlayerNumber(db, uid);
  const playerRef = db.collection("players").doc(uid);
  return db.runTransaction(async (tx) => {
    const [now, player] = await Promise.all([
      tx.get(accountRef),
      tx.get(playerRef),
    ]);
    const data = now.data() ?? {};
    const had = cleanNickname(data.user_name);
    if (had) {
      if (data.name_key !== undefined) return had;
      // Register a name chosen before names were unique, if it is free.
      const key = nicknameKey(had);
      const held = await tx.get(nicknames(db).doc(key));
      const mine = !held.exists || held.data()?.uid === uid;
      if (mine) tx.set(nicknames(db).doc(key), { uid, name: had });
      // "" marks a name kept but not registered: another player had it first.
      tx.set(accountRef, { name_key: mine ? key : "" }, { merge: true });
      return had;
    }
    // None yet: "Player<public number>". Nobody else can hold it, as names
    // shaped like a default are reserved (claimNickname).
    const name = defaultNickname(number);
    const key = nicknameKey(name);
    const held = await tx.get(nicknames(db).doc(key));
    if (held.exists && held.data()?.uid !== uid)
      throw new Error("Default nickname taken");
    tx.set(nicknames(db).doc(key), { uid, name });
    tx.set(accountRef, { user_name: name, name_key: key }, { merge: true });
    // The leaderboard shows the name kept with the player's XP.
    if (player.exists) tx.set(playerRef, { name }, { merge: true });
    return name;
  });
}

/** A player's default nickname: "Player" and their public number. */
export const defaultNickname = (number) => `Player${number}`;

/**
 * Changes a player's nickname to `wanted`, if no other player holds it, and
 * frees their old one. Throws GameError 400 for a name that can't be one and
 * 409 for one that is taken.
 */
export async function claimNickname(db, uid, wanted) {
  const name = cleanNickname(wanted);
  if (!name)
    throw new GameError(
      400,
      "bad_nickname",
      `Nicknames are ${NICKNAME_MIN} to ${NICKNAME_MAX} characters.`,
    );
  const key = nicknameKey(name);
  const accountRef = db.collection("accounts").doc(uid);
  const playerRef = db.collection("players").doc(uid);
  return db.runTransaction(async (tx) => {
    const [held, account, player] = await Promise.all([
      tx.get(nicknames(db).doc(key)),
      tx.get(accountRef),
      tx.get(playerRef),
    ]);
    if (held.exists && held.data()?.uid !== uid)
      throw new GameError(409, "nickname_taken", "That nickname is taken.");
    // "Player" and a number is how default nicknames look: only a player's
    // own default (Player<their public number>) may be chosen.
    if (
      /^player\d+$/i.test(name) &&
      name.toLowerCase() !== `player${account.data()?.player_no}`
    )
      throw new GameError(409, "nickname_taken", "That nickname is taken.");
    const old = account.data()?.name_key;
    const oldRef = old && old !== key ? nicknames(db).doc(old) : null;
    const oldHeld = oldRef ? await tx.get(oldRef) : null;
    if (oldRef && oldHeld?.data()?.uid === uid) tx.delete(oldRef);
    tx.set(nicknames(db).doc(key), { uid, name });
    tx.set(accountRef, { user_name: name, name_key: key }, { merge: true });
    if (player.exists) tx.set(playerRef, { name }, { merge: true });
    return { name };
  });
}

/**
 * A player's public number: ten random digits, never starting with 0, that
 * names their public page (/player/<number>/). It is not their account id,
 * which stays private: anyone signed in may read an account by its id
 * (firestore.rules). Random rather than counted, so nobody can walk through
 * the numbers to list every player.
 */
export const isPlayerNumber = (value) =>
  typeof value === "string" && /^[1-9]\d{9}$/.test(value);
const drawPlayerNumber = () => String(randomInt(1_000_000_000, 10_000_000_000));

/**
 * The player's public number, giving them one first if they have none.
 * Numbers are unique: `playerNumbers/{number}` holds the uid of the one
 * player each belongs to, and a number is only taken in a transaction that
 * checks it is free, drawing again when it isn't. Only the server writes
 * either (firestore.rules), and a number never changes.
 */
export async function ensurePlayerNumber(db, uid, draw = drawPlayerNumber) {
  const accountRef = db.collection("accounts").doc(uid);
  const known = (await accountRef.get()).data()?.player_no;
  if (isPlayerNumber(known)) return known;
  return db.runTransaction(async (tx) => {
    const had = (await tx.get(accountRef)).data()?.player_no;
    if (isPlayerNumber(had)) return had;
    for (let tries = 0; tries < 10; tries++) {
      const number = draw();
      const ref = db.collection("playerNumbers").doc(number);
      if ((await tx.get(ref)).exists) continue;
      tx.set(ref, { uid });
      tx.set(accountRef, { player_no: number }, { merge: true });
      return number;
    }
    throw new Error("No free player number");
  });
}

/**
 * What anyone may see of a player, found by their public number: nickname,
 * avatar, level and XP, streak, badges and their kingdom. Never their account
 * id, email, coins, purchases or saved games. Null for a number no player has.
 */
export async function publicPlayer(db, number) {
  if (!isPlayerNumber(number)) return null;
  const owner = await db.collection("playerNumbers").doc(number).get();
  const uid = owner.data()?.uid;
  if (!uid) return null;
  const [account, player, rewards] = await Promise.all(
    ["accounts", "players", "rewards"].map((name) =>
      db
        .collection(name)
        .doc(uid)
        .get()
        .then((snap) => snap.data() ?? {}),
    ),
  );
  const progress = levelProgress(player.xp || 0);
  return {
    number,
    // Their nickname; one who has none yet gets their default now.
    name: await ensureNickname(db, uid).catch(
      () => cleanNickname(account.user_name) ?? "Player",
    ),
    avatar: typeof account.avatar === "string" ? account.avatar : "",
    ...progress,
    streak: player.streak || 0,
    badges: publicBadges(rewards),
    // Their kingdom as they built it, for visitors to look around. Never
    // their coins.
    kingdom: publicKingdom(rewards, progress.level),
  };
}

async function playerPage(req) {
  const { number } = await readJson(req);
  const { db } = await admin();
  const player = await publicPlayer(db, String(number ?? ""));
  if (!player)
    throw new GameError(404, "no_player", "No player has that number.");
  return player;
}

async function nickname(req, res) {
  const token = await verify(req, res);
  const { name } = await readJson(req);
  const { db } = await admin();
  return claimNickname(db, token.uid, name);
}

async function me(req, res) {
  const token = await verify(req, res);
  const { db } = await admin();
  const [p, who] = await Promise.all([
    db
      .collection("players")
      .doc(token.uid)
      .get()
      .then((snap) => snap.data() || {}),
    // A new player gets their default nickname here, on their first visit.
    // Then their public number, for their page (one transaction at a time
    // on the account).
    ensureNickname(db, token.uid)
      .catch(() => null)
      .then(async (name) => ({
        name,
        number: await ensurePlayerNumber(db, token.uid).catch(() => null),
      })),
  ]);
  return {
    ...levelProgress(p.xp || 0),
    streak: p.streak || 0,
    lastPlayed: p.lastPlayed || null,
    best: p.best || {},
    ...who,
  };
}

// Every route is a same-origin POST (CSRF-checked by validateOrigin), like
// the rest of the dingn API.
const routes = {
  "/api/play/start": start,
  "/api/play/finish": finish,
  "/api/me": me,
  "/api/me/nickname": nickname,
  "/api/leaderboard": leaderboard,
  // A player's public page: anyone may open it, signed in or not.
  "/api/player": playerPage,
};
export const gameRoutes = Object.keys(routes);

/** Handles the XP routes. Returns false for any other path. */
export async function handleGameApi(req, res, pathname) {
  const route = routes[pathname];
  if (!route) return false;
  try {
    if (req.method !== "POST")
      throw new GameError(405, "method_not_allowed", "Use POST.");
    validateOrigin(req);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("API timeout")), 10_000);
    });
    try {
      send(res, 200, await Promise.race([route(req, res), timeout]));
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e instanceof GameError)
      send(res, e.status, { error: e.code, message: e.message });
    else if (e instanceof ApiError)
      send(res, e.status, {
        error: e.code,
        message:
          e.status === 429
            ? "Too many requests. Try again in a minute."
            : "XP is unavailable right now.",
      });
    else {
      console.error("game api", e);
      send(res, 503, {
        error: "unavailable",
        message: "XP is unavailable right now.",
      });
    }
  }
  return true;
}
