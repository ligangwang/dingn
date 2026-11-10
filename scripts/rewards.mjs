// Coins and badges. A game lists the badges it can award in its game.json
// (validateBadges in game-registry.mjs), and calls the SDK's
// rewards.unlock(id) when a player earns one. The player page then asks this
// API to record it: POST /api/rewards/unlock.
//
// Games run in the player's browser, so dingn cannot prove a level was really
// passed. Instead it limits what cheating can win: only badges in the
// published game.json count, each pays once per player, every game's coins
// are capped (MAX_GAME_COINS), a version dingn has not reviewed pays nothing,
// and an admin can switch a game's rewards off (record.rewards === "off").
//
// Each player has one server-only document, Firestore `rewards/{uid}`:
//   { coins, spent, games: { <game>: coins earned there },
//     badges: { "<game>/<id>": … }, items: { "<game>/<id>": … } }
// `coins` is the balance; coins earned in all = coins + spent.
//
// Players spend coins on upgrades a game sells (validateShop): POST
// /api/rewards/spend. The player page asks the player to confirm first, so a
// game cannot spend anyone's coins on its own.
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import {
  BADGE_ID,
  ID,
  MAX_GAME_COINS,
  TIER_COINS,
  VERSION,
  cachedRecord,
  isPreview,
  publicGame,
} from "./game-registry.mjs";
import { getDoc, updateDoc } from "./platform-store.mjs";

export const rewardRoutes = [
  "/api/rewards/unlock",
  "/api/rewards/spend",
  "/api/rewards/me",
];
// Unlocks per account per hour, on each server instance.
const PER_HOUR = 120;
const recent = new Map();

function limit(uid, now = Date.now()) {
  const times = (recent.get(uid) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= PER_HOUR) throw new ApiError(429, "too-many-requests");
  times.push(now);
  recent.set(uid, times);
}
export const resetLimits = () => recent.clear();

/**
 * Records one badge in a player's rewards document. Returns the new document
 * and what the player got: `new` is false for a badge they already had, and
 * `coins` is what it paid (less than the badge's coins once the game's cap is
 * reached).
 */
export function awardBadge(doc, game, badge, now = new Date().toISOString()) {
  const current = {
    ...(doc ?? {}),
    coins: doc?.coins ?? 0,
    games: { ...(doc?.games ?? {}) },
    badges: { ...(doc?.badges ?? {}) },
  };
  const key = `${game}/${badge.id}`;
  if (current.badges[key])
    return {
      doc: current,
      result: { new: false, coins: 0, balance: current.coins },
    };
  // Own properties only: a game id such as "constructor" must not read
  // Object.prototype.
  const earned = Object.hasOwn(current.games, game) ? current.games[game] : 0;
  // The tier's coins now, so dingn can change what a tier pays.
  const coins = Math.max(
    0,
    Math.min(TIER_COINS[badge.tier] ?? 0, MAX_GAME_COINS - earned),
  );
  current.badges[key] = {
    game,
    id: badge.id,
    tier: badge.tier,
    ...(badge.level != null ? { level: badge.level } : { icon: badge.icon }),
    title: badge.title,
    coins,
    at: now,
  };
  current.games[game] = earned + coins;
  current.coins += coins;
  return {
    doc: current,
    result: { new: true, coins, balance: current.coins },
  };
}

/**
 * Buys one upgrade with a player's coins. Returns the new document and what
 * happened: `new` is false for an upgrade they already own (nothing is
 * charged). Throws ApiError when they need an earlier upgrade first or do not
 * have enough coins.
 */
export function buyItem(doc, game, item, now = new Date().toISOString()) {
  const current = {
    coins: doc?.coins ?? 0,
    spent: doc?.spent ?? 0,
    games: { ...(doc?.games ?? {}) },
    badges: { ...(doc?.badges ?? {}) },
    items: { ...(doc?.items ?? {}) },
  };
  const key = `${game}/${item.id}`;
  if (current.items[key])
    return {
      doc: current,
      result: { new: false, coins: 0, balance: current.coins },
    };
  if (item.requires && !current.items[`${game}/${item.requires}`])
    throw new ApiError(409, "requires");
  if (current.coins < item.price) throw new ApiError(402, "not-enough-coins");
  current.items[key] = {
    game,
    id: item.id,
    price: item.price,
    title: item.title,
    at: now,
  };
  current.coins -= item.price;
  current.spent += item.price;
  return {
    doc: current,
    result: { new: true, coins: item.price, balance: current.coins },
  };
}

