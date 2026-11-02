// XP and leaderboard API served by the dingn web server. All scoring happens
// here with the Firebase Admin SDK; Firestore rules deny browser writes to
// `players` and `plays`, so XP can only change through these endpoints.
import { randomInt } from "node:crypto";
import { ApiError, refresh, validateOrigin } from "./api.mjs";
import {
  GAMES,
  GameError,
  checkStart,
  levelProgress,
  newChallenge,
  publicName,
  settle,
} from "./game-core.mjs";

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

let board = { at: 0, entries: null };
async function leaderboard() {
  if (board.entries && Date.now() - board.at < 30_000) return board.entries;
  const { db } = await admin();
  const snap = await db
    .collection("players")
    .orderBy("xp", "desc")
    .limit(10)
    .get();
  const entries = snap.docs.map((d) => {
    const p = d.data();
    return { name: p.name || "Player", xp: p.xp || 0, level: p.level || 1 };
  });
  board = { at: Date.now(), entries };
  return entries;
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

async function me(req, res) {
  const token = await verify(req, res);
  const { db } = await admin();
  const p = (await db.collection("players").doc(token.uid).get()).data() || {};
  return {
    ...levelProgress(p.xp || 0),
    streak: p.streak || 0,
    lastPlayed: p.lastPlayed || null,
    best: p.best || {},
  };
}

// Every route is a same-origin POST (CSRF-checked by validateOrigin), like
// the rest of the dingn API.
const routes = {
  "/api/play/start": start,
  "/api/play/finish": finish,
  "/api/me": me,
  "/api/leaderboard": async () => ({ entries: await leaderboard() }),
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
