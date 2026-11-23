// Saved challenges: a challenge link names a challenge dingn saved, so its
// score can't be changed in the address.
import "./kingdom-rules.mjs";
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
      { listed: true },
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
    newId,
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
      // As the server passes it: without the query.
      pathname.split("?")[0],
      {
        verify: async () => {
          if (!claims) throw new Error("bad token");
          return claims;
        },
        exchange: async () => "t",
        account: async () => profile,
        ...(newId ? { newId } : {}),
      },
    );
  });
}

const round = { mode: "ladder", seed: "2026-11-16", score: 10, unit: "digits" };

test("a guest's challenge is saved unlisted and opened by its id", async () => {
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
    mine: false,
    results: [{ name: null, score: 10 }],
    players: 1,
  });
  // Who opens it changes the answer, so nothing may cache it.
  assert.equal(read.headers["Cache-Control"], "no-store");
  assert.equal(
    (await call("/api/challenges/Xq3v9TzK1bWm", { method: "GET" })).status,
    404,
  );
  assert.equal(
    (await call("/api/challenges/not-an-id", { method: "GET" })).status,
    404,
  );
});

test("a challenge says whether the player opening it made it, never who did", async () => {
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
    claims: { uid: "ada" },
  });
  const open = (claims) =>
    call(`/api/challenges/${made.body.id}`, {
      method: "GET",
      ...(claims ? { cookie: "dingn-session=x", claims } : {}),
    }).then((r) => r.body);
  assert.equal((await open({ uid: "ada" })).mine, true);
  assert.equal((await open({ uid: "grace" })).mine, false);
  // A guest, or a session that no longer works.
  assert.equal((await open(null)).mine, false);
  assert.equal(
    (
      await call(`/api/challenges/${made.body.id}`, {
        method: "GET",
        cookie: "dingn-session=x",
      })
    ).body.mine,
    false,
  );
  assert.equal((await open({ uid: "ada" })).uid, undefined);
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
  assert.equal((await call("/api/challenges", { method: "PUT" })).status, 405);
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

test("a test account's challenge is marked as a test", async () => {
  const made = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
    claims: { uid: "qa", name: "QA", tester: true },
  });
  assert.equal((await store.getDoc("challenges", made.body.id)).test, true);
  const player = await call("/api/challenges", {
    body: { game: "memory", ...round },
    cookie: "dingn-session=x",
    claims: { uid: "ada", name: "Ada" },
  });
  assert.equal(
    (await store.getDoc("challenges", player.body.id)).test,
    undefined,
  );
});

const ada = {
  claims: { uid: "u-ada", name: "Ada L" },
  cookie: "dingn-session=x",
};
const bo = { claims: { uid: "u-bo", name: "Bo K" }, cookie: "dingn-session=x" };
const post = (id, score, who = {}) =>
  call(`/api/challenges/${id}/results`, { body: { score }, ...who });
const open = (id, who = {}) =>
  call(`/api/challenges/${id}`, { method: "GET", ...who });

test("a signed-in player's challenge is a thread anyone can post a result under", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  const saved = await store.getDoc("challenges", body.id);
  assert.equal(saved.public, true);
  let thread = (await open(body.id)).body;
  assert.deepEqual(thread.results, [{ name: "Ada", score: 10 }]);
  assert.equal(thread.players, 1);

  const won = await post(body.id, 12, bo);
  assert.equal(won.status, 200);
  assert.deepEqual(won.body, {
    best: 12,
    rank: 1,
    players: 2,
    improved: true,
    beat: true,
  });
  // A lower score later keeps the best one.
  const worse = await post(body.id, 3, bo);
  assert.deepEqual(worse.body, {
    best: 12,
    rank: 1,
    players: 2,
    improved: false,
    beat: false,
  });
  thread = (await open(body.id, bo)).body;
  assert.deepEqual(thread.results, [
    { name: "Bo", score: 12, mine: true },
    { name: "Ada", score: 10 },
  ]);
  assert.equal(JSON.stringify(thread).includes("u-ada"), false);
  // The maker playing again raises their own entry.
  await post(body.id, 20, ada);
  thread = (await open(body.id)).body;
  assert.deepEqual(
    thread.results.map((r) => r.score),
    [20, 12],
  );
  assert.equal(thread.players, 2);
  // The score to beat stays the one the challenge was made with.
  assert.equal(thread.score, 10);
});

