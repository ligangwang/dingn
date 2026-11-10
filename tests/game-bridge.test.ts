import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountProgress,
  handleGameRequest,
  isGameRequest,
  MAX_VALUE,
  type BridgeContext,
  type GameRequest,
} from "../src/lib/game-bridge";

function context(signedIn: boolean) {
  const store = new Map<string, string>();
  const saved: string[] = [];
  const calls: string[] = [];
  const ctx: BridgeContext = {
    gameId: "hello",
    version: "1.0.0",
    locale: "zh-CN",
    player: { signedIn, name: signedIn ? "Ada" : "", avatar: "" },
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
    loadProgress: async () => saved.at(-1) ?? null,
    saveProgress: async (json) => void saved.push(json),
    signIn: () => void calls.push("signIn"),
    navigate: (path) => void calls.push(`navigate ${path}`),
    ready: () => void calls.push("ready"),
  };
  return { ctx, store, saved, calls };
}
const ask = (
  method: string,
  params?: Record<string, unknown>,
): GameRequest => ({
  dingn: "game",
  v: 1,
  id: 7,
  method,
  params,
});

test("only protocol messages are treated as game requests", () => {
  assert.ok(isGameRequest(ask("init")));
  for (const other of [
    null,
    "init",
    { dingn: "game", v: 2, method: "init" },
    { method: "init" },
  ])
    assert.equal(isGameRequest(other), false);
});

test("init tells the game who is playing, in which language", async () => {
  const reply = await handleGameRequest(ask("init"), context(true).ctx);
  assert.deepEqual(reply, {
    dingn: "host",
    v: 1,
    id: 7,
    result: {
      gameId: "hello",
      version: "1.0.0",
      locale: "zh-CN",
      player: { signedIn: true, name: "Ada", avatar: "" },
    },
  });
});

test("a game's storage is namespaced to that game and size-limited", async () => {
  const { ctx, store } = context(false);
  await handleGameRequest(
    ask("storage.set", { key: "best", value: { n: 3 } }),
    ctx,
  );
  assert.equal(store.get("dingn.game.hello.best"), '{"n":3}');
  const got = await handleGameRequest(ask("storage.get", { key: "best" }), ctx);
  assert.deepEqual(got && "result" in got && got.result, { n: 3 });
  for (const params of [
    { key: "../dingn.locale" },
    { key: "" },
    { key: "x", value: "a".repeat(MAX_VALUE) },
  ]) {
    const reply = await handleGameRequest(ask("storage.set", params), ctx);
    assert.ok(reply && "error" in reply, JSON.stringify(params));
  }
  assert.equal(store.size, 1);
});

test("progress needs a signed-in player", async () => {
  const out = context(false);
  const refused = await handleGameRequest(
    ask("progress.save", { data: { level: 2 } }),
    out.ctx,
  );
  assert.equal(
    refused && "error" in refused && refused.error.code,
    "signed_out",
  );
  assert.deepEqual(out.saved, []);

  const inn = context(true);
  await handleGameRequest(
    ask("progress.save", { data: { level: 2 } }),
    inn.ctx,
  );
  const loaded = await handleGameRequest(ask("progress.load"), inn.ctx);
  assert.deepEqual(loaded && "result" in loaded && loaded.result, { level: 2 });
});

test("notifications get no reply, unknown methods get an error", async () => {
  const { ctx, calls } = context(false);
  assert.equal(
    await handleGameRequest({ dingn: "game", v: 1, method: "ready" }, ctx),
    null,
  );
  assert.equal(
    await handleGameRequest({ dingn: "game", v: 1, method: "signIn" }, ctx),
    null,
  );
  assert.deepEqual(calls, ["ready", "signIn"]);
  const reply = await handleGameRequest(ask("account.delete"), ctx);
  assert.equal(reply && "error" in reply && reply.error.code, "unknown_method");
});

test("a game can only send the player to a dingn page", async () => {
  const { ctx, calls } = context(false);
  await handleGameRequest(ask("navigate", { path: "/zh/word/" }), ctx);
  for (const path of [
    "//evil.example/",
    "https://evil.example/",
    "javascript:alert(1)",
    "/zh//example.org/",
    "/a//b",
    "/a b",
    3,
  ]) {
    const reply = await handleGameRequest(ask("navigate", { path }), ctx);
    assert.ok(reply && "error" in reply, String(path));
  }
  assert.deepEqual(calls, ["navigate /zh/word/"]);
});

