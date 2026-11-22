// The kingdom API. The rules (stages, buildings, prices, the land) are the
// reward system's (the kingdom package's kingdom module), which the kingdom
// page reads too; this file loads the player's level and coins, applies a
// rule, and saves the result. What the level opens (the hall and each
// stage's free buildings) is saved the first time the player looks at their
// kingdom after reaching it.
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
import { getDoc, updateDoc } from "./platform-store.mjs";
import { badgeXpOwed, settleBadgeXp } from "./rewards.mjs";
import { isRuleError, rules } from "./reward-plugin.mjs";

// The live kingdom plugin's rules (scripts/reward-plugin.mjs).
const levelProgress = (...a) => rules().levels.levelProgress(...a);
const building = (...a) => rules().kingdom.building(...a);
const moveIn = (...a) => rules().kingdom.moveIn(...a);
export const buildIn = (...a) => rules().kingdom.buildIn(...a);
export const kingdomView = (...a) => rules().kingdom.kingdomView(...a);
export const settleDoc = (...a) => rules().kingdom.settleDoc(...a);

export const kingdomRoutes = [
  "/api/kingdom/me",
  "/api/kingdom/build",
  "/api/kingdom/move",
];

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
      const doc = await updateDoc("rewards", uid, (current) =>
        moveIn(current, body, level),
      );
      return send(200, kingdomView(doc, player));
    }
    throw new ApiError(404, "not-found");
  } catch (error) {
    if (isRuleError(error)) return send(error.status, { error: error.code });
    if (error instanceof ApiError)
      return send(error.status, { error: error.message });
    console.error("kingdom", error);
    send(503, { error: "unavailable" });
  }
}
