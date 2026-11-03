import assert from "node:assert/strict";
import test from "node:test";
import {
  attack,
  chooseRune,
  newWorld,
  rescue,
  runeOrder,
  step,
} from "../src/game/morrowglint-core";
const tick = (w: ReturnType<typeof newWorld>, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++)
    step(w, 0.05, { x: 0, z: 0 });
};
test("pulse respects range and cooldown, then unlocks memory after all shadows fall", () => {
  const w = newWorld();
  w.stage = "fight";
  attack(w);
  assert.deepEqual(
    w.shades.map((s) => s.hp),
    [2, 2, 2],
  );
  tick(w, 0.7);
  w.shades.forEach((s) => {
    s.x = w.player.x;
    s.z = w.player.z + 2;
  });
  attack(w);
  assert.deepEqual(
    w.shades.map((s) => s.hp),
    [1, 1, 1],
  );
  attack(w);
  assert.equal(w.shades[0].hp, 1);
  tick(w, 0.7);
  attack(w);
  assert.equal(w.stage, "memory");
  assert.equal(w.memoryTime, 0);
});
test("runes require watching; a mistake restarts the pattern without taking health", () => {
  const w = newWorld();
  w.stage = "memory";
  assert.equal(chooseRune(w, 1), false);
  assert.equal(w.runeIndex, 0);
  tick(w, 4.6);
  chooseRune(w, 0);
  assert.equal(w.mistakes, 1);
  assert.equal(w.health, 5);
  assert.equal(w.memoryTime, 0);
  tick(w, 4.6);
  runeOrder.forEach((i) => chooseRune(w, i));
  assert.equal(w.stage, "rescue");
  assert.equal(rescue(w), false);
  w.player = { x: 0, z: 0 };
  assert.equal(rescue(w), true);
  assert.equal(w.stage, "won");
});
test("movement stays inside the courtyard and normalizes diagonals", () => {
  const a = newWorld(),
    b = newWorld();
  a.stage = b.stage = "rescue";
  a.player = b.player = { x: 0, z: 0 };
  b.player = { x: 0, z: 0 };
  step(a, 0.05, { x: 1, z: 0 });
  step(b, 0.05, { x: 1, z: 1 });
  assert.ok(Math.abs(Math.hypot(b.player.x, b.player.z) - a.player.x) < 0.0001);
  for (let i = 0; i < 200; i++) step(a, 0.05, { x: 1, z: 1 });
  assert.ok(a.player.x <= 10 && a.player.z <= 10);
});
test("contact damage has a grace period and losing freezes gameplay", () => {
  const w = newWorld();
  w.stage = "fight";
  w.shades.forEach((s) => {
    s.x = w.player.x;
    s.z = w.player.z;
  });
  step(w, 0.05, { x: 0, z: 0 });
  assert.equal(w.health, 4);
  tick(w, 0.5);
  assert.equal(w.health, 4);
  tick(w, 8);
  assert.equal(w.stage, "lost");
  const before = { ...w.player };
  step(w, 0.05, { x: 1, z: 1 });
  assert.deepEqual(w.player, before);
  assert.equal(newWorld().health, 5);
});