test("only a signed-in player posts a result, and only a whole score", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  assert.equal((await post(body.id, 12)).status, 401);
  assert.equal((await post(body.id, 1.5, bo)).status, 400);
  assert.equal((await post(body.id, -1, bo)).status, 400);
  assert.equal((await post("AAAAAAAAAAAA", 5, bo)).status, 404);
  assert.equal((await open(body.id)).body.players, 1);
});

test("a test account's result is checked but not saved", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  const tried = await post(body.id, 99, {
    claims: { uid: "u-test", name: "Tester1", roles: ["tester"] },
    cookie: "dingn-session=x",
  });
  assert.equal(tried.body.test, true);
  assert.equal(tried.body.beat, true);
  assert.equal((await open(body.id)).body.players, 1);
});

test("a thread keeps the best results only", () => {
  let doc = { score: 1, uid: "m", name: "M", createdAt: "2026-01-01" };
  for (let i = 0; i < challenges.MAX_RESULTS + 5; i++)
    doc = challenges.postResult(doc, {
      uid: `u${i}`,
      name: `P${i}`,
      score: 100 + i,
      now: `2026-01-02T00:00:${String(i).padStart(2, "0")}`,
    }).next;
  assert.equal(doc.results.length, challenges.MAX_RESULTS);
  assert.equal(doc.players, challenges.MAX_RESULTS + 6);
  const low = challenges.postResult(doc, {
    uid: "late",
    name: "Late",
    score: 2,
    now: "2026-01-03",
  });
  assert.equal(low.outcome.rank, null);
  assert.equal(low.outcome.beat, true);
  // Below the kept results, a player is known by their own best: playing
  // again counts them once, and a lower score is no improvement.
  const again = challenges.postResult(
    low.next,
    { uid: "late", name: "Late", score: 1, now: "2026-01-04" },
    { score: 2 },
  );
  assert.equal(again.outcome.players, low.outcome.players);
  assert.equal(again.outcome.improved, false);
  assert.equal(again.outcome.best, 2);
});

test("a player's own best is kept apart from the thread's top results", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  await post(body.id, 12, bo);
  await post(body.id, 4, bo);
  const own = await store.getDoc("challengeResults", `${body.id}_u-bo`);
  assert.equal(own.score, 12);
  assert.equal(own.challenge, body.id);
});

test("open challenges list signed-in players' ones, newest first, by game", async () => {
  challenges.forgetLists();
  const before = (await call("/api/challenges", { method: "GET" })).body
    .challenges.length;
  const guest = await call("/api/challenges", {
    body: { game: "memory", ...round },
  });
  const mine = await call("/api/challenges", {
    body: { game: "memory", ...round, score: 33 },
    ...ada,
  });
  const tester = await call("/api/challenges", {
    body: { game: "memory", ...round },
    claims: { uid: "u-test", name: "Tester1", roles: ["tester"] },
    cookie: "dingn-session=x",
  });
  await post(mine.body.id, 40, bo);
  const { body } = await call("/api/challenges?game=memory", {
    method: "GET",
  });
  const ids = body.challenges.map((c) => c.id);
  assert.equal(ids[0], mine.body.id);
  assert.equal(ids.includes(guest.body.id), false);
  assert.equal(ids.includes(tester.body.id), false);
  assert.deepEqual(body.challenges[0], {
    game: "memory",
    id: mine.body.id,
    mode: "ladder",
    score: 33,
    unit: "digits",
    name: "Ada",
    players: 2,
    top: { name: "Bo", score: 40 },
    results: [
      { name: "Bo", score: 40 },
      { name: "Ada", score: 33 },
    ],
    createdAt: body.challenges[0].createdAt,
  });
  const all = (await call("/api/challenges", { method: "GET" })).body;
  assert.equal(all.challenges.length, before + 1);
  const none = await call("/api/challenges?game=nope", { method: "GET" });
  assert.deepEqual(none.body.challenges, []);
  // A game outside the catalog lists nothing.
  await registry.updateRecord("memory", (r) => ({ ...r, status: "unlisted" }));
  registry.clearRegistryCache();
  challenges.forgetLists();
  const hidden = await call("/api/challenges", { method: "GET" });
  assert.deepEqual(hidden.body.challenges, []);
  await registry.updateRecord("memory", (r) => ({ ...r, status: "listed" }));
  registry.clearRegistryCache();
  assert.ok(body.challenges.length <= challenges.MAX_LISTED);
  // A line saved before lists carried results still shows them.
  await store.updateDoc("challengeBoards", "memory", (board) => ({
    threads: board.threads.map(({ results: _results, ...thread }) => thread),
  }));
  challenges.forgetLists();
  const old = await call("/api/challenges?game=memory", { method: "GET" });
  assert.deepEqual(old.body.challenges[0].results, [
    { name: "Bo", score: 40 },
    { name: "Ada", score: 33 },
  ]);
});

