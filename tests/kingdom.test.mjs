// The kingdom: badges give account XP, the level opens stages and land, and
// buildings cost coins under rules the server enforces.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, rewards, kingdom, store, rules, backfill;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-kingdom-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  rewards = await import("../scripts/rewards.mjs");
  kingdom = await import("../scripts/kingdom.mjs");
  store = await import("../scripts/platform-store.mjs");
  rules = await import("kingdom/kingdom");
  backfill = await import("../scripts/backfill-badge-xp.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

const origin = "http://127.0.0.1:3001";
function call(handler, pathname, body, uid) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method: "POST",
    url: pathname,
    headers: {
      origin,
      "x-dingn-request": "1",
      "content-type": "application/json",
    },
    socket: { remoteAddress: "127.0.0.1" },
  });
  return new Promise((resolve) => {
    let status = 0;
    handler(
      req,
      {
        writeHead: (s) => (status = s),
        end: (b) => resolve({ status, body: JSON.parse(b) }),
      },
      pathname,
      {
        verify: async () => ({ uid, name: "Kim Lee" }),
        exchange: async () => "t",
      },
    );
  });
}
const visit = (pathname, body, uid = "kim") =>
  call(kingdom.handleKingdom, pathname, body, uid);

test("stages open with the account level and the land keeps growing", () => {
  assert.equal(rules.stageFor(1), null);
  assert.equal(rules.stageFor(2).id, "camp");
  assert.equal(rules.stageFor(5).id, "village");
  assert.equal(rules.stageFor(99).id, "capital");
  assert.deepEqual(rules.landBounds(4), { lo: -1, hi: 2 });
  assert.deepEqual(rules.landBounds(5), { lo: -2, hi: 2 });
  // Every tile of a stage stays land at the next one.
  for (let i = 1; i < rules.STAGES.length; i++) {
    const small = rules.landBounds(rules.STAGES[i - 1].size);
    for (let x = small.lo; x <= small.hi; x++)
      assert.ok(rules.onLand(rules.STAGES[i].size, x, small.lo));
  }
});

test("every stage's free buildings fit its land, without moving", () => {
  // Each stage's starters, placed on an empty kingdom one stage at a time,
  // land on their own spots: on that stage's land, off the hall, and on
  // tiles no earlier starter took.
  let k = rules.kingdomOf(null);
  const counts = {};
  for (const stage of rules.STAGES) {
    for (const [id, x, y] of rules.STARTERS[stage.id]) {
      const def = rules.building(id);
      assert.ok(def, id);
      assert.ok(
        rules.STAGE_IDS.indexOf(def.stage) <= rules.STAGE_IDS.indexOf(stage.id),
        `${id} opens after ${stage.id}`,
      );
      assert.ok(rules.onLand(stage.size, x, y), `${id} ${x},${y}`);
      assert.ok(!rules.isHallTile(x, y), `${id} ${x},${y}`);
      counts[id] = (counts[id] ?? 0) + 1;
      assert.ok(counts[id] <= def.max, id);
    }
    k = rules.settle(k, stage.level);
    assert.equal(k.hall, stage.id);
    for (const [id, x, y] of rules.STARTERS[stage.id])
      assert.equal(k.tiles[rules.tileKey(x, y)], id);
  }
});

test("the level gives the hall and free buildings, once", () => {
  const empty = rules.kingdomOf(null);
  assert.equal(rules.settle(empty, 1), empty);
  const camp = rules.settle(empty, 2);
  assert.equal(camp.hall, "camp");
  assert.deepEqual(camp.granted, ["camp"]);
  assert.equal(Object.keys(camp.tiles).length, rules.STARTERS.camp.length);
  // Settled already: nothing changes.
  assert.equal(rules.settle(camp, 3), camp);
  // A player who moved or built over a starter spot keeps their layout;
  // the free building goes to the nearest free tile instead.
  const moved = rules.move(camp, { from: [2, 2], to: [2, 1] }, 3);
  const village = rules.settle(moved, 4);
  assert.equal(village.hall, "village");
  assert.equal(village.tiles["2,1"], "cottage");
  // The well wanted 2,1; it stands on the free tile beside it.
  assert.equal(village.tiles["2,2"], "well");
  assert.equal(
    Object.keys(village.tiles).length,
    rules.STARTERS.camp.length + rules.STARTERS.village.length,
  );
  // Levels skipped at once give every stage in between.
  const town = rules.settle(empty, 6);
  assert.equal(town.hall, "town");
  assert.deepEqual(town.granted, ["camp", "village", "town"]);
  // A building already at its limit isn't given again.
  let full = rules.settle(empty, 9);
  const statues = { ...full, granted: [...full.granted] };
  statues.tiles = { ...full.tiles, "4,4": "statue", "-4,4": "statue" };
  full = rules.settle(statues, 15);
  assert.equal(
    Object.values(full.tiles).filter((b) => b === "statue").length,
    2,
  );

  // Halls bought before they came free are paid back, once.
  assert.equal(rules.hallRefund(null), 0);
  assert.equal(rules.hallRefund({ kingdom: { hall: "camp", tiles: {} } }), 0);
  assert.equal(
    rules.hallRefund({ kingdom: { hall: "town", tiles: {} } }),
    100 + 250,
  );
  assert.equal(
    rules.hallRefund({ kingdom: { hall: "town", tiles: {}, granted: [] } }),
    0,
  );
});

