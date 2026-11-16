// The growth funnel: anonymous counts by source, added up per day and read
// back by admins.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, funnel, store;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-funnel-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  funnel = await import("../scripts/funnel.mjs");
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

function call(pathname, body, claims = { uid: "a", admin: true }) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method: "POST",
    url: pathname,
    headers: {
      origin: "http://127.0.0.1:3001",
      "x-dingn-request": "1",
      "content-type": "application/json",
    },
    socket: { remoteAddress: "127.0.0.1" },
  });
  return new Promise((resolve) => {
    let status = 0;
    funnel.handleFunnel(
      req,
      {
        writeHead: (s) => (status = s),
        end: (b) => resolve({ status, body: JSON.parse(b) }),
      },
      pathname,
      { verify: async () => claims, exchange: async () => "t" },
    );
  });
}

test("reports are checked before they count", () => {
  assert.deepEqual(
    funnel.checkReport({ event: "visit", source: "google", new: true }),
    {
      event: "visit",
      source: "google",
      new: true,
      returning: false,
      returner: false,
      referred: false,
    },
  );
  assert.deepEqual(
    funnel.checkReport({ event: "start", source: "x", game: "memory", n: 9 }),
    { event: "start", source: "x", game: "memory" },
  );
  for (const bad of [
    null,
    { event: "visit" },
    { event: "visit", source: "Google.com" },
    { event: "visit", source: "__name__" },
    { event: "visit", source: "a", new: "yes" },
    { event: "buy", source: "a", game: "memory" },
    { event: "start", source: "a" },
    { event: "start", source: "a", game: "../x" },
  ])
    assert.throws(() => funnel.checkReport(bad), JSON.stringify(bad));
});

test("each report adds to its source, and game events to the game too", () => {
  assert.deepEqual(
    funnel.countsFor({
      event: "visit",
      source: "challenge",
      new: true,
      returning: false,
      returner: false,
      referred: true,
    }),
    {
      "sources.challenge.visitors": 1,
      "sources.challenge.new": 1,
      "sources.challenge.referred": 1,
    },
  );
  assert.deepEqual(
    funnel.countsFor({ event: "finish", source: "direct", game: "memory" }),
    { "sources.direct.finishes": 1, "games.memory.finishes": 1 },
  );
});

test("days add up by source and game, with a total", () => {
  const sum = funnel.sumFunnel([
    {
      sources: { google: { visitors: 2, new: 2, starts: 1 } },
      games: { memory: { starts: 1 } },
    },
    null,
    {
      sources: { google: { visitors: 1, returning: 1, returners: 1 } },
    },
  ]);
  assert.equal(sum.sources.google.visitors, 3);
  assert.equal(sum.sources.google.returners, 1);
  assert.equal(sum.sources.google.shares, 0);
  assert.equal(sum.games.memory.starts, 1);
  assert.equal(sum.total.visitors, 3);
  assert.deepEqual(funnel.lastDays(3, new Date("2026-11-16T05:00:00Z")), [
    "2026-11-16",
    "2026-11-15",
    "2026-11-14",
  ]);
});

test("reports are saved by day and only admins can read them", async () => {
  assert.equal(
    (await call("/api/funnel", { event: "visit", source: "tiktok", new: true }))
      .status,
    200,
  );
  assert.equal(
    (
      await call("/api/funnel", {
        event: "start",
        source: "tiktok",
        game: "memory",
      })
    ).status,
    200,
  );
  // Made-up games don't count.
  assert.equal(
    (
      await call("/api/funnel", {
        event: "start",
        source: "tiktok",
        game: "nosuchgame",
      })
    ).status,
    404,
  );
  assert.equal(
    (await call("/api/admin/funnel", { days: 7 }, { uid: "b" })).status,
    403,
  );
  const { status, body } = await call("/api/admin/funnel", { days: 7 });
  assert.equal(status, 200);
  assert.equal(body.days, 7);
  assert.equal(body.sources.tiktok.visitors, 1);
  assert.equal(body.sources.tiktok.new, 1);
  assert.equal(body.sources.tiktok.starts, 1);
  assert.equal(body.games.memory.starts, 1);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(
    (await store.getDoc("funnelStats", today)).sources.tiktok.visitors,
    1,
  );
});

test("a big day is saved in writes Firestore accepts", async () => {
  // 453 fields, so more than one write.
  const date = "2030-01-01";
  const now = new Date(`${date}T12:00:00Z`);
  for (let i = 0; i < 150; i++)
    for (const event of ["start", "finish", "share"])
      funnel.recordReport({ event, source: `s${i}`, game: "memory" }, now);
  await funnel.flushFunnel();
  const doc = await store.getDoc("funnelStats", date);
  assert.equal(Object.keys(doc.sources).length, 150);
  assert.equal(doc.games.memory.starts, 150);
  assert.equal(doc.sources.s149.shares, 1);
  assert.ok(funnel.MAX_FIELDS_PER_WRITE < 453);
});
