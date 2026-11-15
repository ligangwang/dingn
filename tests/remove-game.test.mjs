import assert from "node:assert/strict";
import test from "node:test";
import { refusal, removeGame } from "../scripts/remove-game.mjs";

function fake(records) {
  const deleted = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        async get() {
          const data = records[`${name}/${id}`];
          return { exists: !!data, data: () => data };
        },
        async delete() {
          deleted.push(`${name}/${id}`);
        },
      }),
    }),
  };
  const files = {
    async getFiles({ prefix }) {
      return [prefix === "games/crowd/" ? [{}, {}, {}] : []];
    },
    async deleteFiles({ prefix }) {
      deleted.push(`bucket:${prefix}`);
    },
  };
  return { db, files, deleted };
}

test("only a game already taken down can be removed", () => {
  assert.equal(refusal("crowd", { status: "removed" }), null);
  assert.match(refusal("crowd", { status: "unlisted" }), /take it down/);
  assert.match(refusal("crowd", null), /no such game/);
  assert.match(refusal("../x", {}), /not a game id/);
});

test("a dry run deletes nothing; apply deletes the record, counts and files", async () => {
  const { db, files, deleted } = fake({ "games/crowd": { status: "removed" } });
  const log = () => {};
  assert.equal((await removeGame("crowd", { db, files, log })).files, 3);
  assert.deepEqual(deleted, []);
  await removeGame("crowd", { db, files, apply: true, log });
  assert.deepEqual(deleted, [
    "bucket:games/crowd/",
    "gameStats/crowd",
    "games/crowd",
  ]);
  await assert.rejects(
    removeGame("crowdrush", {
      db: fake({ "games/crowdrush": { status: "listed" } }).db,
      files,
      apply: true,
      log,
    }),
    /take it down/,
  );
});
