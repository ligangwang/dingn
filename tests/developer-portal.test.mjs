// Step 3 of the developer platform: self sign-up, limits, review, reports,
// take-down and play counts. Runs against the local registry and store.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, uploads, admin, reports, stats, store, zipLib;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-portal-"));
  process.env.GAMES_LOCAL_DIR = dir;
  process.env.REVIEW_EMAIL = "review@example.com";
  registry = await import("../scripts/game-registry.mjs");
  uploads = await import("../scripts/developer-games.mjs");
  admin = await import("../scripts/games-admin.mjs");
  reports = await import("../scripts/game-reports.mjs");
  stats = await import("../scripts/game-stats.mjs");
  store = await import("../scripts/platform-store.mjs");
  zipLib = await import("../scripts/zip.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

const origin = "http://127.0.0.1:3001";
function request(pathname, body, type = "application/json") {
  return Object.assign(
    Readable.from([Buffer.isBuffer(body) ? body : JSON.stringify(body ?? {})]),
    {
      method: "POST",
      url: pathname,
      headers: { origin, "x-dingn-request": "1", "content-type": type },
      socket: { remoteAddress: "127.0.0.1" },
    },
  );
}
function response(resolve) {
  let status = 0;
  return {
    setHeader() {},
    writeHead: (s) => (status = s),
    end: (b) => resolve({ status, body: b ? JSON.parse(b) : null }),
  };
}
const developerCall = (pathname, body, claims, extra = {}) =>
  new Promise((resolve) =>
    uploads.handleDeveloperGames(
      request(
        pathname,
        body,
        Buffer.isBuffer(body) ? "application/zip" : "application/json",
      ),
      response(resolve),
      pathname,
      { verify: async () => claims, exchange: async () => "t", ...extra },
    ),
  );
const adminCall = (pathname, body) =>
  new Promise((resolve) =>
    admin.handleAdminGames(
      request(pathname, body),
      response(resolve),
      pathname,
      {
        verify: async () => ({ uid: "boss", admin: true }),
        exchange: async () => "t",
      },
    ),
  );
const gameZip = (id, version) =>
  zipLib.zip({
    "game.json": Buffer.from(
      JSON.stringify({ id, version, title: { en: "Moon Run", zh: "月跑" } }),
    ),
    "index.html": Buffer.from("<p>run</p>"),
  });
const mail = async () =>
  Object.values(
    JSON.parse(await readFile(path.join(dir, "store", "mail.json"), "utf8")),
  );

test("anyone with a verified email signs up by accepting the agreement", async () => {
  const claims = { kim: {}, max: { developerBlocked: true } };
  const users = {
    async getUser(uid) {
      return { uid, customClaims: claims[uid] ?? {} };
    },
    async setCustomUserClaims(uid, value) {
      claims[uid] = value;
    },
  };
  const join = (who, body) =>
    developerCall("/api/developer/join", body, who, { users });
  const kim = { uid: "kim", email: "kim@example.com", email_verified: true };
  const agree = { agree: true, agreement: uploads.AGREEMENT_VERSION };

  const before = await developerCall("/api/developer/games", {}, kim);
  assert.equal(before.body.developer, false);
  assert.equal(before.body.agreement, uploads.AGREEMENT_VERSION);
  assert.equal(
    (await join(kim, { agree: true, agreement: "old" })).body.error,
    "agreement-required",
  );
  assert.equal(
    (await join({ ...kim, email_verified: false }, agree)).body.error,
    "email-not-verified",
  );
  assert.equal(
    (
      await join(
        {
          uid: "max",
          email: "max@example.com",
          email_verified: true,
          developerBlocked: true,
        },
        agree,
      )
    ).body.error,
    "developer-blocked",
  );
  const joined = await join(kim, agree);
  assert.equal(joined.status, 200);
  assert.deepEqual(claims.kim, { developer: true });
  const record = await store.getDoc("developers", "kim");
  assert.equal(record.agreement, uploads.AGREEMENT_VERSION);
  assert.equal(record.email, "kim@example.com");
});

test("developers can own up to 10 games and upload 20 versions a day", () => {
  const dev = { uid: "kim" };
  const manifest = { id: "newgame", version: "1.0.0" };
  const games = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `g${i}`,
      owner: "kim",
      versions: {},
    }));
  assert.doesNotThrow(() => uploads.checkLimits(games(9), manifest, dev));
  assert.throws(
    () => uploads.checkLimits(games(10), manifest, dev),
    /too-many-games/,
  );
  // A new version of a game they already own is not a new game.
  assert.doesNotThrow(() =>
    uploads.checkLimits(games(10), { id: "g3", version: "2.0.0" }, dev),
  );
  const now = Date.parse("2026-11-09T12:00:00Z");
  const busy = {
    id: "g0",
    owner: "kim",
    versions: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [
        `1.0.${i}`,
        {
          uploadedBy: "kim",
          publishedAt: new Date(now - i * 60_000).toISOString(),
        },
      ]),
    ),
  };
  assert.throws(
    () => uploads.checkLimits([busy], { id: "g0", version: "2.0.0" }, dev, now),
    /upload-limit/,
  );
  assert.doesNotThrow(() =>
    uploads.checkLimits(
      [busy],
      { id: "g0", version: "2.0.0" },
      dev,
      now + 86_400_000,
    ),
  );
});

