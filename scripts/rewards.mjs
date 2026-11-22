// Coins and badges: dingn's side of the reward system. A game lists the
// badges it can award in its game.json (validateBadges in game-registry.mjs),
// and calls the SDK's rewards.unlock(id) when a player earns one. The player
// page then asks this API to record it: POST /api/rewards/unlock.
//
// What a player earns is decided by the reward system, the kingdom package
// (github.com/ligangwang/kingdom): this file checks the request, loads the
// player's documents, reports the event to its grant() and saves what comes
// back. So a new kind of reward needs no change here.
//
// Games run in the player's browser, so dingn cannot prove a level was really
// passed. Instead it limits what cheating can win: only badges in the
// published game.json count, the reward system caps what each game can pay,
// a version dingn has not reviewed pays nothing, and an admin can switch a
// game's rewards off (record.rewards === "off").
//
// Each player has one server-only document, Firestore `rewards/{uid}` (its
// fields are described in the kingdom package's ledger.mjs), beside their XP
// document `players/{uid}`, where badges add account XP.
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
  MAX_EARN,
  TIER_COINS,
  VERSION,
  cachedRecord,
  isPreview,
  publicGame,
} from "./game-registry.mjs";
import {
  getDoc,
  updateDoc,
  updateDocs,
  updateMany,
} from "./platform-store.mjs";
import { publicName } from "./game-core.mjs";
import { isRuleError, rules } from "./reward-plugin.mjs";

// The rules are the live kingdom plugin's (scripts/reward-plugin.mjs), looked
// up on each call so an approved version takes over without a restart.
const grant = (...a) => rules().rewards.grant(...a);
const total = (...a) => rules().rewards.total(...a);
export const awardBadge = (...a) => rules().ledger.awardBadge(...a);
export const badgeXpOwed = (...a) => rules().ledger.badgeXpOwed(...a);
export const buyItem = (...a) => rules().ledger.buyItem(...a);
export const earnCoins = (...a) => rules().ledger.earnCoins(...a);
export const payBadgeXp = (...a) => rules().ledger.payBadgeXp(...a);
export const wallet = (...a) => rules().ledger.wallet(...a);

export const rewardRoutes = [
  "/api/rewards/unlock",
  "/api/rewards/earn",
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
 * Reports an event to the reward system and saves what it grants: the
 * player's rewards and XP documents, in one transaction. Returns what was
 * granted (see the kingdom package's rewards.mjs). `name` is a leaderboard
 * name for a player who has none yet.
 */
export async function grantEvent(uid, event, name = "") {
  let granted = [];
  await updateMany(
    [
      ["rewards", uid],
      ["players", uid],
    ],
    ([doc, player]) => {
      const out = grant({ rewards: doc, player }, event, { name });
      granted = out.granted;
      // A document no reward changed is left as it is.
      return [
        out.rewards === doc ? undefined : out.rewards,
        out.player === player ? undefined : out.player,
      ];
    },
  );
  return { granted };
}

/** Pays a player's owed badge XP, in one transaction. Returns the XP paid. */
export async function settleBadgeXp(uid, name = "") {
  let paid = 0;
  await updateDocs(["rewards", uid], ["players", uid], (doc, player) => {
    const next = payBadgeXp(doc, player, name);
    paid = next.xp;
    // Nothing owed: write the documents back as they are.
    return [next.doc ?? doc ?? {}, next.player ?? player ?? {}];
  });
  return paid;
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
 * Checks that a request names a published version of a game whose rewards
 * are on, and says whether dingn has reviewed that version. Throws ApiError
 * like findBadge.
 */
export function checkGame(record, body) {
  if (
    typeof body.game !== "string" ||
    !ID.test(body.game) ||
    typeof body.version !== "string" ||
    !VERSION.test(body.version)
  )
    throw new ApiError(400, "invalid-request");
  if (!publicGame(record, body.version)) throw new ApiError(404, "not-found");
  if (record.rewards === "off") throw new ApiError(403, "rewards-off");
  return !isPreview(record, record.versions[body.version]);
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

    if (pathname === "/api/rewards/earn") {
      const record = await cachedRecord(body.game);
      const coins = body.coins;
      if (!Number.isInteger(coins) || coins < 1 || coins > MAX_EARN)
        throw new ApiError(400, "invalid-request");
      const reviewed = checkGame(record, body);
      // An unreviewed version can try it, but nothing is paid.
      if (!reviewed)
        return send(200, { coins, balance: null, left: null, test: true });
      limit(claims.uid);
      const { granted } = await grantEvent(claims.uid, {
        type: "earn",
        game: body.game,
        coins,
      });
      const paid = granted.find((g) => g.reward === "coins");
      if (paid.coins) console.log("earn", body.game, claims.uid, paid.coins);
      return send(200, {
        coins: paid.coins,
        balance: paid.balance,
        left: paid.left,
        granted,
      });
    }

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
    const account = await getDoc("accounts", claims.uid);
    const { granted } = await grantEvent(
      claims.uid,
      { type: "badge", game: body.game, badge },
      publicName(account?.user_name, claims.name),
    );
    const paid = granted.find((g) => g.reward === "coins");
    if (paid.new)
      console.log("badge", body.game, badge.id, claims.uid, paid.coins);
    send(200, {
      badge: shown,
      new: paid.new,
      coins: paid.coins,
      balance: paid.balance,
      xp: total(granted, "xp"),
      granted,
    });
  } catch (error) {
    if (error instanceof ApiError || isRuleError(error))
      return send(error.status, { error: error.message });
    console.error("rewards", error);
    send(503, { error: "unavailable" });
  }
}
