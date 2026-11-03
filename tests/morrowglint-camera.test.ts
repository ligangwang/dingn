import assert from "node:assert/strict";
import test from "node:test";
import { cameraFrame, combatTarget } from "../src/game/morrowglint-camera";
import { newWorld } from "../src/game/morrowglint-core";
test("combat focus ignores defeated and distant shadows", () => {
  const w = newWorld();
  w.stage = "fight";
  assert.equal(combatTarget(w), -1);
  w.shades[0] = { x: 0, z: 6, hp: 1, hit: 0 };
  w.shades[1] = { x: 0, z: 7, hp: 0, hit: 0 };
  assert.equal(combatTarget(w), 0);
  w.stage = "memory";
  assert.equal(combatTarget(w), -1);
});
test("close combat moves in while keeping player and enemy framing stable", () => {
  const p = { x: 2, z: 4 },
    enemy = { x: 4, z: 0 };
  const close = cameraFrame(p, enemy, 1.7, true),
    wide = cameraFrame(p, enemy, 1.7, false);
  assert.ok(close.eye.z - close.focus.z < wide.eye.z - wide.focus.z);
  assert.ok(close.focus.x >= p.x && close.focus.x <= enemy.x);
  assert.ok(close.focus.z >= enemy.z && close.focus.z <= p.z);
  const mobile = cameraFrame(p, enemy, 0.55, true);
  assert.ok(mobile.fov > close.fov);
  assert.ok(mobile.eye.z - mobile.focus.z > close.eye.z - close.focus.z);
  assert.ok(close.eye.z > close.focus.z);
  assert.ok(wide.eye.z > wide.focus.z);
});
