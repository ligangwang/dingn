// Saved challenges: a challenge link names a challenge dingn saved, so its
// score can't be changed in the address.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, challenges, store;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-challenges-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  challenges = await import("../scripts/challenges.mjs");
  store = await import("../scripts/platform-store.mjs");
  await registry.updateRecord("memory", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest({
        id: "memory",
        version: "1.0.0",
        title: { en: "Memory", zh: "记忆" },
      }),
    ),
  );
});
after(() => rm(dir, { recursive: true, force: true }));

function call(
  pathname,
  { method = "POST", body, cookie = "", ip = "127.0.0.1", claims } = {},
) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method,
    url: pathname,
    headers: {
      origin: "http://127.0.0.1:3001",
      "x-dingn-request": "1",
      "content-type": "application/json",
      cookie,
    },
    socket: { remoteAddress: ip },
  });
  return new Promise((resolve) => {
    let status = 0;
    let headers = {};
    challenges.handleChallenges(
      req,
      {
        writeHead: (s, h) => ((status = s), (headers = h)),
        end: (b) => resolve({ status, headers, body: JSON.parse(b) }),
      },
      pathname,
      {
        verify: async () => {
          if (!claims) throw new Error("bad token");
          return claims;
        },
        exchange: async () => "t",
      },
    );
  });
}

const round = { mode: "ladder", seed: "2026-11-16", score: 10, unit: "digits" };

test("a challenge is saved privately and opened by its id", async () => {
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round },
  });
  assert.equal(made.status, 200);
  assert.match(made.body.id, /^[A-Za-z0-9_-]{12}$/);
  const saved = await store.getDoc("challenges", made.body.id);
  assert.equal(saved.public, false);
  assert.equal(saved.uid, null);
  assert.equal(saved.game, "memory");
  assert.equal(saved.score, 10);
  assert.ok(Date.parse(saved.createdAt));

  const read = await call(`/api/challenges/${made.body.id}`, {
    method: "GET",
  });
  assert.equal(read.status, 200);
  // Who made it stays on the server.
  assert.deepEqual(read.body, { id: made.body.id, game: "memory", ...round });
  assert.equal(
    (await call("/api/challenges/Xq3v9TzK1bWm", { method: "GET" })).status,
    404,
  );
  assert.equal(
    (await call("/api/challenges/not-an-id", { method: "GET" })).status,
    404,
  );
});

test("a signed-in player's challenge records who made it", async () => {
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round, score: 11 },
    cookie: "dingn-session=x",
    claims: { uid: "ada" },
  });
  assert.equal((await store.getDoc("challenges", made.body.id)).uid, "ada");
  // A session that no longer works still makes a guest's challenge.
  const stale = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
  });
  assert.equal(stale.status, 200);
  assert.equal((await store.getDoc("challenges", stale.body.id)).uid, null);
});

test("only checked challenges for games on dingn are saved", async () => {
  for (const body of [
    { game: "memory", ...round, score: -1 },
    { game: "memory", ...round, unit: "dollars" },
    { game: "Bad Id", ...round },
    { ...round },
  ])
    assert.equal(
      (await call("/api/challenges", { body })).status,
      400,
      JSON.stringify(body),
    );
  assert.equal(
    (await call("/api/challenges", { body: { game: "nosuchgame", ...round } }))
      .status,
    404,
  );
  assert.equal(
    (await call("/api/challenges", { method: "GET" })).status,
    405,
  );
});

test("one address can't fill the store", async () => {
  const ip = "10.0.0.9";
  for (let i = 0; i < challenges.MAX_PER_WINDOW; i++)
    assert.equal(
      (await call("/api/challenges", { body: { game: "memory", ...round }, ip }))
        .status,
      200,
    );
  assert.equal(
    (await call("/api/challenges", { body: { game: "memory", ...round }, ip }))
      .status,
    429,
  );
});