test("a game reads only its own saves", async () => {
  const { ctx, store } = context(false);
  ctx.gameId = "crowdrush";
  store.set("dingn.game.crowd.level", '"7"');
  store.set("dingn.crowd.level", "3");
  const reply = await handleGameRequest(
    ask("storage.get", { key: "level" }),
    ctx,
  );
  assert.deepEqual(reply && "result" in reply && reply.result, null);
  assert.equal(
    accountProgress("crowdrush", {
      game_progress_crowd: '{"level":20}',
      crowd_level: 12,
    }),
    null,
  );
  assert.equal(
    accountProgress("crowdrush", { game_progress_crowdrush: '{"level":21}' }),
    '{"level":21}',
  );
});

test("a game unlocks badges for a signed-in player only", async () => {
  const unlocked: string[] = [];
  const withRewards = (signedIn: boolean) => {
    const { ctx } = context(signedIn);
    ctx.rewards = {
      unlock: async (id) => {
        unlocked.push(id);
        return { new: true, coins: 40 };
      },
      list: async () => [],
      spend: async (id) => {
        unlocked.push(`spend:${id}`);
        return { new: true, coins: 60 };
      },
      shop: async () => [],
      earn: async (coins) => {
        unlocked.push(`earn:${coins}`);
        return { coins, left: 30 - coins };
      },
    };
    return ctx;
  };
  const code = (reply: Awaited<ReturnType<typeof handleGameRequest>>) =>
    reply && "error" in reply ? reply.error.code : "ok";

  const ok = await handleGameRequest(
    ask("rewards.unlock", { id: "level-10" }),
    withRewards(true),
  );
  assert.deepEqual(ok && "result" in ok && ok.result, { new: true, coins: 40 });
  assert.equal(
    code(
      await handleGameRequest(
        ask("rewards.unlock", { id: "level-10" }),
        withRewards(false),
      ),
    ),
    "signed_out",
  );
  for (const id of ["", "Level 10", "../x", 7, "a".repeat(41)])
    assert.equal(
      code(
        await handleGameRequest(
          ask("rewards.unlock", { id }),
          withRewards(true),
        ),
      ),
      "invalid",
    );
  // Where the host has no rewards (an old page), the game hears so.
  assert.equal(
    code(
      await handleGameRequest(
        ask("rewards.unlock", { id: "level-10" }),
        context(true).ctx,
      ),
    ),
    "unavailable",
  );
  assert.deepEqual(unlocked, ["level-10"]);

  // Coins for play: 1-10 whole coins, signed in only.
  const earned = await handleGameRequest(
    ask("rewards.earn", { coins: 3 }),
    withRewards(true),
  );
  assert.deepEqual(earned && "result" in earned && earned.result, {
    coins: 3,
    left: 27,
  });
  for (const coins of [0, 11, 2.5, "3", -1])
    assert.equal(
      code(
        await handleGameRequest(
          ask("rewards.earn", { coins }),
          withRewards(true),
        ),
      ),
      "invalid",
    );
  assert.equal(
    code(
      await handleGameRequest(
        ask("rewards.earn", { coins: 3 }),
        withRewards(false),
      ),
    ),
    "signed_out",
  );
  assert.deepEqual(unlocked, ["level-10", "earn:3"]);
});
test("a game spends coins only for a signed-in player, through the host", async () => {
  const spent: string[] = [];
  const withShop = (signedIn: boolean) => {
    const { ctx } = context(signedIn);
    ctx.rewards = {
      unlock: async () => ({ new: true, coins: 0 }),
      list: async () => [],
      spend: async (id) => {
        spent.push(id);
        return { new: true, coins: 60 };
      },
      shop: async () => [
        { id: "power-1", price: 60, title: "Power +1", owned: false },
      ],
      earn: async (coins) => ({ coins, left: 0 }),
    };
    return ctx;
  };
  const code = (reply: Awaited<ReturnType<typeof handleGameRequest>>) =>
    reply && "error" in reply ? reply.error.code : "ok";
  const ok = await handleGameRequest(
    ask("rewards.spend", { id: "power-1" }),
    withShop(true),
  );
  assert.deepEqual(ok && "result" in ok && ok.result, { new: true, coins: 60 });
  assert.equal(
    code(
      await handleGameRequest(
        ask("rewards.spend", { id: "power-1" }),
        withShop(false),
      ),
    ),
    "signed_out",
  );
  assert.equal(
    code(
      await handleGameRequest(
        ask("rewards.spend", { id: "../x" }),
        withShop(true),
      ),
    ),
    "invalid",
  );
  assert.deepEqual(spent, ["power-1"]);
  const shop = await handleGameRequest(ask("rewards.shop"), withShop(false));
  assert.equal(
    shop && "result" in shop && (shop.result as unknown[]).length,
    1,
  );
});
