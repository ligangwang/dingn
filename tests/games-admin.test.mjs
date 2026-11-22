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

  // Taking a pinned game down unpins it, and a pin left on a taken-down game
  // (from before that rule) never blocks featuring another.
  await feature("gems");
  await call("/api/admin/games/update", {
    id: "gems",
    action: "take-down",
    reason: "Broken",
  });
  assert.equal((await featured()).gems, false);
  await registry.updateRecord("gems", (r) => ({
    ...r,
    featuredAt: "2026-01-01T00:00:00Z",
  }));
  assert.equal((await feature("pets")).status, 200);
  assert.deepEqual(
    [(await featured()).gems, (await featured()).pets],
    [false, true],
  );

  // The home page features one game, from any category.
  const onHome = async () =>
    (await registry.listRecords()).filter((r) => r.homeAt).map((r) => r.id);
  assert.equal((await feature("hidden", "feature-home")).status, 400);
  const pets = await feature("pets", "feature-home");
  assert.equal(pets.status, 200);
  assert.ok(pets.body.game.homeAt);
  assert.deepEqual(await onHome(), ["pets"]);
  await feature("cube", "feature-home");
  assert.deepEqual(await onHome(), ["cube"]);
  registry.clearRegistryCache();
  const listed = registry.catalog(await registry.listRecords());
  assert.ok(listed.find((g) => g.id === "cube").homeAt);
  assert.equal(listed.find((g) => g.id === "pets").homeAt, null);
  await feature("cube", "unfeature-home");
  assert.deepEqual(await onHome(), []);
  // Taking the home page's game down takes it off the home page.
  await feature("pets", "feature-home");
  await call("/api/admin/games/update", {
    id: "pets",
    action: "take-down",
    reason: "Broken",
  });
  assert.deepEqual(await onHome(), []);
});

test("a review key can list games and approve or reject, and nothing else", async () => {
  const manifest = (version) =>
    registry.validateManifest({
      id: "jewels",
      version,
      title: { en: "Jewels", zh: "珠宝" },
    });
  await registry.updateRecord("jewels", (r) =>
    registry.addVersion(r, manifest("1.0.0")),
  );
  await registry.updateRecord("jewels", (r) =>
    registry.addVersion(r, manifest("1.1.0"), { channel: "beta" }),
  );
  await registry.updateRecord("jewels", (r) =>
    registry.addVersion(r, manifest("1.2.0"), { channel: "beta" }),
  );

  // The admin's account, as the Admin SDK reports it on each keyed call.
  let accountClaims = { admin: true };
  const users = {
    async getUser(uid) {
      return { uid, email: "boss@example.com", customClaims: accountClaims };
    },
  };
  const session = { claims: { admin: true, uid: "boss" } };
  const created = await call(
    "/api/admin/keys",
    { action: "create", name: "Claude" },
    session,
  );
  assert.equal(created.status, 200);
  const key = created.body.key;
  assert.match(key, /^dak\.boss\.[0-9a-f]{12}\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(
    created.body.keys.map((k) => k.name),
    ["Claude"],
  );
  assert.equal(created.body.keys[0].hash, undefined);

  // A script sends the key with no website origin and no session.
  const keyed = (pathname, body, authorization = `Bearer ${key}`) => {
    const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
      method: "POST",
      url: pathname,
      headers: { authorization, "content-type": "application/json" },
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
        verify: async () => {
          throw new Error("a keyed call must not use the session");
        },
        exchange: async () => {
          throw new Error("a keyed call must not use the session");
        },
        users,
      });
    });
  };

  const list = await keyed("/api/admin/games");
  assert.equal(list.status, 200);
  assert.ok(list.body.games.some((g) => g.id === "jewels"));

  const approved = await keyed("/api/admin/games/update", {
    id: "jewels",
    action: "set-live",
    version: "1.1.0",
  });
  assert.equal(approved.status, 200);
  assert.equal((await registry.getRecord("jewels")).live, "1.1.0");

  const rejected = await keyed("/api/admin/games/update", {
    id: "jewels",
    action: "reject",
    version: "1.2.0",
    reason: "The board is blank on phones.",
  });
  assert.equal(rejected.status, 200);
  assert.equal(
    (await registry.getRecord("jewels")).versions["1.2.0"].rejectReason,
    "The board is blank on phones.",
  );

  // Everything else stays with a signed-in admin on the website.
  const before = await registry.getRecord("jewels");
  for (const [pathname, body] of [
    [
      "/api/admin/games/update",
      { id: "jewels", action: "take-down", reason: "x" },
    ],
    ["/api/admin/games/update", { id: "jewels", action: "unlist" }],
    [
      "/api/admin/games/update",
      { id: "jewels", action: "set-beta", version: "1.0.0" },
    ],
    [
      "/api/admin/games/update",
      { id: "jewels", action: "transfer", email: "a@b.c" },
    ],
    ["/api/admin/keys", { action: "create", name: "more" }],
    ["/api/admin/admins/update", { action: "add", email: "a@b.c" }],
    ["/api/admin/settings/update", { leaderboardPublic: true }],
    ["/api/admin/testers", {}],
    ["/api/admin/testers/update", { action: "create", email: "a@b.c" }],
    ["/api/admin/testers/update", { action: "password", uid: "boss" }],
  ]) {
    const refused = await keyed(pathname, body);
    assert.equal(refused.status, 403, `${pathname} ${body.action ?? ""}`);
    assert.equal(refused.body.error, "not-allowed-with-key");
  }
  const after = await registry.getRecord("jewels");
  assert.equal(after.status, before.status);
  assert.equal(after.beta, before.beta);
  assert.equal(after.owner, before.owner);

  // A wrong secret, a made-up key and an upload key are all refused.
  const [, uid, id] = key.split(".");
  assert.equal(
    (await keyed("/api/admin/games", {}, `Bearer dak.${uid}.${id}.wrong`))
      .status,
    401,
  );
  assert.equal(
    (await keyed("/api/admin/games", {}, "Bearer dak.nobody.abc.def")).status,
    401,
  );
  assert.equal(
    (await keyed("/api/admin/games", {}, `Bearer dgk.${uid}.${id}.x`)).status,
    403,
  );

  // An account that is no longer an admin cannot use its keys.
  accountClaims = { developer: true };
  assert.equal((await keyed("/api/admin/games")).status, 403);
  accountClaims = { admin: true };
  assert.equal((await keyed("/api/admin/games")).status, 200);

  // The key list shows when it was last used, and revoking stops it.
  const listed = await call("/api/admin/keys", { action: "list" }, session);
  assert.ok(listed.body.keys[0].lastUsedAt);
  const revoked = await call(
    "/api/admin/keys",
    { action: "revoke", id: listed.body.keys[0].id },
    session,
  );
  assert.deepEqual(revoked.body.keys, []);
  assert.equal((await keyed("/api/admin/games")).status, 401);
});

