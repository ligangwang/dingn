import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOp,
  BOSS_REACH,
  BOSS_STOP,
  crowdRadius,
  newLevel,
  progress,
  START_COUNT,
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
        t.kind !== "monster" &&
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

test("levels are deterministic and open with a gate whose doors differ", () => {
  assert.deepEqual(
    JSON.stringify(newLevel(3).things),
    JSON.stringify(newLevel(3).things),
  );
  for (let lv = 1; lv <= 20; lv++) {
    const first = newLevel(lv).things[0];
    assert.equal(first.kind, "gate");
    if (first.kind === "gate")
      assert.notEqual(
        applyOp(START_COUNT, first.left),
        applyOp(START_COUNT, first.right),
      );
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

test("always taking the worse door leaves a much smaller squad", () => {
  let sensible = 0;
  let careless = 0;
  for (let lv = 1; lv <= 10; lv++) {
    sensible += play(lv, autopilot).best;
    const w = play(lv, (w) => {
      autopilot(w);
      const gate = w.things.find((t) => t.kind === "gate" && !t.used);
      if (gate && gate.kind === "gate" && gate.z - w.z < 22)
        steer(
          w,
          applyOp(w.count, gate.left) < applyOp(w.count, gate.right)
            ? -0.55
            : 0.55,
        );
    });
    careless += w.best;
  }
  assert.ok(careless < sensible * 0.5, `${careless} vs ${sensible}`);
});

test("a squad that never steers loses every one of the first fifteen levels", () => {
  for (let lv = 1; lv <= 15; lv++) {
    const w = play(lv, () => {});
    assert.equal(w.phase, "lost", `level ${lv} ended ${w.phase}`);
  }
});

test("monsters charge at the squad and the boss stomps toward it", () => {
  const w = newLevel(2);
  w.things = [];
  w.things.push({
    kind: "monster",
    id: 1,
    z: 30,
    x: 0.7,
    hp: 99,
    maxHp: 99,
    big: false,
    bite: 1,
    reward: 0,
    speed: 4.5,
    minion: false,
    dead: false,
  });
  start(w);
  w.speed = 0;
  for (let i = 0; i < 60; i++) step(w, 1 / 60);
  const m = w.things[0];
  assert.ok(m.kind === "monster" && m.z < 26 && m.x < 0.7, "monster homes in");

  const b = newLevel(2);
  b.things = [];
  b.count = 500;
  b.boss.hp = 99999;
  b.z = b.boss.z - BOSS_STOP;
  b.phase = "boss";
  const from = b.boss.z;
  for (let i = 0; i < 60 * 3; i++) step(b, 1 / 60);
  assert.ok(b.boss.z < from - 2, "boss walks toward the squad");
  for (let i = 0; i < 60 * 20; i++) step(b, 1 / 60);
  assert.ok(b.boss.z - b.z <= BOSS_REACH + 0.01, "boss reaches the squad");
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

test("monsters roam every level, die to gunfire and bite on contact", () => {
  let withBrutes = 0;
  for (let lv = 1; lv <= 10; lv++) {
    const monsters = newLevel(lv).things.filter((t) => t.kind === "monster");
    assert.ok(monsters.length >= 8, `level ${lv} has ${monsters.length}`);
    if (monsters.some((m) => m.kind === "monster" && m.big)) withBrutes++;
  }
  assert.ok(withBrutes >= 7, `brutes in only ${withBrutes} levels`);
  const w = newLevel(1);
  w.things = [];
  w.things.push({
    kind: "monster",
    id: 1,
    z: 12,
    x: 0,
    hp: 3,
    maxHp: 3,
    big: false,
    bite: 1,
    reward: 1,
    speed: 0,
    minion: false,
    dead: false,
  });
  start(w);
  const before = w.count;
  for (let i = 0; i < 60; i++) step(w, 1 / 60);
  assert.equal(w.things[0].kind === "monster" && w.things[0].dead, true);
  assert.equal(w.count, before + 1);

  const v = newLevel(1);
  v.things = [
    {
      kind: "monster",
      id: 1,
      z: 0.3,
      x: 0,
      hp: 99,
      maxHp: 99,
      big: true,
      bite: 3,
      reward: 0,
      speed: 0,
      minion: false,
      dead: false,
    },
  ];
  v.count = 10;
  start(v);
  step(v, 1 / 60);
  assert.equal(v.count, 7);
});

test("the boss summons minions on its way in, then stops once it is close", () => {
  const w = newLevel(3);
  w.things = [];
  w.count = 900;
  w.z = w.boss.z - 14;
  w.phase = "boss";
  w.boss.hp = 99999;
  let far = 0;
  let near = 0;
  for (let i = 0; i < 60 * 14; i++) {
    step(w, 1 / 60);
    const n = w.events.filter((e) => e.type === "summon").length;
    if (w.boss.z - w.z > BOSS_REACH + 5) far += n;
    else near += n;
    w.events.length = 0;
  }
  assert.ok(far >= 2, `${far} summons on the way in`);
  assert.equal(near, 0);
});

test("gate pairs are close calls whose winner depends on the squad size", () => {
  let flips = 0;
  let pairs = 0;
  for (let lv = 1; lv <= 10; lv++)
    for (const g of newLevel(lv).things) {
      if (g.kind !== "gate") continue;
      pairs++;
      const small = applyOp(5, g.left) > applyOp(5, g.right);
      const big = applyOp(200, g.left) > applyOp(200, g.right);
      if (small !== big) flips++;
    }
  assert.ok(flips / pairs > 0.3, `${flips} of ${pairs} pairs flip`);
});
