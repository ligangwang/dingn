// The kingdom: a small 3D island on every dingn account that grows with the
// account level. Each stage the level opens comes with its hall and a few
// basic buildings, free (STARTERS); players add more with dingn coins.
// The website's server
// (scripts/kingdom.mjs) and the kingdom page both read this file, so the
// rules the page shows are the rules the server enforces.
//
// A player's kingdom is kept in their rewards document (rewards/{uid}), next
// to their coins, so buying a building and paying for it is one write:
//   kingdom: { hall: "camp", tiles: { "<x>,<y>": "<building id>" },
//              granted: ["camp", …] }
// `granted` lists the stages whose free buildings have been placed, so each
// stage gives them once, even if the player moves them.
// The hall's grounds are the 3 x 3 tiles around 0,0 (HALL_RADIUS), where it
// grows from a campfire into a palace as the level rises; nothing else can
// be built there.

/** Kingdom stages, by the account level that opens each one. */
export const STAGES = [
  { id: "camp", level: 2, size: 5, title: { en: "Camp", zh: "营地" } },
  { id: "village", level: 4, size: 6, title: { en: "Village", zh: "村庄" } },
  { id: "town", level: 6, size: 7, title: { en: "Town", zh: "城镇" } },
  { id: "city", level: 10, size: 8, title: { en: "City", zh: "城市" } },
  { id: "kingdom", level: 15, size: 9, title: { en: "Kingdom", zh: "王国" } },
  { id: "capital", level: 20, size: 10, title: { en: "Capital", zh: "王都" } },
];
export const STAGE_IDS = STAGES.map((s) => s.id);
export const MIN_LEVEL = STAGES[0].level;
/** Account XP per badge, by tier: twice the coins the tier pays. */
export const BADGE_XP = { bronze: 20, silver: 50, gold: 100, diamond: 200 };

const b = (id, stage, coins, max, en, zh, extra = {}) => ({
  id,
  stage,
  coins,
  max,
  ...extra,
  title: { en, zh },
});
/**
 * What players can buy. `stage` is the stage that opens it; `max` is how
 * many one kingdom can have, the free ones included.
 */
export const BUILDINGS = [
  b("path", "camp", 2, 40, "Stone path", "石板路"),
  b("tree", "camp", 5, 20, "Oak tree", "橡树"),
  b("flowers", "camp", 5, 20, "Flower bed", "花坛"),
  b("cottage", "camp", 20, 6, "Thatched cottage", "茅草屋"),
  b("farm", "camp", 15, 6, "Wheat field", "麦田"),
  b("well", "village", 30, 1, "Well", "水井"),
  b("market", "village", 40, 3, "Market stall", "集市摊位"),
  b("windmill", "village", 120, 1, "Windmill", "风车"),
  b("house", "town", 60, 6, "Town house", "城镇住宅"),
  b("forge", "town", 100, 1, "Blacksmith", "铁匠铺"),
  b("tower", "town", 150, 2, "Watchtower", "瞭望塔"),
  b("chapel", "city", 200, 1, "Chapel", "礼拜堂"),
  b("fountain", "city", 250, 1, "Fountain", "喷泉"),
  b("clock", "city", 300, 1, "Clock tower", "钟楼"),
  b("statue", "kingdom", 300, 2, "Knight statue", "骑士雕像"),
];
/**
 * What the hall cost in coins before halls came free with the level. A
 * player who paid for one gets those coins back once (see `hallRefund`).
 */
export const OLD_HALL_COINS = {
  village: 100,
  town: 250,
  city: 500,
  kingdom: 800,
  capital: 1200,
};

/**
 * The buildings each stage gives for free when the level opens it, as
 * [building, x, y]: the basic layout of a settlement (paths out from the
 * hall, homes, a field, a well), leaving room for the player to decorate.
 * A spot already taken moves to the nearest free tile.
 */
export const STARTERS = {
  camp: [
    ["path", 0, 2],
    ["path", 0, -2],
    ["path", 2, 0],
    ["path", -2, 0],
    ["cottage", 2, 2],
    ["farm", -2, 2],
    ["tree", -2, -2],
    ["tree", 2, -2],
  ],
  village: [
    ["path", 3, 0],
    ["path", 0, 3],
    ["well", 2, 1],
    ["market", 3, 1],
    ["flowers", 1, 2],
  ],
  town: [
    ["path", -3, 0],
    ["path", 0, -3],
    ["house", -3, 2],
    ["house", 2, -3],
    ["forge", -3, -2],
  ],
  city: [
    ["path", 4, 0],
    ["path", 0, 4],
    ["fountain", 3, 3],
    ["house", 4, -2],
  ],
  kingdom: [
    ["path", -4, 0],
    ["path", 0, -4],
    ["statue", -1, -4],
    ["statue", 1, -4],
  ],
  capital: [
    ["path", 5, 0],
    ["path", 0, 5],
    ["flowers", 5, 1],
    ["flowers", 1, 5],
    ["tree", 5, 5],
  ],
};

/** The hall's look at each stage. */
export const HALL_TITLES = {
  camp: { en: "Campfire", zh: "篝火营地" },
  village: { en: "Village hall", zh: "村公所" },
  town: { en: "Great hall", zh: "大会堂" },
  city: { en: "Keep", zh: "城堡主楼" },
  kingdom: { en: "Castle", zh: "城堡" },
  capital: { en: "Palace", zh: "宫殿" },
};

export const building = (id) => BUILDINGS.find((b) => b.id === id) ?? null;
const rank = (stage) => STAGE_IDS.indexOf(stage);

/** The furthest stage an account level opens, or null below level 2. */
export function stageFor(level) {
  let open = null;
  for (const stage of STAGES) if (level >= stage.level) open = stage;
  return open;
}

