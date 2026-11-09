import assert from "node:assert/strict";
import test from "node:test";
import {
  crowdrushProgress,
  migrate,
} from "../scripts/migrate-crowd-progress.mjs";

test("picks the newest Crowd Rush save and never replaces a crowdrush one", () => {
  assert.equal(
    crowdrushProgress({ game_progress_crowd: '{"level":20}', crowd_level: 3 }),
    '{"level":20}',
  );
  assert.equal(
    crowdrushProgress({ crowd_level: 12, crowd_best: 11 }),
    '{"level":12,"best":11}',
  );
  assert.equal(crowdrushProgress({ crowd_level: 4 }), '{"level":4,"best":0}');
  assert.equal(
    crowdrushProgress({
      game_progress_crowd: '{"level":20}',
      game_progress_crowdrush: '{"level":2}',
    }),
    null,
  );
  assert.equal(crowdrushProgress({ userName: "x" }), null);
  assert.equal(crowdrushProgress(undefined), null);
});

/** A small stand-in for Firestore's accounts collection. */
function fakeDb(accounts, { changed = [], broken = [] } = {}) {
  const docs = Object.entries(accounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id]) => ({
      id,
      updateTime: `t-${id}`,
      data: () => accounts[id],
      ref: {
        async update(fields, { lastUpdateTime }) {
          if (broken.includes(id))
            throw Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
          if (changed.includes(id) || lastUpdateTime !== `t-${id}`)
            throw Object.assign(new Error("FAILED_PRECONDITION"), { code: 9 });
          Object.assign(accounts[id], fields);
        },
      },
    }));
  const query = (start, size) => ({
    orderBy: () => query(start, size),
    limit: (n) => query(start, n),
    startAfter: (doc) => query(docs.indexOf(doc) + 1, size),
    async get() {
      const page = docs.slice(start, start + size);
      return { empty: page.length === 0, docs: page };
    },
  });
  return { collection: () => query(0, Infinity) };
}

test("dry run counts, apply writes once, and a second run does nothing", async () => {
  const accounts = {};
  for (let i = 0; i < 650; i++)
    accounts[`u${String(i).padStart(3, "0")}`] =
      i % 2 ? { crowd_level: i } : { userName: "x" };
  accounts.u001.game_progress_crowdrush = '{"level":99}';
  const quiet = { log: () => {} };

  const dry = await migrate(fakeDb(accounts), quiet);
  assert.equal(dry.accounts, 650);
  assert.equal(dry.migrate, 324);
  assert.equal(dry.written, 0);
  assert.equal(accounts.u003.game_progress_crowdrush, undefined);

  const run = await migrate(fakeDb(accounts, { changed: ["u005"] }), {
    ...quiet,
    apply: true,
  });
  assert.deepEqual([run.written, run.changed], [323, 1]);
  assert.equal(accounts.u003.game_progress_crowdrush, '{"level":3,"best":0}');
  assert.equal(accounts.u003.crowd_level, 3);
  assert.equal(accounts.u001.game_progress_crowdrush, '{"level":99}');
  assert.equal(accounts.u005.game_progress_crowdrush, undefined);

  const again = await migrate(fakeDb(accounts), { ...quiet, apply: true });
  assert.equal(again.migrate, 1);
  assert.equal(again.written, 1);
  assert.equal((await migrate(fakeDb(accounts), quiet)).migrate, 0);
});

test("a failure other than a concurrent change stops the run", async () => {
  const accounts = { a: { crowd_level: 1 }, b: { crowd_level: 2 } };
  await assert.rejects(
    migrate(fakeDb(accounts, { broken: ["a"] }), {
      apply: true,
      log: () => {},
    }),
    /PERMISSION_DENIED/,
  );
  assert.equal(accounts.b.game_progress_crowdrush, undefined);
});
