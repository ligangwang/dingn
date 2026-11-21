import assert from "node:assert/strict";
import test from "node:test";
import { isPlayerNumber, topPlayers } from "../scripts/game-api.mjs";
import { rename } from "../scripts/rename-counter-defaults.mjs";

/**
 * A small stand-in for Firestore: documents by path, paged queries in id
 * order, getAll and transactions (run one at a time).
 */
function fakeDb(seed) {
  const store = new Map(Object.entries(seed));
  const snap = (path) => ({
    id: path.split("/")[1],
    exists: store.has(path),
    data: () => store.get(path),
  });
  const ref = (path) => ({
    path,
    get: async () => snap(path),
    delete: async () => store.delete(path),
  });
  const query = (name, { order, limit = Infinity, after = null } = {}) => ({
    orderBy: (field, dir) => query(name, { order: [field, dir], limit, after }),
    limit: (n) => query(name, { order, limit: n, after }),
    startAfter: (doc) => query(name, { order, limit, after: doc.id }),
    get: async () => {
      let docs = [...store.keys()]
        .filter((p) => p.startsWith(`${name}/`))
        .map(snap);
      if (order?.[0] === "xp")
        docs.sort((a, b) => (b.data().xp ?? 0) - (a.data().xp ?? 0));
      else docs.sort((a, b) => a.id.localeCompare(b.id));
      if (after) docs = docs.filter((d) => d.id > after);
      docs = docs.slice(0, limit);
      return { empty: !docs.length, docs };
    },
  });
  let queue = Promise.resolve();
  const db = {
    collection: (name) => ({
      ...query(name),
      doc: (id) => ref(`${name}/${id}`),
    }),
    getAll: async (...refs) => refs.map((r) => snap(r.path)),
    runTransaction: (fn) => {
      const run = queue.then(() =>
        fn({
          get: async (r) => snap(r.path),
          set: (r, data) =>
            store.set(r.path, { ...store.get(r.path), ...data }),
          delete: (r) => store.delete(r.path),
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

test("the leaderboard shows each player's own nickname and links every one, giving defaults to those with none", async () => {
  const { db, store } = fakeDb({
    "players/ada": { xp: 900, level: 6, name: "Ada" },
    // Bo's XP record still has his Google first name, but he never chose a
    // nickname or came back since nicknames began.
    "players/bo": { xp: 300, level: 3, name: "Bo" },
    "accounts/ada": {
      avatar: "fox",
      player_no: "7302518846",
      user_name: "Star Gazer",
      name_key: "star%20gazer",
    },
  });
  const entries = await topPlayers(db);
  assert.deepEqual(
    entries.map(({ name, number, avatar }) => [name, number, avatar]),
    [
      ["Star Gazer", "7302518846", "fox"],
      [
        `Player${store.get("accounts/bo").player_no}`,
        store.get("accounts/bo").player_no,
        "",
      ],
    ],
  );
  const bo = entries[1].number;
  assert.ok(isPlayerNumber(bo));
  assert.deepEqual(store.get(`playerNumbers/${bo}`), { uid: "bo" });
  // Bo's default nickname is his, registered, and on his XP record too.
  assert.deepEqual(store.get(`nicknames/player${bo}`), {
    uid: "bo",
    name: `Player${bo}`,
  });
  assert.equal(store.get("players/bo").name, `Player${bo}`);
  // Ada kept hers.
  assert.equal(store.get("accounts/ada").player_no, "7302518846");
});

test("the counter's default nicknames become each player's number, and the counter goes", async () => {
  const seed = {
    "counters/playerNames": { next: 10004 },
    // Still the counter's name: renamed to Player<their number>.
    "accounts/a": {
      user_name: "Player10001",
      name_key: "player10001",
      player_no: "7302518846",
    },
    "nicknames/player10001": { uid: "a", name: "Player10001" },
    "players/a": { xp: 40, name: "Player10001" },
    // Chose another name since: left alone.
    "accounts/b": { user_name: "Kate", name_key: "kate" },
    "nicknames/kate": { uid: "b", name: "Kate" },
    // Still the counter's name, with no public number yet: given one.
    "accounts/c": { user_name: "Player10003", name_key: "player10003" },
    "nicknames/player10003": { uid: "c", name: "Player10003" },
  };
  const dry = fakeDb(seed);
  const lines = [];
  assert.deepEqual(await rename(dry.db, { log: (l) => lines.push(l) }), {
    handedOut: 3,
    renamed: 2,
    kept: 1,
  });
  assert.equal(
    lines[0],
    "Would rename 2 of 3 counted default nicknames (1 since changed)",
  );
  assert.equal(dry.store.get("accounts/a").user_name, "Player10001");

  const { db, store } = fakeDb(seed);
  await rename(db, { apply: true, log: () => {} });
  assert.equal(store.get("accounts/a").user_name, "Player7302518846");
  assert.equal(store.get("accounts/a").name_key, "player7302518846");
  assert.deepEqual(store.get("nicknames/player7302518846"), {
    uid: "a",
    name: "Player7302518846",
  });
  assert.equal(store.has("nicknames/player10001"), false);
  assert.equal(store.get("players/a").name, "Player7302518846");
  assert.equal(store.get("accounts/b").user_name, "Kate");
  const c = store.get("accounts/c");
  assert.ok(isPlayerNumber(c.player_no));
  assert.equal(c.user_name, `Player${c.player_no}`);
  assert.equal(store.has("nicknames/player10003"), false);
  // The counter is gone.
  assert.equal(store.has("counters/playerNames"), false);
});
