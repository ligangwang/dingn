import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-games-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

const manifest = (version, extra = {}) => ({
  id: "hello",
  version,
  title: { en: "Star Tap", zh: "点星星" },
  ...extra,
});

function call(pathname, method = "GET") {
  const req = Object.assign(new EventEmitter(), {
    method,
    url: pathname,
    headers: {},
  });
  return new Promise((resolve) => {
    const chunks = [];
    const res = new (class extends EventEmitter {
      headersSent = false;
      writeHead(status, headers = {}) {
        this.status = status;
        this.headers = headers;
        this.headersSent = true;
      }
      write(chunk) {
        chunks.push(Buffer.from(chunk));
        return true;
      }
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        resolve({
          status: this.status,
          headers: this.headers,
          body: Buffer.concat(chunks).toString(),
        });
      }
    })();
    void registry.handleGames(req, res, new URL(pathname, "http://x").pathname);
  });
}

test("game.json is checked before anything is published", () => {
  assert.equal(
    registry.validateManifest(manifest("1.0.0")).entry,
    "index.html",
  );
  for (const bad of [
    manifest("1.0"),
    { ...manifest("1.0.0"), id: "Bad-Id" },
    { ...manifest("1.0.0"), title: { en: "Only English" } },
    { ...manifest("1.0.0"), entry: "../site/index.html" },
  ])
    assert.throws(() => registry.validateManifest(bad), /game.json is invalid/);
});

test("published versions never change and channels only point at published ones", () => {
  const m = registry.validateManifest(manifest("1.0.0"));
  const one = registry.addVersion(null, m);
  assert.equal(one.live, "1.0.0");
  assert.equal(one.status, "unlisted");
  assert.throws(() => registry.addVersion(one, m), /already published/);
  const beta = registry.addVersion(
    one,
    registry.validateManifest(manifest("1.1.0")),
    { channel: "beta" },
  );
  assert.deepEqual([beta.live, beta.beta], ["1.0.0", "1.1.0"]);
  assert.equal(registry.pointChannel(beta, "1.1.0").live, "1.1.0");
  assert.throws(() => registry.pointChannel(beta, "9.9.9"), /never published/);
  assert.ok(registry.compareVersions("1.10.0", "1.9.3") > 0);
});

test("paths outside a game's own version folder are refused", () => {
  assert.deepEqual(registry.parseGamePath("/g/hello/1.0.0/assets/a.png"), {
    id: "hello",
    version: "1.0.0",
    file: "assets/a.png",
  });
  for (const bad of [
    "/g/hello/1.0.0/../../registry.json",
    "/g/hello/1.0.0/%2e%2e/x",
    "/g/hello/1.0.0/.env",
    "/g/hello/latest/index.html",
    "/g/HELLO/1.0.0/index.html",
    "/g/hello/1.0.0/a%5Cb",
  ])
    assert.equal(registry.parseGamePath(bad), null, bad);
});

