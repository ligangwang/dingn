// Coins and badges: game.json badges, unlocking them through the API, and the
// limits that keep a cheating game from printing coins.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, rewards;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-rewards-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  rewards = await import("../scripts/rewards.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

const badge = (id, extra = {}) => ({
  id,
  tier: "silver",
  level: 10,
  title: { en: "Clear level 10", zh: "通过第 10 关" },
  ...extra,
});
const manifest = (id, version, badges) => ({
  id,
  version,
  title: { en: "Rush", zh: "冲" },
  badges,
});

function problems(badges) {
  try {
    registry.validateManifest(manifest("rush", "1.0.0", badges));
    return "";
  } catch (error) {
    return error.message;
  }
}

test("game.json badges are checked", () => {
  const ok = registry.validateManifest(
    manifest("rush", "1.0.0", [
      badge("level-10"),
      badge("trex", { tier: "gold", level: undefined, icon: "boss" }),
    ]),
  );
  assert.deepEqual(ok.badges[1], {
    id: "trex",
    tier: "gold",
    icon: "boss",
    coins: 50,
    title: { en: "Clear level 10", zh: "通过第 10 关" },
  });
  assert.deepEqual(
    registry.validateManifest(manifest("rush", "1.0.0")).badges,
    [],
  );
  assert.match(problems([badge("a"), badge("a")]), /used twice/);
  assert.match(problems([badge("Bad Id")]), /id must be/);
  assert.match(problems([badge("a", { tier: "platinum" })]), /tier/);
  assert.match(problems([badge("a", { icon: "boss" })]), /either a level/);
  assert.match(problems([badge("a", { level: undefined })]), /either a level/);
  assert.match(
    problems([badge("a", { level: undefined, icon: "dragon" })]),
    /icon must be/,
  );
  // dingn, not the game, decides what a badge pays.
  assert.equal(
    registry.validateManifest(
      manifest("rush", "1.0.0", [badge("a", { coins: 999 })]),
    ).badges[0].coins,
    25,
  );
  assert.match(problems([badge("a", { title: { en: "x" } })]), /title\.zh/);
  assert.match(
    problems(
      Array.from({ length: 11 }, (_, i) => badge(`b${i}`, { tier: "diamond" })),
    ),
    /at most 1000/,
  );
  assert.match(
    problems(Array.from({ length: 51 }, (_, i) => badge(`b${i}`))),
    /up to 50/,
  );
});

test("a badge pays once, and a game's coins are capped", () => {
  const big = badge("big", { tier: "diamond" });
  let doc = null;
  let step = rewards.awardBadge(doc, "rush", badge("level-10"), "2026-01-01");
  assert.deepEqual(step.result, { new: true, coins: 25, balance: 25 });
  doc = step.doc;
  step = rewards.awardBadge(doc, "rush", badge("level-10"));
  assert.deepEqual(step.result, { new: false, coins: 0, balance: 25 });
  // Nearly at the cap: the next badge pays only what is left.
  doc = { ...doc, games: { rush: 950 }, coins: 950 };
  step = rewards.awardBadge(doc, "rush", big, "2026-01-02");
  assert.equal(step.result.coins, 50);
  step = rewards.awardBadge(step.doc, "rush", badge("more"), "2026-01-03");
  assert.equal(step.result.coins, 0);
  assert.equal(step.result.new, true);
  // Another game has its own cap.
  step = rewards.awardBadge(step.doc, "pop", big, "2026-01-04");
  assert.equal(step.result.coins, 100);
  // A game id that is also an Object.prototype name still starts at zero.
  step = rewards.awardBadge(step.doc, "constructor", badge("a"), "2026-01-05");
  assert.equal(step.result.coins, 25);
  const wallet = rewards.wallet(step.doc);
  assert.equal(wallet.coins, 1125);
  assert.deepEqual(
    wallet.badges.map((b) => `${b.game}/${b.id}`),
    ["constructor/a", "pop/big", "rush/more", "rush/big", "rush/level-10"],
  );
});

const origin = "http://127.0.0.1:3001";
function call(pathname, body, uid = "pat") {
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
    rewards.handleRewards(
      req,
      {
        writeHead: (s) => (status = s),
        end: (b) => resolve({ status, body: JSON.parse(b) }),
      },
      pathname,
      { verify: async () => ({ uid }), exchange: async () => "t" },
    );
  });
}

test("players unlock badges from the version they play", async () => {
  await registry.updateRecord("rush", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest(
        manifest("rush", "1.0.0", [
          badge("level-10"),
          badge("level-5", { tier: "bronze", level: 5 }),
        ]),
      ),
      { listed: true },
    ),
  );
  registry.clearRegistryCache();
  const unlock = (badgeId, extra = {}) =>
    call("/api/rewards/unlock", {
      game: "rush",
      version: "1.0.0",
      badge: badgeId,
      ...extra,
    });

  const first = await unlock("level-10");
  assert.equal(first.status, 200);
  assert.equal(first.body.new, true);
  assert.equal(first.body.coins, 25);
  assert.equal(first.body.balance, 25);
  assert.equal(first.body.badge.title.zh, "通过第 10 关");
  assert.equal((await unlock("level-10")).body.new, false);
  assert.equal((await unlock("level-5")).body.balance, 35);

  assert.equal((await unlock("level-99")).status, 404);
  assert.equal((await unlock("level-5", { version: "9.9.9" })).status, 404);
  assert.equal((await unlock("level-5", { game: "nogame" })).status, 404);
  assert.equal((await unlock("../x")).status, 400);

  const me = await call("/api/rewards/me", {});
  assert.equal(me.body.coins, 35);
  assert.deepEqual(me.body.badges.map((b) => b.id).sort(), [
    "level-10",
    "level-5",
  ]);
  assert.equal((await call("/api/rewards/me", {}, "sam")).body.coins, 0);

  // An admin can switch a game's rewards off.
  await registry.updateRecord("rush", (r) => ({ ...r, rewards: "off" }));
  registry.clearRegistryCache();
  assert.equal((await unlock("level-5")).status, 403);
});

test("an unreviewed upload's badges are only a test", async () => {
  await registry.updateRecord("moon", (r) =>
    registry.addVersion(
      { owner: "dev1" },
      registry.validateManifest(manifest("moon", "1.0.0", [badge("level-10")])),
      { channel: "beta" },
    ),
  );
  registry.clearRegistryCache();
  const result = await call(
    "/api/rewards/unlock",
    { game: "moon", version: "1.0.0", badge: "level-10" },
    "tess",
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.test, true);
  assert.equal(result.body.balance, null);
  assert.equal((await call("/api/rewards/me", {}, "tess")).body.coins, 0);
});

test("the player page learns which badges a game offers", async () => {
  registry.clearRegistryCache();
  const record = await registry.getRecord("rush");
  assert.deepEqual(
    registry.publicGame(record).badges.map((b) => b.id),
    ["level-10", "level-5"],
  );
});
