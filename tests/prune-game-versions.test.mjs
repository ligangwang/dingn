// Deleting a game's old versions for good.
import assert from "node:assert/strict";
import test from "node:test";
import {
  prunable,
  pruneGameVersions,
  pruned,
  refusal,
} from "../scripts/prune-game-versions.mjs";
import { addVersion } from "../scripts/game-registry.mjs";
import { reserveUpload } from "../scripts/developer-games.mjs";

const record = (extra = {}) => ({
  id: "crowdrush",
  status: "listed",
  live: "1.16.0",
  beta: null,
  versions: {
    "1.2.0": {},
    "1.9.3": {},
    "1.10.0": {},
    "1.15.1": {},
    "1.16.0": {},
  },
  ...extra,
});

function fake(start) {
  const state = { record: start };
  const deleted = [];
  // Set to make the bucket fail on one version's files, once.
  const failing = { on: null };
  const ref = {
    async get() {
      return { exists: !!state.record, data: () => state.record };
    },
  };
  const db = {
    collection: () => ({ doc: () => ref }),
    async runTransaction(run) {
      return run({
        get: () => ref.get(),
        set: (_ref, next) => (state.record = next),
      });
    },
  };
  const files = {
    async getFiles({ prefix }) {
      if (deleted.includes(prefix)) return [[]];
      return [prefix.endsWith("/1.15.1/") ? [{}, {}, {}] : [{}]];
    },
    async deleteFiles({ prefix }) {
      if (failing.on && prefix.endsWith(`/${failing.on}/`)) {
        failing.on = null;
        throw new Error("bucket unavailable");
      }
      deleted.push(prefix);
    },
  };
  return { db, files, deleted, state, failing };
}
const log = () => {};

test("only versions older than the live one go, and never the beta", () => {
  assert.deepEqual(prunable(record()), ["1.2.0", "1.9.3", "1.10.0", "1.15.1"]);
  // a newer upload waiting for review stays, and so does the beta
  assert.deepEqual(
    prunable(
      record({
        beta: "1.10.0",
        versions: { ...record().versions, "1.17.0": {} },
      }),
    ),
    ["1.2.0", "1.9.3", "1.15.1"],
  );
  // after a rollback, what is newer than live stays
  assert.deepEqual(prunable(record({ live: "1.10.0" })), ["1.2.0", "1.9.3"]);
  assert.deepEqual(prunable(record({ live: null })), []);
  assert.deepEqual(prunable(null), []);
});

test("a game needs a live version to keep", () => {
  assert.equal(refusal("crowdrush", record()), null);
  assert.match(refusal("crowdrush", record({ live: null })), /no live version/);
  assert.match(refusal("crowdrush", record({ live: "9.9.9" })), /no live/);
  assert.match(refusal("crowdrush", null), /no such game/);
  assert.match(refusal("../x", record()), /not a game id/);
});

test("a dry run deletes nothing; apply deletes the files and the entries", async () => {
  const { db, files, deleted, state } = fake(record());
  const dry = await pruneGameVersions("crowdrush", { db, files, log });
  assert.deepEqual(dry.versions, ["1.2.0", "1.9.3", "1.10.0", "1.15.1"]);
  assert.equal(dry.files, 6);
  assert.deepEqual(deleted, []);
  assert.equal(Object.keys(state.record.versions).length, 5);

  await pruneGameVersions("crowdrush", { db, files, apply: true, log });
  assert.deepEqual(deleted, [
    "games/crowdrush/1.2.0/",
    "games/crowdrush/1.9.3/",
    "games/crowdrush/1.10.0/",
    "games/crowdrush/1.15.1/",
  ]);
  assert.deepEqual(Object.keys(state.record.versions), ["1.16.0"]);
  assert.equal(state.record.live, "1.16.0");
  assert.deepEqual(state.record.pruned, ["1.2.0", "1.9.3", "1.10.0", "1.15.1"]);
  // Nothing left to delete the second time.
  const again = await pruneGameVersions("crowdrush", {
    db,
    files,
    apply: true,
    log,
  });
  assert.deepEqual([again.versions, again.unfinished], [[], []]);
  assert.equal(deleted.length, 4);
  await assert.rejects(
    pruneGameVersions("crowdrush", {
      db: fake(record({ live: null })).db,
      files,
      apply: true,
      log,
    }),
    /no live version/,
  );
});

test("a deleted version's number is never published again", () => {
  const after = pruned(record(), ["1.15.1"], "2026-11-27T00:00:00Z");
  assert.deepEqual(after.pruned, ["1.15.1"]);
  assert.equal(after.versions["1.15.1"], undefined);
  const manifest = (version) => ({
    id: "crowdrush",
    version,
    title: { en: "Crowd Rush", zh: "人潮突击" },
    entry: "index.html",
  });
  assert.throws(
    () => addVersion(after, manifest("1.15.1")),
    /already published/,
  );
  assert.equal(addVersion(after, manifest("1.17.0")).live, "1.17.0");
  // and the list survives later uploads
  assert.deepEqual(addVersion(after, manifest("1.17.0")).pruned, ["1.15.1"]);
});

test("a run that stopped part way is finished by the next one", async () => {
  const { db, files, deleted, state, failing } = fake(record());
  failing.on = "1.10.0";
  await assert.rejects(
    pruneGameVersions("crowdrush", { db, files, apply: true, log }),
    /bucket unavailable/,
  );
  // The registry already dropped all four, but two versions' files remain.
  assert.deepEqual(Object.keys(state.record.versions), ["1.16.0"]);
  assert.deepEqual(deleted, [
    "games/crowdrush/1.2.0/",
    "games/crowdrush/1.9.3/",
  ]);
  // A dry run says so, and the next real run deletes them.
  const dry = await pruneGameVersions("crowdrush", { db, files, log });
  assert.deepEqual(dry.versions, []);
  assert.deepEqual(dry.unfinished, ["1.10.0", "1.15.1"]);
  assert.equal(dry.files, 4);
  await pruneGameVersions("crowdrush", { db, files, apply: true, log });
  assert.deepEqual(deleted.slice(2).sort(), [
    "games/crowdrush/1.10.0/",
    "games/crowdrush/1.15.1/",
  ]);
  const done = await pruneGameVersions("crowdrush", { db, files, log });
  assert.deepEqual([done.versions, done.unfinished, done.files], [[], [], 0]);
});

test("an upload of a deleted version's number is turned away before any file is saved", () => {
  const after = { ...pruned(record(), ["1.15.1"]), owner: "dev1" };
  const developer = { uid: "dev1", email: "dev@example.com" };
  const upload = (version) =>
    reserveUpload(after, { id: "crowdrush", version }, developer);
  assert.throws(() => upload("1.15.1"), { code: "version-exists" });
  assert.throws(() => upload("1.16.0"), { code: "version-exists" });
  assert.ok(upload("1.17.0").pending["1.17.0"]);
});
