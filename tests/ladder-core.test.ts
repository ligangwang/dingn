import assert from "node:assert/strict";
import test from "node:test";
import {
  dailyLadder,
  LADDER_MAX,
  LADDER_ROUNDS,
  scoreLadder,
} from "../src/data/ladder.mjs";

import { grade, newChallenge } from "../scripts/game-core.mjs";

const climb = (sequences: string[], hits: boolean[]) => {
  const answers: string[] = [];
  let length = 3;
  for (const [i, hit] of hits.entries()) {
    answers.push(hit ? sequences[i].slice(0, length) : "9");
    if (hit) length++;
  }
  return answers;
};

test("daily challenges are stable, change with the UTC day and reach 20 digits", () => {
  const day = dailyLadder("2026-11-02");
  assert.deepEqual(day, dailyLadder("2026-11-02"));
  assert.notDeepEqual(day, dailyLadder("2026-11-03"));
  assert.equal(day.length, LADDER_ROUNDS);
  assert.ok(day.every((s) => /^\d+$/.test(s)));
  assert.equal(day.at(-1)?.length, LADDER_MAX);
});

test("server independently follows the ladder, preserving leading zeroes and retry levels", () => {
  const sequences = Array(LADDER_ROUNDS).fill("01234567890123456789");
  const answers = ["012", "9999", "0123", "01234", "", "012345", "7"];
  const result = scoreLadder(sequences, answers);
  assert.equal(result.best, 6);
  assert.equal(result.over, true);
  assert.equal(result.lives, 0);
  assert.deepEqual(
    grade({ game: "ladder", challenge: { sequences } }, answers),
    { score: 4, max: 18 },
  );
  // an unfinished climb, or rounds past the end, don't count
  assert.throws(() =>
    grade({ game: "ladder", challenge: { sequences } }, answers.slice(0, 4)),
  );
  assert.throws(() =>
    grade({ game: "ladder", challenge: { sequences } }, [...answers, "012"]),
  );
  assert.throws(() => grade({ game: "ladder", challenge: { sequences } }, [8]));
  assert.equal(
    newChallenge("ladder", () => 0).sequences?.length,
    LADDER_ROUNDS,
  );
});

test("a perfect climb tops out at 20 digits, even after two misses", () => {
  const sequences = dailyLadder("2026-11-08");
  const answers = climb(sequences, [
    false,
    false,
    ...Array(LADDER_MAX - 2).fill(true),
  ]);
  assert.equal(answers.length, LADDER_ROUNDS);
  const result = scoreLadder(sequences, answers);
  assert.equal(result.best, LADDER_MAX);
  assert.equal(result.over, true);
  assert.deepEqual(
    grade({ game: "ladder_daily", challenge: { sequences } }, answers),
    { score: 18, max: 18 },
  );
});
