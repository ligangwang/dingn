import assert from "node:assert/strict";
import test from "node:test";
import {
  exportNumber,
  exportWord,
  wordShard,
} from "../scripts/export-memory-data.mjs";
import {
  mergedProgress,
  migrate,
} from "../scripts/migrate-memory-favorites.mjs";

test("the Memory export keeps numbers, words and definitions compact", () => {
  assert.deepEqual(
    exportNumber("07", {
      number: "07",
      words: ["sock", "sack"],
      most_favorite_word: "sock",
    }),
    ["07", { w: ["sock", "sack"], f: "sock" }],
  );
  assert.deepEqual(exportNumber("x", { number: "12345" }), null);
  assert.deepEqual(
    exportWord("sock", {
      ipa: "/sɒk/",
      "ipa-lang": "en-GB",
      number: "07",
      pos: { noun: "a garment", verb: ["hit"] },
    }),
    ["sock", ["/sɒk/", "en-GB", "07", { noun: ["a garment"], verb: ["hit"] }]],
  );
  assert.equal(exportWord(" ", {}), null);
  assert.equal(wordShard("Sock"), "s");
  assert.equal(wordShard("éclair"), "_");
});

test("favorites merge into Memory progress without replacing the game's own", () => {
  assert.equal(
    mergedProgress(undefined, { "07": "sock" }),
    '{"favorites":{"07":"sock"}}',
  );
  assert.equal(
    mergedProgress('{"best":9,"favorites":{"07":"sack"}}', {
      "07": "sock",
      1: "tie",
    }),
    '{"best":9,"favorites":{"1":"tie","07":"sack"}}',
  );
  assert.equal(
    mergedProgress('{"favorites":{"07":"sack"}}', { "07": "sock" }),
    null,
  );
  assert.equal(
    mergedProgress("not json", { 1: "tie" }),
    '{"favorites":{"1":"tie"}}',
  );
});

/** A small stand-in for Firestore with number_favorites and accounts. */
function fakeDb(favorites, accounts) {
  const query = (docs, start = 0, size = Infinity) => ({
    orderBy: () => query(docs, start, size),
    limit: (n) => query(docs, start, n),
    startAfter: (doc) => query(docs, docs.indexOf(doc) + 1, size),
    async get() {
      const page = docs.slice(start, start + size);
      return { empty: !page.length, docs: page };
    },
  });
  const favDocs = favorites.map((data, i) => ({
    id: `f${i}`,
    data: () => data,
  }));
  return {
    collection(name) {
      if (name === "number_favorites") return query(favDocs);
      return {
        doc: (uid) => ({
          async get() {
            return {
              exists: uid in accounts,
              updateTime: "t",
              data: () => accounts[uid],
            };
          },
          async update(fields) {
            Object.assign(accounts[uid], fields);
          },
          async create(fields) {
            accounts[uid] = { ...fields };
          },
        }),
      };
    },
  };
}

test("dry run counts, apply writes once, and a second run does nothing", async () => {
  const accounts = { alice: { user_name: "A" } };
  const db = fakeDb(
    [
      { uid: "alice", number: "07", favoriteWord: "sock" },
      { uid: "alice", number: "1", favoriteWord: "tie" },
      { uid: "bob", number: "2", favoriteWord: "noah" },
      { uid: "bob", number: "99999", favoriteWord: "bad" },
    ],
    accounts,
  );
  const log = () => {};
  assert.equal((await migrate(db, { log })).migrate, 2);
  assert.deepEqual(accounts, { alice: { user_name: "A" } });
  assert.equal((await migrate(db, { apply: true, log })).written, 2);
  assert.deepEqual(JSON.parse(accounts.alice.game_progress_memory), {
    favorites: { "07": "sock", 1: "tie" },
  });
  assert.equal(accounts.bob.game_progress_memory, '{"favorites":{"2":"noah"}}');
  assert.equal((await migrate(db, { apply: true, log })).written, 0);
});