test("uploads wait in the review queue, and the developer hears the result", async () => {
  const kim = { uid: "kim", email: "kim@example.com", developer: true };
  const first = await developerCall(
    "/api/developer/games/upload",
    gameZip("moonrun", "1.0.0"),
    kim,
  );
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.ok(
    (await mail()).some(
      (m) =>
        m.to.includes("review@example.com") &&
        /waiting for review/.test(m.message.subject),
    ),
  );

  // Sent back with a reason: no longer the beta, and the developer sees why.
  assert.equal(
    (
      await adminCall("/api/admin/games/update", {
        id: "moonrun",
        action: "reject",
        version: "1.0.0",
      })
    ).body.error,
    "reason-required",
  );
  const rejected = await adminCall("/api/admin/games/update", {
    id: "moonrun",
    action: "reject",
    version: "1.0.0",
    reason: "The game does not start on phones.",
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.game.beta, null);
  assert.equal(
    rejected.body.game.versions[0].rejected,
    "The game does not start on phones.",
  );
  assert.ok(
    (await mail()).some(
      (m) =>
        m.to.includes("kim@example.com") &&
        /needs changes/.test(m.message.subject),
    ),
  );
  const mine = await developerCall("/api/developer/games", {}, kim);
  assert.equal(
    mine.body.games[0].versions[0].rejected,
    "The game does not start on phones.",
  );

  await developerCall(
    "/api/developer/games/upload",
    gameZip("moonrun", "1.0.1"),
    kim,
  );
  const live = await adminCall("/api/admin/games/update", {
    id: "moonrun",
    action: "set-live",
    version: "1.0.1",
  });
  assert.equal(live.body.game.live, "1.0.1");
  assert.ok(
    (await mail()).some(
      (m) =>
        m.to.includes("kim@example.com") && /is live/.test(m.message.subject),
    ),
  );
  // A live version cannot be sent back.
  assert.equal(
    (
      await adminCall("/api/admin/games/update", {
        id: "moonrun",
        action: "reject",
        version: "1.0.1",
        reason: "x",
      })
    ).body.error,
    "version-is-live",
  );
});

function get(pathname) {
  return new Promise((resolve) => {
    const req = Object.assign(new EventEmitter(), {
      method: "GET",
      url: pathname,
      headers: {},
    });
    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writeHead(status) {
        this.status = status;
      },
      write() {
        return true;
      },
      end(body) {
        this.body = body;
        resolve(this);
      },
    });
    void registry.handleGames(req, res, pathname);
  });
}

