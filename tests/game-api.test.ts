import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { gameRoutes, handleGameApi } from "../scripts/game-api.mjs";

const origin = "http://127.0.0.1:3001";
function call(
  method: string,
  path: string,
  headers: Record<string, string> = {},
) {
  const req = Object.assign(new EventEmitter(), { method, headers });
  let status = 0,
    body = "";
  const res = {
    setHeader: () => {},
    writeHead: (s: number) => (status = s),
    end: (b: string) => (body = b),
  };
  return handleGameApi(req, res, path).then((handled) => ({
    handled,
    status,
    body: body ? JSON.parse(body) : null,
  }));
}
const json = {
  origin,
  "x-dingn-request": "1",
  "content-type": "application/json",
};

test("XP routes are POST-only, CSRF-checked and need a session", async () => {
  assert.deepEqual(gameRoutes.sort(), [
    "/api/leaderboard",
    "/api/me",
    "/api/me/nickname",
    "/api/play/finish",
    "/api/play/start",
    "/api/player",
  ]);
  assert.equal((await call("GET", "/memory-ladder/")).handled, false);
  assert.equal((await call("POST", "/api/auth/login", json)).handled, false);
  assert.equal((await call("GET", "/api/me", json)).status, 405);
  // Cross-site or header-less requests are refused before anything else.
  assert.equal((await call("POST", "/api/play/finish")).status, 403);
  assert.equal(
    (
      await call("POST", "/api/play/finish", {
        ...json,
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  for (const path of ["/api/play/start", "/api/play/finish", "/api/me"]) {
    const r = await call("POST", path, json);
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "signed_out");
  }
});

test("the runtime image pins the same firebase-admin as development", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = JSON.parse(await readFile("package.json", "utf8"));
  const server = JSON.parse(await readFile("server/package.json", "utf8"));
  assert.equal(
    server.dependencies["firebase-admin"],
    root.dependencies["firebase-admin"],
  );
});

/** A small stand-in for Firestore: documents in a map, transactions in turn. */
function fakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  const snap = (path: string) => ({
    exists: store.has(path),
    data: () => store.get(path),
  });
  const ref = (path: string) => ({ path, get: async () => snap(path) });
  let queue = Promise.resolve();
  const db = {
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
    runTransaction: <T>(fn: (tx: unknown) => Promise<T>) => {
      const run = queue.then(() =>
        fn({
          get: async (r: { path: string }) => snap(r.path),
          set: (r: { path: string }, data: Record<string, unknown>) =>
            store.set(r.path, { ...store.get(r.path), ...data }),
          delete: (r: { path: string }) => store.delete(r.path),
        }),
      );
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  return { db, store };
}

test("a new player's default nickname is their public number", async () => {
  const { ensureNickname } = await import("../scripts/game-api.mjs");
  const { db, store } = fakeDb();
  store.set("players/b", { xp: 50 });
  const names = await Promise.all(
    ["a", "b"].map((uid) => ensureNickname(db, uid)),
  );
  // "Player" and the same ten digits as their page, /player/<number>/.
  for (const [i, uid] of ["a", "b"].entries()) {
    const number = store.get(`accounts/${uid}`)?.player_no as string;
    assert.match(number, /^[1-9]\d{9}$/);
    assert.equal(names[i], `Player${number}`);
    assert.deepEqual(store.get(`nicknames/player${number}`), {
      uid,
      name: `Player${number}`,
    });
  }
  // The leaderboard's copy follows, for a player who has XP.
  assert.equal(store.get("players/b")?.name, names[1]);
  assert.equal(store.has("players/a"), false);
  // Asking again changes nothing.
  assert.equal(await ensureNickname(db, "a"), names[0]);

  // A name the player chose stays.
  store.set("accounts/d", { user_name: "Kate", name_key: "kate" });
  assert.equal(await ensureNickname(db, "d"), "Kate");
});

test("a name chosen before names were unique is registered on the next visit, first come first served", async () => {
  const { ensureNickname } = await import("../scripts/game-api.mjs");
  const { db, store } = fakeDb();
  store.set("accounts/ada", { user_name: " Ada " });
  store.set("accounts/twin", { user_name: "ADA" });
  assert.equal(await ensureNickname(db, "ada"), "Ada");
  assert.deepEqual(store.get("nicknames/ada"), { uid: "ada", name: "Ada" });
  assert.equal(store.get("accounts/ada")?.name_key, "ada");
  // The second "Ada" keeps the name but can't register it.
  assert.equal(await ensureNickname(db, "twin"), "ADA");
  assert.equal(store.get("accounts/twin")?.name_key, "");
  assert.equal(store.get("nicknames/ada")?.uid, "ada");
});

test("a player can take any free nickname, never one another player holds", async () => {
  const { claimNickname, ensureNickname, cleanNickname } =
    await import("../scripts/game-api.mjs");
  const { db, store } = fakeDb();
  const first = await ensureNickname(db, "ada");
  await ensureNickname(db, "bob");
  assert.deepEqual(await claimNickname(db, "ada", "  Star   Gazer "), {
    name: "Star Gazer",
  });
  assert.equal(store.get("accounts/ada")?.user_name, "Star Gazer");
  // The old default is free again.
  assert.equal(store.has(`nicknames/${first.toLowerCase()}`), false);
  // Bob can't have it, in any case or spacing.
  for (const taken of ["Star Gazer", "star gazer", "STAR  GAZER"])
    await assert.rejects(claimNickname(db, "bob", taken), {
      status: 409,
      code: "nickname_taken",
    });
  // Ada's old default stays hers alone: it is "Player" and her number.
  await assert.rejects(claimNickname(db, "bob", first), {
    status: 409,
    code: "nickname_taken",
  });
  // Ada can keep re-saving her name in any case.
  assert.equal(
    (await claimNickname(db, "ada", "star gazer")).name,
    "star gazer",
  );
  // Names shaped like a default are reserved, except a player's own.
  store.set("accounts/bob", {
    ...store.get("accounts/bob"),
    player_no: "4821937065",
  });
  for (const looksDefault of ["Player12345", "player7302518846"])
    await assert.rejects(claimNickname(db, "bob", looksDefault), {
      status: 409,
      code: "nickname_taken",
    });
  assert.equal(
    (await claimNickname(db, "bob", "Player4821937065")).name,
    "Player4821937065",
  );
  // Names that can't be one.
  for (const bad of ["", " a ", "x".repeat(25), "‮", 7])
    await assert.rejects(claimNickname(db, "bob", bad), {
      status: 400,
      code: "bad_nickname",
    });
  assert.equal(cleanNickname("Ｌｅｅ​"), "Lee");
});

test("every player gets a public number of ten random digits that no one else has", async () => {
  const { ensurePlayerNumber, isPlayerNumber } =
    await import("../scripts/game-api.mjs");
  const { db, store } = fakeDb();
  // Someone already has the first number drawn: it is drawn again.
  store.set("playerNumbers/4821937065", { uid: "z" });
  const draws = ["4821937065", "4821937065", "7302518846", "1000000000"];
  const draw = () => draws.shift()!;
  assert.equal(await ensurePlayerNumber(db, "ada", draw), "7302518846");
  assert.deepEqual(store.get("playerNumbers/7302518846"), { uid: "ada" });
  assert.equal(store.get("accounts/ada")?.player_no, "7302518846");
  // It never changes.
  assert.equal(await ensurePlayerNumber(db, "ada", draw), "7302518846");
  assert.equal(await ensurePlayerNumber(db, "bob", draw), "1000000000");
  // The real draw: always ten digits, never starting with 0.
  for (let i = 0; i < 200; i++) {
    const number = await ensurePlayerNumber(db, `p${i}`);
    assert.ok(isPlayerNumber(number), number);
  }
  for (const bad of [
    "0123456789",
    "123456789",
    "12345678901",
    "12345abcde",
    1234567890,
  ])
    assert.equal(isPlayerNumber(bad), false);
});

test("a player's public page shows what anyone may see, and nothing private", async () => {
  const { publicPlayer } = await import("../scripts/game-api.mjs");
  const { db, store } = fakeDb();
  store.set("playerNumbers/7302518846", { uid: "ada" });
  store.set("accounts/ada", {
    user_name: "Star Gazer",
    avatar: "fox",
    player_no: "7302518846",
    card_side: "TwoSides",
    progress: { secret: true },
  });
  store.set("players/ada", { xp: 7000, streak: 4, best: { memory: 9 } });
  store.set("rewards/ada", {
    coins: 340,
    kingdom: { hall: "village", tiles: { "2,0": "well", "-2,0": "tree" } },
    items: { "gemsurge/x": {} },
    badges: {
      "gemsurge/l1": {
        game: "gemsurge",
        id: "l1",
        tier: "bronze",
        level: 1,
        title: { en: "One" },
        coins: 10,
        at: "2026-01-01",
      },
      "memory/ace": {
        game: "memory",
        id: "ace",
        tier: "gold",
        icon: "star",
        title: { en: "Ace" },
        coins: 50,
        at: "2026-02-01",
      },
    },
  });
  assert.deepEqual(await publicPlayer(db, "7302518846"), {
    number: "7302518846",
    name: "Star Gazer",
    avatar: "fox",
    level: 12,
    xp: 7000,
    floor: 6600,
    next: 7800,
    streak: 4,
    // Newest first, without the coins they paid.
    badges: [
      {
        game: "memory",
        id: "ace",
        tier: "gold",
        icon: "star",
        title: { en: "Ace" },
      },
      {
        game: "gemsurge",
        id: "l1",
        tier: "bronze",
        level: 1,
        title: { en: "One" },
      },
    ],
    // Their kingdom as built, on the land level 12 opens (a city).
    kingdom: {
      stage: "city",
      size: 8,
      hall: "village",
      tiles: { "2,0": "well", "-2,0": "tree" },
    },
  });
  // Below level 2 there is no kingdom yet.
  store.set("playerNumbers/1111111111", { uid: "new" });
  store.set("accounts/new", { player_no: "1111111111" });
  const newcomer = await publicPlayer(db, "1111111111");
  assert.equal(newcomer?.kingdom, null);
  // One who never chose a nickname shows their default, never just "Player".
  assert.equal(newcomer?.name, "Player1111111111");
  // A number no player has, or that isn't one.
  assert.equal(await publicPlayer(db, "1000000000"), null);
  assert.equal(await publicPlayer(db, "ada"), null);
  assert.equal(await publicPlayer(db, "../accounts/ada"), null);
});
