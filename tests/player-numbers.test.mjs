import assert from "node:assert/strict";
import test from "node:test";
import { isPlayerNumber, topPlayers } from "../scripts/game-api.mjs";

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
  const ref = (path) => ({ path, get: async () => snap(path) });
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

test("the leaderboard gives a top player with no public number one, so every name links", async () => {
  const { db, store } = fakeDb({
    "players/ada": { xp: 900, level: 6, name: "Ada" },
    "players/bo": { xp: 300, level: 3, name: "Bo" },
    "accounts/ada": { avatar: "fox", player_no: "7302518846" },
  });
  const entries = await topPlayers(db);
  assert.deepEqual(
    entries.map(({ name, number, avatar }) => [name, number, avatar]),
    [
      ["Ada", "7302518846", "fox"],
      ["Bo", store.get("accounts/bo").player_no, ""],
    ],
  );
  const bo = entries[1].number;
  assert.ok(isPlayerNumber(bo));
  assert.deepEqual(store.get(`playerNumbers/${bo}`), { uid: "bo" });
  // Ada kept hers.
  assert.equal(store.get("accounts/ada").player_no, "7302518846");
});
