import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