test("building follows the rules", () => {
  const empty = rules.kingdomOf(null);
  const at = (level, coins, request, k = empty) => {
    try {
      return rules.build(k, request, level, coins);
    } catch (e) {
      return e.code;
    }
  };
  assert.equal(at(1, 99, { id: "cottage", x: 1, y: 0 }), "locked");
  assert.equal(at(9, 99, { id: "nope", x: 1, y: 0 }), "unknown-building");
  assert.equal(at(2, 99, { id: "cottage", x: 0, y: 0 }), "off-land");
  assert.equal(at(2, 99, { id: "cottage", x: 3, y: 0 }), "off-land");
  // The hall's grounds are the 3 x 3 tiles around it.
  assert.equal(at(2, 99, { id: "cottage", x: 1, y: -1 }), "off-land");
  assert.equal(at(2, 10, { id: "cottage", x: 2, y: -1 }), "not-enough-coins");
  assert.equal(at(2, 999, { id: "market", x: 2, y: -1 }), "level");
  // The free camp path stands at 2,0.
  assert.equal(at(2, 999, { id: "cottage", x: 2, y: 0 }), "occupied");

  const first = at(2, 20, { id: "cottage", x: 2, y: -1 });
  assert.equal(first.coins, 20);
  assert.equal(first.kingdom.tiles["2,-1"], "cottage");
  assert.equal(first.kingdom.hall, "camp");
  assert.deepEqual(first.kingdom.granted, ["camp"]);
  assert.equal(
    at(2, 99, { id: "farm", x: 2, y: -1 }, first.kingdom),
    "occupied",
  );
  // The village opens with its hall, free.
  const village = at(4, 80, { id: "market", x: -2, y: 1 }, first.kingdom);
  assert.equal(village.coins, 40);
  assert.equal(village.kingdom.hall, "village");

  // The camp gives one wheat field; five more fill the limit.
  let k = rules.settle(empty, 2);
  for (const [x, y] of [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [1, -2],
    [-1, 2],
  ])
    k = rules.build(k, { id: "farm", x, y }, 2, 99).kingdom;
  assert.equal(at(2, 99, { id: "farm", x: 1, y: 2 }, k), "max");

  const moved = rules.move(first.kingdom, { from: [2, -1], to: [-2, 1] }, 2);
  assert.equal(moved.tiles["-2,1"], "cottage");
  assert.equal(moved.tiles["2,-1"], undefined);
  assert.throws(
    () => rules.move(first.kingdom, { from: [2, -1], to: [1, 1] }, 2),
    { code: "off-land" },
  );
  assert.throws(
    () => rules.move(first.kingdom, { from: [1, 2], to: [2, 1] }, 2),
    {
      code: "empty",
    },
  );
});

test("badges pay account XP once, even when settled twice", () => {
  const doc = {
    coins: 0,
    badges: {
      "rush/a": { tier: "bronze" },
      "rush/b": { tier: "diamond" },
    },
  };
  assert.equal(rewards.badgeXpOwed(doc), 220);
  const paid = rewards.payBadgeXp(doc, { xp: 90, name: "Ann" }, "Kim");
  assert.equal(paid.xp, 220);
  assert.deepEqual(paid.player, {
    xp: 310,
    level: 3,
    badgeXp: 220,
    name: "Ann",
  });
  assert.equal(paid.doc.xpPaid, 220);
  assert.equal(rewards.badgeXpOwed(paid.doc), 0);
  assert.equal(rewards.payBadgeXp(paid.doc, paid.player).xp, 0);
  assert.equal(rewards.payBadgeXp(doc, null, "Kim").player.name, "Kim");
});

async function publishRush() {
  await registry.updateRecord("rush", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest({
        id: "rush",
        version: "1.0.0",
        title: { en: "Rush", zh: "冲" },
        badges: [
          {
            id: "gold-1",
            tier: "gold",
            icon: "trophy",
            title: { en: "A", zh: "甲" },
          },
          {
            id: "gold-2",
            tier: "gold",
            icon: "trophy",
            title: { en: "B", zh: "乙" },
          },
        ],
      }),
      { listed: true },
    ),
  );
  registry.clearRegistryCache();
}

