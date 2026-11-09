import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeToasts,
  type BadgeDef,
  type EarnedToast,
} from "../src/lib/rewards";

const def = (id: string, tier: BadgeDef["tier"], level: number): BadgeDef => ({
  id,
  tier,
  level,
  coins: 0,
  title: { en: id, zh: id },
});
const toast = (key: number, badge: BadgeDef, coins: number): EarnedToast => ({
  key,
  count: 1,
  badge,
  coins,
  test: false,
});

test("badges that arrive together share one popup", () => {
  const caughtUp = [
    toast(1, def("first-win", "bronze", 1), 10),
    toast(2, def("level-25", "silver", 25), 25),
    toast(3, def("level-5", "bronze", 5), 10),
  ].reduce(mergeToasts);
  assert.equal(caughtUp.count, 3);
  assert.equal(caughtUp.coins, 45);
  // The best badge represents the group, and the newest key replays the animation.
  assert.equal(caughtUp.badge.id, "level-25");
  assert.equal(caughtUp.key, 3);
  assert.equal(
    mergeToasts(caughtUp, { ...toast(4, def("x", "gold", 50), 0), test: true })
      .test,
    true,
  );
});
