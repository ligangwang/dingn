// The kingdom API. The rules (stages, buildings, prices, the land) are in
// src/data/kingdom.mjs, which the kingdom page reads too; this file loads the
// player's level and coins, applies a rule, and saves the result. What the
// level opens (the hall and each stage's free buildings) is saved the first
// time the player looks at their kingdom after reaching it.
//
//   POST /api/kingdom/me                          the player's kingdom
//   POST /api/kingdom/build { building, x?, y? }  build, paying its coins
//   POST /api/kingdom/move  { from: [x, y], to }  move a building, free
//
// The kingdom is kept in the player's rewards document (`kingdom`), so a
// building and the coins it costs are one transaction. The account level
// comes from players/{uid}, where brain games and badges add XP.
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import { levelProgress } from "./game-core.mjs";
import { getDoc, updateDoc } from "./platform-store.mjs";
import { badgeXpOwed, settleBadgeXp } from "./rewards.mjs";
import {
  KingdomError,
  build,
  building,
  hallRefund,
  kingdomOf,
  move,
  settle,
  stageFor,
} from "../src/data/kingdom.mjs";

export const kingdomRoutes = [
  "/api/kingdom/me",
  "/api/kingdom/build",
  "/api/kingdom/move",
];

/**
 * A rewards document with what the level has opened: the kingdom settled
 * (see `settle`) and, once, the coins paid for halls before they were free.
 * `gifts` lists the stages whose free buildings this adds; the same
 * document comes back when nothing changes.
 */
export function settleDoc(doc, level) {
  if (!stageFor(level)) return { doc, gifts: [] };
  const before = kingdomOf(doc);
  const kingdom = settle(before, level);
  if (kingdom === before) return { doc, gifts: [] };
  const refund = hallRefund(doc);
  return {
    doc: {
      ...(doc ?? {}),
      ...(refund
        ? {
            coins: (doc?.coins ?? 0) + refund,
            spent: Math.max(0, (doc?.spent ?? 0) - refund),
          }
        : {}),
      kingdom,
    },
    gifts: kingdom.granted.filter((id) => !before.granted.includes(id)),
  };
}

/** What the page needs: the level, the open stage, the map and the coins. */
export function kingdomView(doc, player) {
  const progress = levelProgress(player?.xp ?? 0);
  const stage = stageFor(progress.level);
  const kingdom = settle(kingdomOf(doc), progress.level);
  return {
    ...progress,
    stage: stage?.id ?? null,
    size: stage?.size ?? 0,
    hall: kingdom.hall,
    tiles: kingdom.tiles,
    coins: doc?.coins ?? 0,
  };
}

/** Builds in a rewards document. Returns the new document and the cost. */
export function buildIn(unsettled, request, level) {
  const doc = settleDoc(unsettled, level).doc;
  const coins = doc?.coins ?? 0;
  const done = build(kingdomOf(doc), request, level, coins);
  return {
    doc: {
      ...(doc ?? {}),
      coins: coins - done.coins,
      spent: (doc?.spent ?? 0) + done.coins,
      kingdom: done.kingdom,
    },
    coins: done.coins,
  };
}

export async function handleKingdom(
  req,
  res,
  pathname,
  { verify, exchange = refresh } = {},
) {
  const send = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    throttle(req);
    const body = await readBody(req);
    const token = await exchange(req, res);
    let claims;
    try {
      const check =
        verify ??
        (async (t) =>
          (
            await (await import("./games-admin.mjs")).firebaseAuth()
          ).verifyIdToken(t));
      claims = await check(token);
    } catch {
      throw new ApiError(401, "invalid-credential");
    }
    const uid = claims.uid;
    // Badges earned before badges gave XP are paid on the first visit.
    if (badgeXpOwed(await getDoc("rewards", uid)))
      await settleBadgeXp(uid).catch((e) => console.error("badge xp", e));
    const player = await getDoc("players", uid);
    const { level } = levelProgress(player?.xp ?? 0);

    if (pathname === "/api/kingdom/me") {
      let doc = await getDoc("rewards", uid);
      let gifts = [];
      if (settleDoc(doc, level).gifts.length)
        doc = await updateDoc("rewards", uid, (current) => {
          const next = settleDoc(current, level);
          gifts = next.gifts;
          return next.doc;
        });
      return send(200, { ...kingdomView(doc, player), gifts });
    }

    if (pathname === "/api/kingdom/build") {
      const id = body.building;
      if (typeof id !== "string" || !building(id))
        throw new ApiError(400, "invalid-request");
      const request = { id, x: body.x, y: body.y };
      let paid = 0;
      const doc = await updateDoc("rewards", uid, (current) => {
        const next = buildIn(current, request, level);
        paid = next.coins;
        return next.doc;
      });
      console.log("kingdom build", uid, id, paid);
      return send(200, { ...kingdomView(doc, player), paid });
    }

    if (pathname === "/api/kingdom/move") {
      const doc = await updateDoc("rewards", uid, (current) => {
        const settled = settleDoc(current, level).doc;
        return {
          ...(settled ?? {}),
          kingdom: move(kingdomOf(settled), body, level),
        };
      });
      return send(200, kingdomView(doc, player));
    }
    throw new ApiError(404, "not-found");
  } catch (error) {
    if (error instanceof KingdomError)
      return send(error.status, { error: error.code });
    if (error instanceof ApiError)
      return send(error.status, { error: error.message });
    console.error("kingdom", error);
    send(503, { error: "unavailable" });
  }
}
