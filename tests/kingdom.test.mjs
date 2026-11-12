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
  rules = await import("../src/data/kingdom.mjs");
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
  // Each hall upgrade belongs to a stage after the camp, in order.
  const halls = rules.BUILDINGS.filter((b) => b.hall).map((b) => b.stage);
  assert.deepEqual(halls, rules.STAGE_IDS.slice(1));
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
  assert.equal(at(2, 10, { id: "cottage", x: 1, y: 0 }), "not-enough-coins");
  assert.equal(at(2, 999, { id: "market", x: 1, y: 0 }), "level");
  assert.equal(at(4, 999, { id: "market", x: 1, y: 0 }), "hall-first");
  assert.equal(at(4, 999, { id: "hall-town" }), "level");
  assert.equal(at(6, 999, { id: "hall-town" }), "hall-first");

  const first = at(2, 20, { id: "cottage", x: 2, y: -1 });
  assert.equal(first.coins, 20);
  assert.equal(first.kingdom.tiles["2,-1"], "cottage");
  assert.equal(
    at(2, 99, { id: "farm", x: 2, y: -1 }, first.kingdom),
    "occupied",
  );
  const hall = at(4, 100, { id: "hall-village" }, first.kingdom);
  assert.equal(hall.kingdom.hall, "village");
  assert.equal(
    at(4, 999, { id: "hall-village" }, hall.kingdom),
    "already-built",
  );
  assert.equal(
    at(4, 80, { id: "market", x: -2, y: 2 }, hall.kingdom).coins,
    80,
  );

  let k = empty;
  for (let x = -1; x <= 2; x++)
    for (let y = -1; y <= 2; y++)
      if ((x || y) && Object.keys(k.tiles).length < 6)
        k = rules.build(k, { id: "farm", x, y }, 2, 99).kingdom;
  assert.equal(at(2, 99, { id: "farm", x: 2, y: 2 }, k), "max");

  const moved = rules.move(first.kingdom, { from: [2, -1], to: [1, 1] }, 2);
  assert.deepEqual(moved.tiles, { "1,1": "cottage" });
  assert.throws(
    () => rules.move(first.kingdom, { from: [2, -1], to: [0, 0] }, 2),
    { code: "off-land" },
  );
  assert.throws(
    () => rules.move(first.kingdom, { from: [1, 1], to: [1, 2] }, 2),
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
    (await visit("/api/kingdom/build", { building: "cottage", x: 1, y: 0 }))
      .status,
    403,
  );

  const first = await unlock("gold-1");
  assert.equal(first.body.xp, 100);
  assert.equal((await unlock("gold-1")).body.xp, 0);
  me = await visit("/api/kingdom/me");
  assert.equal(me.body.level, 2);
  assert.equal(me.body.stage, "camp");
  assert.equal(me.body.size, 4);
  assert.equal(me.body.coins, 50);
  assert.equal((await store.getDoc("players", "kim")).name, "Kim");

  const built = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 1,
    y: 0,
  });
  assert.equal(built.status, 200);
  assert.equal(built.body.paid, 20);
  assert.equal(built.body.coins, 30);
  assert.deepEqual(built.body.tiles, { "1,0": "cottage" });
  const doc = await store.getDoc("rewards", "kim");
  assert.equal(doc.spent, 20);
  assert.equal(rewards.wallet(doc).coins, 30);

  const busy = await visit("/api/kingdom/build", {
    building: "farm",
    x: 1,
    y: 0,
  });
  assert.deepEqual([busy.status, busy.body.error], [409, "occupied"]);
  const poor = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 2,
    y: 0,
  });
  assert.equal(poor.status, 200);
  const broke = await visit("/api/kingdom/build", {
    building: "cottage",
    x: 2,
    y: 1,
  });
  assert.deepEqual([broke.status, broke.body.error], [402, "not-enough-coins"]);
  assert.equal(
    (await visit("/api/kingdom/build", { building: "__proto__" })).status,
    400,
  );

  const moved = await visit("/api/kingdom/move", {
    from: [1, 0],
    to: [-1, -1],
  });
  assert.deepEqual(moved.body.tiles, { "-1,-1": "cottage", "2,0": "cottage" });
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
