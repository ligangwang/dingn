import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOp,
  crowdRadius,
  isGood,
  newLevel,
  progress,
  start,
  stars,
  steer,
  step,
  type World,
} from "../src/game/crowd-core";

/** A simple player: take the better gate, dodge walls, aim at crates. */
function autopilot(w: World) {
  const ahead = w.things
    .filter(
      (t) =>
        t.z > w.z - 0.5 &&
        t.z - w.z < 22 &&
        !(t.kind === "gate" ? t.used : t.dead),
    )
    .sort((a, b) => a.z - b.z)[0];
  if (!ahead) return steer(w, 0);
  if (ahead.kind === "gate")
    return steer(
      w,
      applyOp(w.count, ahead.left) >= applyOp(w.count, ahead.right)
        ? -0.55
        : 0.55,
    );
  if (ahead.kind === "block") {
    const row = w.things.filter(
      (t) => t.kind === "block" && !t.dead && Math.abs(t.z - ahead.z) < 0.1,
    );
    if (ahead.reward) return steer(w, ahead.x);
    const lanes = [-0.62, 0, 0.62].filter(
      (x) => !row.some((t) => t.kind === "block" && t.x === x),
    );
    return steer(w, lanes[0] ?? 0);
  }
  return steer(w, ahead.x);
}
function play(level: number, pilot: (w: World) => void) {
  const w = newLevel(level);
  start(w);
  for (
    let i = 0;
    i < 20 * 60 * 4 && (w.phase === "run" || w.phase === "boss");
    i++
  ) {
    pilot(w);
    step(w, 1 / 60);
    w.events.length = 0;
  }
  return w;
}

test("levels are deterministic and open with a gate that has one good side", () => {
  assert.deepEqual(
    JSON.stringify(newLevel(3).things),
    JSON.stringify(newLevel(3).things),
  );
  for (let lv = 1; lv <= 20; lv++) {
    const first = newLevel(lv).things[0];
    assert.equal(first.kind, "gate");
    if (first.kind === "gate")
      assert.notEqual(isGood(first.left), isGood(first.right));
  }
});

test("gate maths never goes below zero or above the cap", () => {
  assert.equal(applyOp(10, { op: "+", n: 5 }), 15);
  assert.equal(applyOp(10, { op: "-", n: 50 }), 0);
  assert.equal(applyOp(10, { op: "x", n: 3 }), 30);
  assert.equal(applyOp(9, { op: "/", n: 2 }), 4);
  assert.equal(applyOp(600, { op: "x", n: 2 }), 999);
});

test("a sensible player clears the first fifteen levels", () => {
  for (let lv = 1; lv <= 15; lv++) {
    const w = play(lv, autopilot);
    assert.equal(
      w.phase,
      "won",
      `level ${lv} ended ${w.phase} at ${progress(w)}`,
    );
    assert.ok(stars(w) >= 1);
  }
});

test("always taking the worse gate and standing still loses", () => {
  let losses = 0;
  for (let lv = 1; lv <= 10; lv++) {
    const w = play(lv, (w) => {
      const gate = w.things.find((t) => t.kind === "gate" && !t.used);
      if (gate && gate.kind === "gate")
        steer(
          w,
          applyOp(w.count, gate.left) < applyOp(w.count, gate.right)
            ? -0.55
            : 0.55,
        );
    });
    if (w.phase === "lost") losses++;
  }
  assert.ok(losses >= 8, `only ${losses} losses`);
});

test("steering is clamped to the road and the squad widens as it grows", () => {
  const w = newLevel(1);
  steer(w, 5);
  assert.ok(w.targetX < 1);
  assert.ok(crowdRadius(200) > crowdRadius(10));
  start(w);
  step(w, 0.5);
  assert.ok(w.z > 0 && w.x > 0);
  assert.ok(w.shotsFired > 0);
});