test("the API serves the live, beta or a pinned version, and the sandboxed files", async () => {
  await registry.updateRecord("hello", (r) =>
    registry.addVersion(r, registry.validateManifest(manifest("1.0.0"))),
  );
  await registry.updateRecord("hello", (r) =>
    registry.addVersion(r, registry.validateManifest(manifest("1.1.0")), {
      channel: "beta",
    }),
  );
  const files = path.join(dir, "games", "hello", "1.0.0");
  await mkdir(files, { recursive: true });
  await writeFile(path.join(files, "index.html"), "<p>hi</p>");
  registry.clearRegistryCache();

  const live = await call("/api/games/hello");
  assert.equal(live.status, 200);
  assert.equal(JSON.parse(live.body).url, "/g/hello/1.0.0/index.html");
  assert.equal(
    JSON.parse((await call("/api/games/hello?v=beta")).body).version,
    "1.1.0",
  );
  assert.equal(
    JSON.parse((await call("/api/games/hello?v=1.0.0")).body).version,
    "1.0.0",
  );
  assert.equal((await call("/api/games/hello?v=3.0.0")).status, 404);
  assert.equal((await call("/api/games/nope")).status, 404);
  assert.equal((await call("/api/games/hello", "POST")).status, 405);
  // Unlisted games play by URL but stay out of the catalog.
  assert.deepEqual(JSON.parse((await call("/api/games")).body).games, []);

  const page = await call("/g/hello/1.0.0/index.html");
  assert.equal(page.status, 200);
  assert.equal(page.body, "<p>hi</p>");
  assert.match(
    page.headers["Content-Security-Policy"],
    /^sandbox allow-scripts/,
  );
  assert.doesNotMatch(
    page.headers["Content-Security-Policy"],
    /allow-same-origin/,
  );
  // Pages are rechecked (a direct visit redirects to the player); every
  // other published file never changes.
  assert.equal(page.headers["Cache-Control"], "no-cache");
  assert.equal(page.headers.Vary, "Sec-Fetch-Dest");
  await writeFile(path.join(files, "main.js"), "1");
  assert.match(
    (await call("/g/hello/1.0.0/main.js")).headers["Cache-Control"],
    /immutable/,
  );
  assert.equal((await call("/g/hello/1.0.0/missing.js")).status, 404);
  assert.equal((await call("/g/hello/1.0.0/../../registry.json")).status, 404);
});

test("game.json names a category and a cover for the catalog", () => {
  const m = registry.validateManifest(
    manifest("1.0.0", { category: "puzzle", cover: "art/cover.webp" }),
  );
  assert.equal(m.category, "puzzle");
  assert.equal(m.cover, "art/cover.webp");
  for (const bad of [
    { category: "racing" },
    { cover: "../cover.png" },
    { cover: "cover.exe" },
    { cover: 3 },
  ])
    assert.throws(
      () => registry.validateManifest(manifest("1.0.0", bad)),
      /category|cover/,
    );
  const record = registry.addVersion(null, m, { listed: true });
  const game = registry.publicGame(record);
  assert.equal(game.category, "puzzle");
  assert.equal(game.cover, "/g/hello/1.0.0/art/cover.webp");
  assert.equal(game.addedAt, record.versions["1.0.0"].publishedAt);
  // A game that names no category is casual; dingn's older games keep theirs.
  const plain = registry.addVersion(
    null,
    registry.validateManifest(manifest("1.0.0")),
  );
  assert.equal(registry.publicGame(plain).category, "casual");
  assert.equal(registry.publicGame(plain).cover, null);
  assert.equal(
    registry.publicGame({ ...plain, id: "rubikscube" }).category,
    "puzzle",
  );
  // Adventure is a category of its own.
  const quest = registry.validateManifest(
    manifest("1.0.0", { category: "adventure", cover: "cover.jpg" }),
  );
  assert.equal(
    registry.publicGame(registry.addVersion(null, quest, { listed: true }))
      .category,
    "adventure",
  );
});

test("the catalog lists approved, listed games with their recent plays", () => {
  const now = "2026-11-01T00:00:00.000Z";
  const mine = registry.addVersion(
    null,
    registry.validateManifest(manifest("1.0.0")),
    { listed: true, now },
  );
  const hidden = { ...mine, id: "hidden", status: "unlisted" };
  // An outside developer's game never approved stays out.
  const preview = { ...mine, id: "preview", owner: "dev1" };
  const approved = {
    ...preview,
    id: "approved",
    versions: {
      "1.0.0": {
        ...mine.versions["1.0.0"],
        reviewedAt: "2026-11-10T00:00:00.000Z",
      },
    },
  };
  const games = registry.catalog([mine, hidden, preview, approved], {
    hello: { week: 4, month: 9, total: 20 },
  });
  assert.deepEqual(
    games.map((g) => [g.id, g.plays, g.addedAt]),
    [
      ["hello", { week: 4, month: 9 }, now],
      ["approved", { week: 0, month: 0 }, "2026-11-10T00:00:00.000Z"],
    ],
  );
});