test("only a signed-in admin on the website reaches the test accounts API", async () => {
  // Firebase Auth must never be touched by a refused request.
  const users = new Proxy(
    {},
    {
      get: () => () => {
        throw new Error("refused requests must not reach Firebase Auth");
      },
    },
  );
  const request = (
    pathname,
    body,
    {
      claims = { admin: true, uid: "boss" },
      headers = {},
      method = "POST",
      signedIn = true,
    } = {},
  ) => {
    const req = Object.assign(Readable.from([JSON.stringify(body)]), {
      method,
      url: pathname,
      headers: {
        origin,
        "x-dingn-request": "1",
        "content-type": "application/json",
        ...headers,
      },
    });
    return new Promise((resolve) => {
      let status = 0;
      let cache = "";
      const res = {
        setHeader() {},
        getHeader() {},
        writeHead: (s, h) => {
          status = s;
          cache = h?.["Cache-Control"] ?? "";
        },
        end: (b) => resolve({ status, cache, body: b ? JSON.parse(b) : null }),
      };
      void admin.handleAdminGames(req, res, pathname, {
        verify: async () => claims,
        exchange: async () => {
          if (!signedIn) {
            const { ApiError } = await import("../scripts/api.mjs");
            throw new ApiError(401, "sign-in-required");
          }
          return "id-token";
        },
        users,
      });
    });
  };
  const create = { action: "create", email: "qa@example.com", count: 5 };
  for (const pathname of ["/api/admin/testers", "/api/admin/testers/update"]) {
    // Signed out.
    assert.equal(
      (await request(pathname, create, { signedIn: false })).status,
      401,
    );
    // Signed in, not an admin (a test account included).
    for (const claims of [{ uid: "u" }, { uid: "qa", tester: true }]) {
      const refused = await request(pathname, create, { claims });
      assert.equal(refused.status, 403);
      assert.equal(refused.body.error, "admin-required");
    }
    // Another site, a missing header, or not a POST.
    assert.equal(
      (
        await request(pathname, create, {
          headers: { origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(pathname, create, { headers: { "x-dingn-request": "" } }))
        .status,
      403,
    );
    assert.equal(
      (await request(pathname, create, { method: "GET" })).status,
      405,
    );
  }
  // An admin gets through to Firebase Auth (which this stand-in refuses),
  // and the reply is never cached.
  const allowed = await request("/api/admin/testers", {});
  assert.equal(allowed.status, 503);
  assert.equal(allowed.cache, "no-store");
});