/** A player's coins, badges (newest first) and the upgrades they own. */
export function wallet(doc) {
  return {
    coins: doc?.coins ?? 0,
    badges: Object.values(doc?.badges ?? {}).sort((a, b) =>
      b.at.localeCompare(a.at),
    ),
    items: Object.values(doc?.items ?? {})
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(({ game, id, title }) => ({ game, id, title })),
  };
}

/**
 * Finds the badge a request names in the game version the player is playing.
 * Throws ApiError when the game, version or badge is unknown, or the game's
 * rewards are off.
 */
export function findBadge(record, body) {
  if (
    typeof body.game !== "string" ||
    !ID.test(body.game) ||
    typeof body.version !== "string" ||
    !VERSION.test(body.version) ||
    typeof body.badge !== "string" ||
    !BADGE_ID.test(body.badge)
  )
    throw new ApiError(400, "invalid-request");
  // publicGame is null for a game that was taken down or never published.
  if (!publicGame(record, body.version)) throw new ApiError(404, "not-found");
  if (record.rewards === "off") throw new ApiError(403, "rewards-off");
  const version = record.versions[body.version];
  const badge = (version.badges ?? []).find((b) => b.id === body.badge);
  if (!badge) throw new ApiError(404, "unknown-badge");
  return { badge, reviewed: !isPreview(record, version) };
}

/**
 * Finds the upgrade a request names in the game version the player is
 * playing. Throws ApiError like findBadge.
 */
export function findItem(record, body) {
  if (
    typeof body.game !== "string" ||
    !ID.test(body.game) ||
    typeof body.version !== "string" ||
    !VERSION.test(body.version) ||
    typeof body.item !== "string" ||
    !BADGE_ID.test(body.item)
  )
    throw new ApiError(400, "invalid-request");
  if (!publicGame(record, body.version)) throw new ApiError(404, "not-found");
  if (record.rewards === "off") throw new ApiError(403, "rewards-off");
  const version = record.versions[body.version];
  const item = (version.shop ?? []).find((i) => i.id === body.item);
  if (!item) throw new ApiError(404, "unknown-item");
  return { item, reviewed: !isPreview(record, version) };
}

/** POST /api/rewards/unlock { game, version, badge } and POST /api/rewards/me */
export async function handleRewards(
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
    if (pathname === "/api/rewards/me")
      return send(200, wallet(await getDoc("rewards", claims.uid)));

    if (pathname === "/api/rewards/spend") {
      const { item, reviewed } = findItem(await cachedRecord(body.game), body);
      // An unreviewed version can try its shop, but nothing is charged.
      if (!reviewed)
        return send(200, {
          new: true,
          coins: item.price,
          balance: null,
          test: true,
        });
      limit(claims.uid);
      let bought;
      await updateDoc("rewards", claims.uid, (doc) => {
        const next = buyItem(doc, body.game, item);
        bought = next.result;
        return next.doc;
      });
      if (bought.new)
        console.log("purchase", body.game, item.id, claims.uid, item.price);
      return send(200, bought);
    }

    const { badge, reviewed } = findBadge(await cachedRecord(body.game), body);
    const shown = {
      id: badge.id,
      tier: badge.tier,
      ...(badge.level != null ? { level: badge.level } : { icon: badge.icon }),
      title: badge.title,
    };
    // An outside developer's version that dingn has not reviewed can be
    // tried out, but pays nothing and saves nothing.
    if (!reviewed)
      return send(200, {
        badge: shown,
        new: true,
        coins: TIER_COINS[badge.tier] ?? 0,
        balance: null,
        test: true,
      });
    limit(claims.uid);
    let result;
    await updateDoc("rewards", claims.uid, (doc) => {
      const next = awardBadge(doc, body.game, badge);
      result = next.result;
      return next.doc;
    });
    if (result.new)
      console.log("badge", body.game, badge.id, claims.uid, result.coins);
    send(200, { badge: shown, ...result });
  } catch (error) {
    if (error instanceof ApiError)
      return send(error.status, { error: error.message });
    console.error("rewards", error);
    send(503, { error: "unavailable" });
  }
}
