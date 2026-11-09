import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_LEVELS,
  mergeProgress,
  needsSignIn,
  parseProgress,
  progressRecord,
  sameProgress,
} from "../src/crowd-progress";

test("the first five levels are free and level 6 needs an account", () => {
  assert.equal(FREE_LEVELS, 5);
  for (let lv = 1; lv <= 5; lv++) assert.equal(needsSignIn(lv, false), false);
  assert.equal(needsSignIn(6, false), true);
  assert.equal(needsSignIn(40, false), true);
  assert.equal(needsSignIn(6, true), false);
  assert.equal(needsSignIn(40, true), false);
});

test("progress is read defensively from storage", () => {
  assert.deepEqual(parseProgress(null, null), { level: 1, best: 0 });
  assert.deepEqual(parseProgress(undefined, undefined), { level: 1, best: 0 });
  assert.deepEqual(parseProgress("7", "6"), { level: 7, best: 6 });
  assert.deepEqual(parseProgress("abc", -3), { level: 1, best: 0 });
  assert.deepEqual(parseProgress(3.9, 2.2), { level: 3, best: 2 });
  // the next level is always past the best one cleared
  assert.deepEqual(parseProgress(2, 8), { level: 9, best: 8 });
  assert.deepEqual(parseProgress(1e12, 0).level, 9999);
});

test("merging keeps the furthest progress from either device", () => {
  const phone = { level: 4, best: 3 };
  const account = { level: 9, best: 8 };
  assert.deepEqual(mergeProgress(phone, account), account);
  assert.deepEqual(mergeProgress(account, phone), account);
  assert.deepEqual(
    mergeProgress({ level: 12, best: 2 }, { level: 3, best: 7 }),
    { level: 12, best: 7 },
  );
  assert.ok(sameProgress(mergeProgress(phone, phone), phone));
  assert.ok(!sameProgress(phone, account));
});

test("progress is saved to the account as level and best", () => {
  assert.deepEqual(progressRecord({ level: 6, best: 5 }), {
    level: 6,
    best: 5,
  });
});