test("its maker closes a challenge: it stays readable, takes no results and leaves the list", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  await post(body.id, 12, bo);
  const end = (how, who = {}) => call(`/api/challenges/${body.id}/${how}`, who);
  // Only its maker, signed in.
  assert.equal((await end("close")).status, 401);
  assert.equal((await end("close", bo)).status, 403);
  assert.deepEqual((await end("close", ada)).body, { closed: true });
  assert.deepEqual((await end("close", ada)).body, { closed: true });

  const thread = (await open(body.id)).body;
  assert.equal(thread.closed, true);
  assert.equal(thread.results.length, 2);
  assert.equal((await post(body.id, 50, bo)).status, 409);
  assert.equal((await open(body.id)).body.results[0].score, 12);
  const listed = await call("/api/challenges?game=memory", { method: "GET" });
  assert.equal(
    listed.body.challenges.some((c) => c.id === body.id),
    false,
  );
});

test("its maker deletes a challenge: it is kept but nothing shows it", async () => {
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  const remove = (who = {}) => call(`/api/challenges/${body.id}/delete`, who);
  assert.equal((await remove(bo)).status, 403);
  assert.deepEqual((await remove(ada)).body, { deleted: true });
  // A soft delete: the record stays on the server.
  const saved = await store.getDoc("challenges", body.id);
  assert.equal(saved.deleted, true);
  assert.ok(Date.parse(saved.deletedAt));
  assert.equal(saved.score, 10);
  assert.equal((await open(body.id)).status, 404);
  assert.equal(await challenges.findChallenge(body.id), null);
  assert.equal((await post(body.id, 50, bo)).status, 404);
  assert.equal((await remove(ada)).status, 404);
  const listed = await call("/api/challenges?game=memory", { method: "GET" });
  assert.equal(
    listed.body.challenges.some((c) => c.id === body.id),
    false,
  );
});

test("an admin can close or delete anyone's challenge, and nobody a guest's", async () => {
  const admin = {
    claims: { uid: "u-admin", name: "Root", roles: ["administrator"] },
    cookie: "dingn-session=x",
  };
  const { body } = await call("/api/challenges", {
    body: { game: "memory", ...round },
    ...ada,
  });
  assert.equal(
    (await call(`/api/challenges/${body.id}/delete`, admin)).status,
    200,
  );
  // (Written straight to the store: the guests' quota is used up above.)
  const guest = { body: { id: "GuestGuest01" } };
  await store.mergeDoc("challenges", guest.body.id, {
    game: "memory",
    ...round,
    uid: null,
    name: null,
    createdAt: new Date().toISOString(),
    public: false,
  });
  assert.equal(
    (await call(`/api/challenges/${guest.body.id}/close`, bo)).status,
    403,
  );
  assert.equal(
    (await call(`/api/challenges/${guest.body.id}/close`, admin)).status,
    200,
  );
});

test("a challenge id names one challenge across dingn, whatever the game", async () => {
  await registry.updateRecord("other", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest({
        id: "other",
        version: "1.0.0",
        title: { en: "Other", zh: "其他" },
      }),
    ),
  );
  registry.clearRegistryCache();
  const first = await call("/api/challenges", {
    body: { game: "memory", ...round, score: 77 },
    ...ada,
  });
  // The next challenge, in another game, draws the same id, then a free one.
  const drawn = [first.body.id, first.body.id, "FreshFresh01"];
  const second = await call("/api/challenges", {
    body: { game: "other", ...round, score: 5 },
    ...bo,
    newId: () => drawn.shift(),
  });
  assert.equal(second.body.id, "FreshFresh01");
  // The first challenge is untouched.
  const kept = await store.getDoc("challenges", first.body.id);
  assert.equal(kept.game, "memory");
  assert.equal(kept.score, 77);
  assert.equal(kept.uid, "u-ada");
  // A deleted challenge keeps its id: nothing new is saved under it.
  await call(`/api/challenges/${first.body.id}/delete`, ada);
  const third = await call("/api/challenges", {
    body: { game: "other", ...round },
    ...bo,
    newId: () => first.body.id,
  });
  assert.equal(third.status, 503);
  assert.equal((await store.getDoc("challenges", first.body.id)).deleted, true);
});