/**
 * The tiles of a square of `size`, around the hall at 0,0: x and y run from
 * -floor((size-1)/2) to ceil((size-1)/2), so every stage keeps the old land.
 */
export function landBounds(size) {
  const lo = -Math.floor((size - 1) / 2);
  return { lo, hi: lo + size - 1 };
}
export function onLand(size, x, y) {
  const { lo, hi } = landBounds(size);
  return x >= lo && x <= hi && y >= lo && y <= hi;
}
export const tileKey = (x, y) => `${x},${y}`;
export const HALL_RADIUS = 1;
/** True for the tiles the hall stands on. */
export const isHallTile = (x, y) =>
  Math.abs(x) <= HALL_RADIUS && Math.abs(y) <= HALL_RADIUS;

/** A player's kingdom as kept, with defaults for one not built yet. */
export function kingdomOf(doc) {
  const k = doc?.kingdom;
  return {
    hall: STAGE_IDS.includes(k?.hall) ? k.hall : "camp",
    tiles: { ...(k?.tiles ?? {}) },
    granted: Array.isArray(k?.granted)
      ? STAGE_IDS.filter((id) => k.granted.includes(id))
      : [],
  };
}

/**
 * The kingdom with what the level has opened: the hall raised to the open
 * stage, and the free buildings of every open stage not yet given. Returns
 * the same object when nothing changes.
 */
export function settle(kingdom, level) {
  const open = stageFor(level);
  if (!open) return kingdom;
  const due = STAGES.filter(
    (s) => s.level <= open.level && !kingdom.granted.includes(s.id),
  );
  if (!due.length && rank(kingdom.hall) >= rank(open.id)) return kingdom;
  const next = {
    hall: rank(kingdom.hall) >= rank(open.id) ? kingdom.hall : open.id,
    tiles: { ...kingdom.tiles },
    granted: [...kingdom.granted],
  };
  for (const stage of due) {
    for (const [id, x, y] of STARTERS[stage.id]) {
      const def = building(id);
      const count = Object.values(next.tiles).filter((b) => b === id).length;
      if (count >= def.max) continue;
      const spot = freeTileNear(next.tiles, open.size, x, y);
      if (spot) next.tiles[tileKey(...spot)] = id;
    }
    next.granted.push(stage.id);
  }
  next.granted = STAGE_IDS.filter((id) => next.granted.includes(id));
  return next;
}

/** The free tile nearest x,y on land of `size`, or null if it is full. */
function freeTileNear(tiles, size, x, y) {
  const { lo, hi } = landBounds(size);
  const free = (a, b) =>
    onLand(size, a, b) && !isHallTile(a, b) && !tiles[tileKey(a, b)];
  if (free(x, y)) return [x, y];
  let best = null;
  let bestD = Infinity;
  for (let a = lo; a <= hi; a++)
    for (let b = lo; b <= hi; b++) {
      const d = (a - x) ** 2 + (b - y) ** 2;
      if (d < bestD && free(a, b)) {
        best = [a, b];
        bestD = d;
      }
    }
  return best;
}

/**
 * Coins owed back to a player who bought hall upgrades before halls came
 * free: what they paid, the first time their kingdom is settled (a kingdom
 * kept before then has no `granted`).
 */
export function hallRefund(doc) {
  const k = doc?.kingdom;
  if (!k || Array.isArray(k.granted)) return 0;
  const hall = rank(kingdomOf(doc).hall);
  return STAGE_IDS.slice(1, hall + 1).reduce(
    (sum, id) => sum + OLD_HALL_COINS[id],
    0,
  );
}

export class KingdomError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/**
 * Builds `id` on tile x,y for a player at `level` holding `coins`. Returns
 * the new kingdom (settled for the level) and what it cost, or throws a
 * KingdomError naming the rule it breaks.
 */
export function build(kingdom, { id, x, y }, level, coins) {
  const def = building(id);
  if (!def) throw new KingdomError("unknown-building", 404);
  const open = stageFor(level);
  if (!open) throw new KingdomError("locked", 403);
  if (rank(def.stage) > rank(open.id)) throw new KingdomError("level", 403);
  const settled = settle(kingdom, level);
  const next = { ...settled, tiles: { ...settled.tiles } };
  if (!Number.isInteger(x) || !Number.isInteger(y))
    throw new KingdomError("invalid-request", 400);
  if (!onLand(open.size, x, y) || isHallTile(x, y))
    throw new KingdomError("off-land");
  const key = tileKey(x, y);
  if (next.tiles[key]) throw new KingdomError("occupied");
  const count = Object.values(next.tiles).filter((b) => b === id).length;
  if (count >= def.max) throw new KingdomError("max");
  next.tiles[key] = id;
  if (coins < def.coins) throw new KingdomError("not-enough-coins", 402);
  return { kingdom: next, coins: def.coins };
}

/** Moves the building on one tile to an empty tile, free. */
export function move(unsettled, { from, to }, level) {
  const open = stageFor(level);
  if (!open) throw new KingdomError("locked", 403);
  const kingdom = settle(unsettled, level);
  const valid = (t) =>
    Array.isArray(t) && t.length === 2 && t.every(Number.isInteger);
  if (!valid(from) || !valid(to))
    throw new KingdomError("invalid-request", 400);
  const a = tileKey(...from);
  const b = tileKey(...to);
  if (!kingdom.tiles[a]) throw new KingdomError("empty");
  if (!onLand(open.size, ...to) || isHallTile(...to))
    throw new KingdomError("off-land");
  if (kingdom.tiles[b]) throw new KingdomError("occupied");
  const tiles = { ...kingdom.tiles, [b]: kingdom.tiles[a] };
  delete tiles[a];
  return { ...kingdom, tiles };
}
