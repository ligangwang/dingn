// The one-time tidy of saved challenges: players kept by uid alone, and one
// challenge for one score.
import "./kingdom-rules.mjs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, store, migration, nicknameKey;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-challenge-uids-"));
  process.env.GAMES_LOCAL_DIR = dir;
  store = await import("../scripts/platform-store.mjs");
  migration = await import("../scripts/migrate-challenge-uids.mjs");
  ({ nicknameKey } = await import("../scripts/game-api.mjs"));
});
after(() => rm(dir, { recursive: true, force: true }));

const round = {
  game: "gemsurge",
  mode: "level",
  seed: "28",
  score: 2110,
  unit: "points",
  rules: null,
};

test("a name leads to its player: a default name by its number, otherwise by the nickname register", async () => {
  await store.mergeDoc("playerNumbers", "1006173077", { uid: "u-rain" });
  await store.mergeDoc("nicknames", nicknameKey("Sci Empirica"), {
    uid: "u-sci",
    name: "Sci Empirica",
  });
  assert.equal(await migration.uidForName("Player1006173077"), "u-rain");
  assert.equal(await migration.uidForName("Tester1006173077"), "u-rain");
  // Capitals and spacing don't matter, as in the register.
  assert.equal(await migration.uidForName(" sci  empirica "), "u-sci");
  // A default name whose number nobody holds, and a name nobody holds.
  assert.equal(await migration.uidForName("Player9999999999"), null);
  assert.equal(await migration.uidForName("Nobody"), null);
  assert.equal(await migration.uidForName(null), null);
});

test("challenges move to uids, repeats go, and the lists are written again", async () => {
  const at = (n) => `2026-11-22T00:00:0${n}.000Z`;
  // Made before uids were kept alone: names, numbers and avatars of the time.
  await store.mergeDoc("challenges", "AAAAAAAAAAA1", {
    ...round,
    uid: "u-sci",
    name: "sciempirica",
    createdAt: at(1),
    public: true,
    players: 2,
    results: [
      {
        uid: "u-sci",
        name: "sciempirica",
        number: "1234567890",
        avatar: "fox",
        score: 2940,
        at: at(2),
      },
      // A result kept by name only: a default name, and a chosen nickname.
      { name: "Player1006173077", score: 2900, at: at(3) },
    ],
  });
  // The same score posted twice more, which nobody else played.
  for (const [id, n] of [
    ["AAAAAAAAAAA2", 4],
    ["AAAAAAAAAAA3", 5],
  ])
    await store.mergeDoc("challenges", id, {
      ...round,
      uid: "u-sci",
      name: "sciempirica",
      createdAt: at(n),
      public: true,
      players: 1,
      results: [{ uid: "u-sci", name: "sciempirica", score: 2110, at: at(n) }],
    });
  // A guest's, and one whose player can't be found.
  await store.mergeDoc("challenges", "AAAAAAAAAAA4", {
    ...round,
    uid: null,
    name: null,
    createdAt: at(6),
    public: false,
  });
  await store.mergeDoc("challenges", "AAAAAAAAAAA5", {
    ...round,
    score: 5,
    uid: null,
    name: "Nobody",
    createdAt: at(7),
    public: false,
  });
  await store.mergeDoc("challengeBoards", "gemsurge", {
    threads: ["AAAAAAAAAAA3", "AAAAAAAAAAA2", "AAAAAAAAAAA1"].map((id) => ({
      id,
      mode: "level",
      score: 2110,
      unit: "points",
      name: "sciempirica",
      players: 1,
      top: { name: "sciempirica", score: 2110 },
      createdAt: at(1),
    })),
  });

  // A dry run counts and changes nothing.
  const lines = [];
  const dry = await migration.migrate({ log: (l) => lines.push(l) });
  assert.deepEqual(dry, {
    challenges: 5,
    changed: 4,
    found: 1,
    lost: 1,
    repeats: 2,
    lists: 1,
  });
  assert.match(lines[0], /^Would move 4 of 5 challenges to uids/);
  assert.equal(
    (await store.getDoc("challenges", "AAAAAAAAAAA1")).name,
    "sciempirica",
  );

  await migration.migrate({ apply: true, log: () => {}, now: at(9) });
  const first = await store.getDoc("challenges", "AAAAAAAAAAA1");
  assert.equal(first.name, undefined);
  assert.deepEqual(first.results, [
    { uid: "u-sci", score: 2940, at: at(2) },
    // Found from the default name's number.
    { uid: "u-rain", score: 2900, at: at(3) },
  ]);
  // The one others played is kept; its repeats are deleted, not destroyed.
  assert.equal(first.deleted, undefined);
  for (const id of ["AAAAAAAAAAA2", "AAAAAAAAAAA3"]) {
    const gone = await store.getDoc("challenges", id);
    assert.equal(gone.deleted, true);
    assert.equal(gone.deletedAt, at(9));
    assert.equal(gone.score, 2110);
  }
  // A guest's has no name left; a name with no player is kept.
  assert.deepEqual(
    Object.keys(await store.getDoc("challenges", "AAAAAAAAAAA4")).includes(
      "name",
    ),
    false,
  );
  assert.equal(
    (await store.getDoc("challenges", "AAAAAAAAAAA5")).name,
    "Nobody",
  );
  // The list holds the one challenge, by uid.
  const board = await store.getDoc("challengeBoards", "gemsurge");
  assert.deepEqual(board.threads, [
    {
      id: "AAAAAAAAAAA1",
      mode: "level",
      score: 2110,
      unit: "points",
      uid: "u-sci",
      players: 2,
      results: [
        { uid: "u-sci", score: 2940 },
        { uid: "u-rain", score: 2900 },
      ],
      createdAt: at(1),
    },
  ]);
  // Running it again changes nothing.
  assert.deepEqual(await migration.migrate({ apply: true, log: () => {} }), {
    challenges: 5,
    changed: 0,
    found: 0,
    lost: 1,
    repeats: 0,
    lists: 0,
  });
});
