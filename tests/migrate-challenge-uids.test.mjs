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

test("challenges move to uids, each level's challenges merge into its first, and the lists are written again", async () => {
  const at = (n) => `2026-11-22T00:00:0${n}.000Z`;
  const challenges = await import("../scripts/challenges.mjs");
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
      // A result kept by name only, here a default name.
      { name: "Player1006173077", score: 2900, at: at(3) },
    ],
  });
  // The same level challenged again: twice by the same player, and once by
  // another, whose challenge someone else played too.
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
  await store.mergeDoc("challenges", "AAAAAAAAAAA6", {
    ...round,
    score: 3660,
    uid: "u-rain",
    name: "Player1006173077",
    createdAt: at(6),
    public: true,
    players: 2,
    results: [
      { uid: "u-rain", name: "Player1006173077", score: 3660, at: at(6) },
      { uid: "u-kn", name: "knoics", score: 2290, at: at(7) },
    ],
  });
  // Another level, a guest's, and one whose player can't be found.
  await store.mergeDoc("challenges", "AAAAAAAAAAA7", {
    ...round,
    seed: "29",
    uid: "u-kn",
    name: "knoics",
    createdAt: at(7),
    public: true,
    players: 1,
    results: [{ uid: "u-kn", name: "knoics", score: 800, at: at(7) }],
  });
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
    threads: [
      "AAAAAAAAAAA7",
      "AAAAAAAAAAA6",
      "AAAAAAAAAAA3",
      "AAAAAAAAAAA2",
      "AAAAAAAAAAA1",
    ].map((id) => ({
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
    challenges: 7,
    changed: 6,
    found: 1,
    lost: 1,
    levels: 2,
    merged: 3,
    lists: 1,
  });
  assert.match(lines[0], /^Would move 6 of 7 challenges to uids/);
  assert.equal(
    (await store.getDoc("challenges", "AAAAAAAAAAA1")).name,
    "sciempirica",
  );
  assert.equal(
    await store.getDoc(
      "challengeRounds",
      challenges.roundKey("gemsurge", round),
    ),
    null,
  );

  await migration.migrate({ apply: true, log: () => {}, now: at(9) });
  // The first one made owns the level, with everyone's best under it.
  const first = await store.getDoc("challenges", "AAAAAAAAAAA1");
  assert.equal(first.name, undefined);
  assert.equal(first.uid, "u-sci");
  assert.equal(first.score, 2110);
  assert.equal(first.deleted, undefined);
  assert.equal(first.players, 3);
  assert.deepEqual(first.results, [
    // (Found from the default name's number, and the best of their two.)
    { uid: "u-rain", score: 3660, at: at(6) },
    { uid: "u-sci", score: 2940, at: at(2) },
    { uid: "u-kn", score: 2290, at: at(7) },
  ]);
  assert.deepEqual(
    await store.getDoc("challengeResults", "AAAAAAAAAAA1_u-rain"),
    { challenge: "AAAAAAAAAAA1", uid: "u-rain", score: 3660, at: at(6) },
  );
  // The others are deleted, not destroyed, and name the one they went into.
  for (const id of ["AAAAAAAAAAA2", "AAAAAAAAAAA3", "AAAAAAAAAAA6"]) {
    const gone = await store.getDoc("challenges", id);
    assert.equal(gone.deleted, true);
    assert.equal(gone.deletedAt, at(9));
    assert.equal(gone.mergedInto, "AAAAAAAAAAA1");
  }
  // Their links open the level's challenge.
  assert.equal(
    (await challenges.findChallenge("AAAAAAAAAAA6")).id,
    "AAAAAAAAAAA1",
  );
  // Each level names its challenge, so the next challenger joins it.
  assert.deepEqual(
    await store.getDoc(
      "challengeRounds",
      challenges.roundKey("gemsurge", round),
    ),
    { id: "AAAAAAAAAAA1" },
  );
  assert.deepEqual(
    await store.getDoc(
      "challengeRounds",
      challenges.roundKey("gemsurge", { ...round, seed: "29" }),
    ),
    { id: "AAAAAAAAAAA7" },
  );
  // A guest's has no name left; a name with no player is kept.
  assert.equal(
    Object.keys(await store.getDoc("challenges", "AAAAAAAAAAA4")).includes(
      "name",
    ),
    false,
  );
  assert.equal(
    (await store.getDoc("challenges", "AAAAAAAAAAA5")).name,
    "Nobody",
  );
  // The list holds one challenge for each level, by uid.
  const board = await store.getDoc("challengeBoards", "gemsurge");
  assert.deepEqual(
    board.threads.map((t) => [t.id, t.seed, t.uid, t.players]),
    [
      ["AAAAAAAAAAA7", "29", "u-kn", 1],
      ["AAAAAAAAAAA1", "28", "u-sci", 3],
    ],
  );
  assert.deepEqual(board.threads[1].results, [
    { uid: "u-rain", score: 3660 },
    { uid: "u-sci", score: 2940 },
    { uid: "u-kn", score: 2290 },
  ]);
  // A level whose challenges had all dropped off a full list is listed by
  // the one kept, and a player below a challenge's kept results is merged
  // by their own best.
  const level = { ...round, seed: "30" };
  const pair = [
    {
      id: "BBBBBBBBBBB1",
      ...level,
      uid: "u-sci",
      createdAt: at(1),
      public: true,
      players: 1,
      results: [{ uid: "u-sci", score: 10, at: at(1) }],
    },
    {
      id: "BBBBBBBBBBB2",
      ...level,
      uid: "u-kn",
      createdAt: at(8),
      public: true,
      players: 2,
      results: [{ uid: "u-kn", score: 20, at: at(8) }],
    },
  ];
  const [one] = migration.merged(pair, [
    { challenge: "BBBBBBBBBBB2", uid: "u-rain", score: 5, at: at(8) },
    { challenge: "ZZZZZZZZZZZZ", uid: "u-else", score: 99, at: at(8) },
  ]);
  assert.equal(one.keep.id, "BBBBBBBBBBB1");
  assert.deepEqual(one.gone, ["BBBBBBBBBBB2"]);
  assert.equal(one.keep.players, 3);
  assert.deepEqual(
    one.keep.results.map((r) => [r.uid, r.score]),
    [
      ["u-kn", 20],
      ["u-sci", 10],
      ["u-rain", 5],
    ],
  );
  for (const { id, ...doc } of pair)
    await store.mergeDoc("challenges", id, doc);
  // (Neither is on the list: both had dropped off it.)
  await migration.migrate({ apply: true, log: () => {}, now: at(9) });
  assert.deepEqual(
    (await store.getDoc("challengeBoards", "gemsurge")).threads.map(
      (t) => t.id,
    ),
    ["AAAAAAAAAAA7", "BBBBBBBBBBB1", "AAAAAAAAAAA1"],
  );
  // Running it again changes nothing.
  assert.deepEqual(await migration.migrate({ apply: true, log: () => {} }), {
    challenges: 9,
    changed: 0,
    found: 0,
    lost: 1,
    levels: 3,
    merged: 0,
    lists: 0,
  });
});