test("players report a game, and admins take it down everywhere", async () => {
  const report = (body, claims = { uid: "pat", email: "pat@example.com" }) =>
    new Promise((resolve) =>
      reports.handleGameReports(
        request("/api/game-reports", body),
        response(resolve),
        {
          verify: async () => claims,
          exchange: async () => "t",
        },
      ),
    );
  assert.equal(
    (await report({ id: "moonrun", version: "1.0.1", reason: "nope" })).status,
    400,
  );
  assert.equal(
    (await report({ id: "moonrun", version: "1.0.1", reason: "other" })).status,
    400,
  );
  assert.equal(
    (await report({ id: "nogame", version: "1.0.0", reason: "broken" })).status,
    404,
  );
  const sent = await report({
    id: "moonrun",
    version: "1.0.1",
    reason: "unsafe",
    details: "Asks for a password.",
  });
  assert.equal(sent.status, 200);
  assert.ok((await mail()).some((m) => /was reported/.test(m.message.subject)));

  const open = await adminCall("/api/admin/reports", {});
  assert.equal(open.body.reports.length, 1);
  assert.equal(open.body.reports[0].details, "Asks for a password.");
  assert.equal(open.body.reports[0].reporter, "pat@example.com");

  assert.equal((await get("/g/moonrun/1.0.1/index.html")).status, 200);
  const down = await adminCall("/api/admin/games/update", {
    id: "moonrun",
    action: "take-down",
    reason: "It asks players for passwords.",
  });
  assert.equal(down.body.game.status, "removed");
  assert.equal((await get("/api/games/moonrun")).status, 404);
  assert.equal((await get("/g/moonrun/1.0.1/index.html")).status, 404);
  assert.ok(
    (await mail()).some(
      (m) =>
        m.to.includes("kim@example.com") &&
        /taken down/.test(m.message.subject),
    ),
  );
  // Nothing else changes a removed game, and its developer cannot upload to it.
  assert.equal(
    (
      await adminCall("/api/admin/games/update", {
        id: "moonrun",
        action: "list",
      })
    ).body.error,
    "game-removed",
  );
  const kim = { uid: "kim", email: "kim@example.com", developer: true };
  assert.equal(
    (
      await developerCall(
        "/api/developer/games/upload",
        gameZip("moonrun", "1.0.2"),
        kim,
      )
    ).body.error,
    "game-removed",
  );

  await adminCall("/api/admin/reports/update", {
    id: open.body.reports[0].id,
    action: "resolve",
  });
  assert.deepEqual(
    (await adminCall("/api/admin/reports", {})).body.reports,
    [],
  );

  const restored = await adminCall("/api/admin/games/update", {
    id: "moonrun",
    action: "restore",
  });
  assert.equal(restored.body.game.status, "unlisted");
  assert.equal((await get("/api/games/moonrun")).status, 200);
});

test("plays are counted per day and shown to the game's developer", async () => {
  const play = (body) =>
    new Promise((resolve) =>
      stats.handleGamePlays(
        request("/api/game-plays", body),
        response(resolve),
      ),
    );
  assert.equal((await play({ id: "nogame" })).status, 404);
  assert.equal((await play({ id: "Bad!" })).status, 400);
  for (let i = 0; i < 3; i++)
    assert.equal((await play({ id: "moonrun" })).status, 200);
  await stats.flushPlays();
  await stats.flushPlays();
  const kim = { uid: "kim", email: "kim@example.com", developer: true };
  const mine = await developerCall("/api/developer/games", {}, kim);
  assert.deepEqual(mine.body.games[0].plays, { total: 3, week: 3, month: 3 });
  const all = await adminCall("/api/admin/games", {});
  assert.deepEqual(all.body.games.find((g) => g.id === "moonrun").plays, {
    total: 3,
    week: 3,
    month: 3,
  });

  const now = new Date("2026-11-09T12:00:00Z");
  assert.deepEqual(
    stats.summarize(
      {
        total: 9,
        days: {
          "2026-11-09": 1,
          "2026-11-03": 2,
          "2026-11-02": 4,
          "2026-09-01": 2,
        },
      },
      now,
    ),
    { total: 9, week: 3, month: 7 },
  );
});

test("the agreement page shows the version that sign-up records", async () => {
  const page = await readFile(
    path.join(import.meta.dirname, "../src/components/developer-agreement.tsx"),
    "utf8",
  );
  assert.match(
    page,
    new RegExp(`AGREEMENT_VERSION = "${uploads.AGREEMENT_VERSION}"`),
  );
});