test("a player earns badges, reaches the camp and builds", async () => {
  await publishRush();
  const unlock = (badge) =>
    call(
      rewards.handleRewards,
      "/api/rewards/unlock",
      { game: "rush", version: "1.0.0", badge },
      "kim",
    );
  let me = await visit("/api/kingdom/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.stage, null);
  assert.equal(
    (await visit("/api/kingdom/build", { building: "cottage", x: 2, y: 0 }))
      .status,
    403,
  );

  const first = await unlock("gold-1");
  assert.equal(first.body.xp, 100);
  // The badge's coins, its XP and the camp leader honor, in one save.
  assert.deepEqual(
    first.body.granted.map((g) => g.reward),
    ["coins", "xp", "level", "honor"],
  );
  assert.equal((await unlock("gold-1")).body.xp, 0);
  me = await visit("/api/kingdom/me");
  assert.equal(me.body.level, 2);
  assert.equal(me.body.stage, "camp");
  assert.equal(me.body.size, 5);
  assert.equal(me.body.coins, 50);
  assert.equal((await store.getDoc("players", "kim")).name, "Kim");
  // The camp comes with its free buildings, saved on the first look.
  assert.deepEqual(me.body.gifts, ["camp"]);
  assert.equal(me.body.tiles["2,0"], "path");
  assert.deepEqual((await store.getDoc("rewards", "kim")).kingdom.granted, [
    "camp",
  ]);
  assert.deepEqual((await visit("/api/kingdom/me")).body.gifts, []);

  const built = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 2,
    y: 1,
  });
  assert.equal(built.status, 200);
  assert.equal(built.body.paid, 20);
  assert.equal(built.body.coins, 30);
  assert.equal(built.body.tiles["2,1"], "cottage");
  const doc = await store.getDoc("rewards", "kim");
  assert.equal(doc.spent, 20);
  assert.equal(rewards.wallet(doc).coins, 30);

  const busy = await visit("/api/kingdom/build", {
    building: "farm",
    x: 2,
    y: 1,
  });
  assert.deepEqual([busy.status, busy.body.error], [409, "occupied"]);
  const poor = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 2,
    y: -1,
  });
  assert.equal(poor.status, 200);
  const broke = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 1,
    y: 2,
  });
  assert.deepEqual([broke.status, broke.body.error], [402, "not-enough-coins"]);
  assert.equal(
    (await visit("/api/kingdom/build", { building: "__proto__" })).status,
    400,
  );

  const moved = await visit("/api/kingdom/move", {
    from: [2, 1],
    to: [1, 2],
  });
  assert.equal(moved.body.tiles["1,2"], "cottage");
  assert.equal(moved.body.tiles["2,1"], undefined);
});

test("a hall bought before halls came free is paid back on the next look", async () => {
  await store.mergeDoc("players", "hal", { xp: 1500 }); // level 6: the town
  await store.mergeDoc("rewards", "hal", {
    coins: 10,
    spent: 400,
    kingdom: { hall: "village", tiles: { "2,0": "cottage" } },
  });
  const me = await visit("/api/kingdom/me", {}, "hal");
  assert.equal(me.body.stage, "town");
  assert.equal(me.body.hall, "town");
  assert.deepEqual(me.body.gifts, ["camp", "village", "town"]);
  assert.equal(me.body.coins, 110);
  // Their cottage stays; the camp's path goes beside it.
  assert.equal(me.body.tiles["2,0"], "cottage");
  const doc = await store.getDoc("rewards", "hal");
  assert.equal(doc.spent, 300);
  assert.equal((await visit("/api/kingdom/me", {}, "hal")).body.coins, 110);
});

test("visiting the kingdom pays badge XP earned before badges gave XP", async () => {
  await store.mergeDoc("rewards", "old", {
    coins: 50,
    badges: {
      "rush/gold-1": { tier: "gold" },
      "rush/gold-2": { tier: "gold" },
    },
  });
  const me = await visit("/api/kingdom/me", {}, "old");
  assert.equal(me.body.xp, 200);
  assert.equal(me.body.stage, "camp");
  assert.equal((await visit("/api/kingdom/me", {}, "old")).body.xp, 200);
});

test("the backfill pays only what is owed", async () => {
  const docs = [
    { id: "a", data: () => ({ badges: { x: { tier: "silver" } } }) },
    {
      id: "b",
      data: () => ({ badges: { x: { tier: "silver" } }, xpPaid: 50 }),
    },
  ];
  const db = {
    collection: () => ({
      orderBy: () => ({
        limit: () => {
          const q = {
            started: false,
            startAfter() {
              q.started = true;
              return q;
            },
            async get() {
              const page = q.started ? [] : docs;
              return { empty: !page.length, docs: page };
            },
          };
          return q;
        },
      }),
    }),
  };
  const settled = [];
  const dry = await backfill.backfill(db, { log: () => {} });
  assert.deepEqual(dry, { players: 2, owed: 1, xp: 50 });
  await backfill.backfill(db, {
    apply: true,
    log: () => {},
    settle: async (uid) => (settled.push(uid), 50),
  });
  assert.deepEqual(settled, ["a"]);
});
