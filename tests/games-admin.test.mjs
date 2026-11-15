import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, admin, registry;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-games-admin-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  admin = await import("../scripts/games-admin.mjs");
  const manifest = (version) =>
    registry.validateManifest({
      id: "crowd",
      version,
      title: { en: "Crowd Rush", zh: "人潮突击" },
    });
  await registry.updateRecord("crowd", (r) =>
    registry.addVersion(r, manifest("1.0.0")),
  );
  await registry.updateRecord("crowd", (r) =>
    registry.addVersion(r, manifest("1.1.0"), { channel: "beta" }),
  );
});
after(() => rm(dir, { recursive: true, force: true }));

const origin = "http://127.0.0.1:3001";
function call(
  pathname,
  body,
  { claims = { admin: true }, headers = {}, method = "POST" } = {},
) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method,
    url: pathname,
    headers: {
      origin,
      "x-dingn-request": "1",
      "content-type": "application/json",
      cookie: "__session=refresh-token",
      ...headers,
    },
  });
  return new Promise((resolve) => {
    let status = 0;
    const res = {
      setHeader() {},
      getHeader() {},
      writeHead: (s) => (status = s),
      end: (b) => resolve({ status, body: b ? JSON.parse(b) : null }),
    };
    void admin.handleAdminGames(req, res, pathname, {
      verify: async () => claims,
      exchange: async () => "id-token",
    });
  });
}

test("admin changes: release, rollback, beta and catalog listing", () => {
  const record = {
    id: "crowd",
    status: "unlisted",
    live: "1.0.0",
    beta: "1.1.0",
    versions: { "1.0.0": {}, "1.1.0": {} },
  };
  assert.equal(
    admin.applyChange(record, { action: "set-live", version: "1.1.0" }).live,
    "1.1.0",
  );
  assert.equal(admin.applyChange(record, { action: "clear-beta" }).beta, null);
  assert.equal(admin.applyChange(record, { action: "list" }).status, "listed");
  // Approving a game's first live version lists it on its category page;
  // later releases leave the listing as the admin set it.
  const fresh = { ...record, live: null };
  assert.equal(
    admin.applyChange(fresh, { action: "set-live", version: "1.0.0" }).status,
    "listed",
  );
  assert.equal(
    admin.applyChange(record, { action: "set-live", version: "1.1.0" }).status,
    "unlisted",
  );
  for (const bad of [
    { action: "set-live", version: "9.9.9" },
    { action: "set-live" },
    { action: "delete" },
  ])
    assert.throws(
      () => admin.applyChange(record, bad),
      /unknown-version|invalid-request/,
    );
  assert.throws(() => admin.applyChange(null, { action: "list" }), /not-found/);
});

test("only admins, from the website, can see and change games", async () => {
  assert.equal(
    (await call("/api/admin/games", {}, { claims: { uid: "u" } })).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/admin/games",
        {},
        { headers: { origin: "https://evil.example" } },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/admin/games", {}, { method: "GET" })).status,
    405,
  );

  const list = await call("/api/admin/games");
  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.games[0].versions.map((v) => v.version),
    ["1.1.0", "1.0.0"],
  );

  const released = await call("/api/admin/games/update", {
    id: "crowd",
    action: "set-live",
    version: "1.1.0",
  });
  assert.equal(released.status, 200);
  assert.equal(released.body.game.live, "1.1.0");
  assert.equal((await registry.getRecord("crowd")).live, "1.1.0");

  const rolledBack = await call("/api/admin/games/update", {
    id: "crowd",
    action: "set-live",
    version: "1.0.0",
  });
  assert.equal(rolledBack.body.game.live, "1.0.0");

  assert.equal(
    (
      await call("/api/admin/games/update", {
        id: "crowd",
        action: "set-live",
        version: "7.0.0",
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/admin/games/update", { id: "nope", action: "list" }))
      .status,
    404,
  );
  assert.equal(
    (await call("/api/admin/games/update", { id: "../x", action: "list" }))
      .status,
    400,
  );
});

test("an admin pins one game per category to its page's banner", async () => {
  const add = (id, category) =>
    registry.updateRecord(id, (r) =>
      registry.addVersion(
        r,
        registry.validateManifest({
          id,
          version: "1.0.0",
          title: { en: id, zh: id },
          ...(category ? { category } : {}),
        }),
        { listed: true },
      ),
    );
  await add("gems");
  await add("pets");
  await add("cube", "puzzle");
  await add("hidden");
  await registry.updateRecord("hidden", (r) => ({ ...r, status: "unlisted" }));

  const feature = (id, action = "feature") =>
    call("/api/admin/games/update", { id, action });
  assert.equal((await feature("hidden")).status, 400);
  const gems = await feature("gems");
  assert.equal(gems.status, 200);
  assert.equal(gems.body.game.category, "casual");
  assert.ok(gems.body.game.featuredAt);
  await feature("cube");
  // Pets takes over Casual's banner; Puzzle keeps its own.
  await feature("pets");
  const featured = async () =>
    Object.fromEntries(
      (await registry.listRecords()).map((r) => [r.id, !!r.featuredAt]),
    );
  assert.deepEqual(
    Object.entries(await featured())
      .filter(([, on]) => on)
      .map(([id]) => id)
      .sort(),
    ["cube", "pets"],
  );
  registry.clearRegistryCache();
  const catalog = registry.catalog(await registry.listRecords());
  assert.ok(catalog.find((g) => g.id === "pets").featuredAt);
  assert.equal(catalog.find((g) => g.id === "gems").featuredAt, null);
  await feature("pets", "unfeature");
  assert.equal((await featured()).pets, false);
});
