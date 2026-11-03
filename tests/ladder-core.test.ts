import assert from "node:assert/strict";
import test from "node:test";
import { dailyLadder, scoreLadder } from "../src/data/ladder.mjs";

import { grade, newChallenge } from "../scripts/game-core.mjs";
test("daily challenges are stable and change with the UTC day", () => {
  assert.deepEqual(dailyLadder("2026-11-02"), dailyLadder("2026-11-02"));
  assert.notDeepEqual(dailyLadder("2026-11-02"), dailyLadder("2026-11-03"));
  assert.ok(dailyLadder("2026-11-02").every((s) => /^\d{8}$/.test(s)));
});
test("server independently follows the ladder, preserving leading zeroes and retry levels", () => {
  const sequences = Array(6).fill("01234567");
  const answers = ["012", "9999", "0123", "01234", "012345", "0123456"];
  assert.equal(scoreLadder(sequences, answers).best, 7);
  assert.deepEqual(
    grade({ game: "ladder", challenge: { sequences } }, answers),
    { score: 5, max: 6 },
  );
  assert.throws(() => grade({ game: "ladder", challenge: { sequences } }, [8]));
  assert.equal(newChallenge("ladder", () => 0).sequences?.length, 6);
});
