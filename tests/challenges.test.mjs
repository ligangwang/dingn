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
  {
    method = "POST",
    body,
    cookie = "",
    ip = "127.0.0.1",
    claims,
    profile = null,
    forwarded,
  } = {},
) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method,
    url: pathname,
    headers: {
      origin: "http://127.0.0.1:3001",
      "x-dingn-request": "1",
      "content-type": "application/json",
      cookie,
      ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
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
        account: async () => profile,
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
  // Who made it stays on the server; a guest's says "A friend".
  assert.deepEqual(read.body, {
    id: made.body.id,
    game: "memory",
    ...round,
    name: null,
  });
  assert.equal(
    (await call("/api/challenges/Xq3v9TzK1bWm", { method: "GET" })).status,
    404,
  );
  assert.equal(
    (await call("/api/challenges/not-an-id", { method: "GET" })).status,
    404,
  );
});

test("a challenge keeps the rules its round was played with", async () => {
  const rules = "u3-1-0-0-2-0.n1";
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round, rules },
  });
  assert.equal((await store.getDoc("challenges", made.body.id)).rules, rules);
  const read = await call(`/api/challenges/${made.body.id}`, { method: "GET" });
  assert.equal(read.body.rules, rules);
  assert.equal(
    (
      await call("/api/challenges", {
        body: { game: "memory", ...round, rules: "a b" },
      })
    ).status,
    400,
  );
});

test("a signed-in player's challenge records who made it, and shows their nickname", async () => {
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round, score: 11 },
    cookie: "dingn-session=x",
    claims: { uid: "ada", name: "Ada Lovelace" },
    profile: { user_name: " Countess\u0007 " },
  });
  const saved = await store.getDoc("challenges", made.body.id);
  assert.equal(saved.uid, "ada");
  assert.equal(saved.name, "Countess");
  const read = await call(`/api/challenges/${made.body.id}`, {
    method: "GET",
  });
  assert.equal(read.body.name, "Countess");
  assert.equal(read.body.uid, undefined);
  // Without a nickname, the first word of their sign-in name.
  const named = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
    claims: { uid: "ada", name: "Ada Lovelace" },
  });
  assert.equal((await store.getDoc("challenges", named.body.id)).name, "Ada");
  // A session that no longer works still makes a guest's challenge.
  const stale = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
  });
  assert.equal(stale.status, 200);
  assert.equal((await store.getDoc("challenges", stale.body.id)).uid, null);
  assert.equal((await store.getDoc("challenges", stale.body.id)).name, null);
});

test("a nickname is cleaned and kept short", () => {
  assert.equal(challenges.nickname("x".repeat(40)), "x".repeat(24));
  assert.equal(challenges.nickname("", "  "), null);
  assert.equal(challenges.nickname(null, undefined), null);
  assert.equal(challenges.nickname("\u202eAda\u2066", ""), "Ada");
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
  assert.equal((await call("/api/challenges", { method: "GET" })).status, 405);
});

test("each guest has their own quota, and all guests one together", async () => {
  // Every guest reaches the server through the same proxy.
  const make = (forwarded, ip = "169.254.1.1") =>
    call("/api/challenges", {
      body: { game: "memory", ...round },
      ip,
      forwarded,
    }).then((r) => r.status);
  for (let i = 0; i < challenges.MAX_PER_WINDOW; i++)
    assert.equal(await make("203.0.113.9"), 200);
  assert.equal(await make("203.0.113.9, 169.254.8.1"), 429);
  // Another guest behind the same proxy is not held up.
  assert.equal(await make("198.51.100.4"), 200);
  // Made-up addresses still can't fill the store: all guests together stop
  // at the overall quota (earlier tests' guests count towards it too).
  let n = 0;
  // (Through several proxies, past dingn's general per-address throttle.)
  const fake = (n) => `10.9.${n >> 8}.${n & 255}`;
  const most = challenges.MAX_GUESTS_PER_WINDOW;
  while (n < most && (await make(fake(n), `169.254.2.${n >> 6}`)) === 200) n++;
  assert.ok(n < challenges.MAX_GUESTS_PER_WINDOW - challenges.MAX_PER_WINDOW);
  assert.ok(n > challenges.MAX_GUESTS_PER_WINDOW - 100);
  // Signed-in players are counted by account instead.
  assert.equal(
    (
      await call("/api/challenges", {
        body: { game: "memory", ...round },
        cookie: "dingn-session=x",
        claims: { uid: "grace" },
      })
    ).status,
    200,
  );
});
