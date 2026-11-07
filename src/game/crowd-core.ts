/**
 * Crowd Rush — rules for a crowd-runner shooter.
 *
 * The squad runs forward along a track. The player steers it left and
 * right through number gates (+, −, ×, ÷), the squad fires automatically,
 * shoots open supply crates and walls, and fights rival squads head-on.
 * A boss waits at the end of every level.
 *
 * Everything here is pure and seeded so it can be tested without a canvas.
 * Units: x is the lateral road position in [-1, 1]; z is metres along the
 * track.
 */
export type Op = "+" | "-" | "x" | "/";
export type GateSide = { op: Op; n: number };
export type Gate = {
  kind: "gate";
  id: number;
  z: number;
  left: GateSide;
  right: GateSide;
  used: boolean;
  chosen?: "left" | "right";
};
export type Block = {
  kind: "block";
  id: number;
  z: number;
  x: number;
  w: number;
  hp: number;
  maxHp: number;
  /** Crates pay out recruits when shot open; walls only block. */
  reward: number;
  dead: boolean;
};
export type Squad = {
  kind: "squad";
  id: number;
  z: number;
  x: number;
  count: number;
  start: number;
  dead: boolean;
};
export type Thing = Gate | Block | Squad;
export type Boss = {
  z: number;
  hp: number;
  maxHp: number;
  /** Seconds until the next ground slam. */
  slam: number;
  slamEvery: number;
};
export type Bullet = { x: number; z: number; dead: boolean };
export type Phase = "ready" | "run" | "boss" | "won" | "lost";
export type GameEvent =
  | {
      type: "gate";
      side: "left" | "right";
      good: boolean;
      before: number;
      after: number;
      z: number;
      x: number;
    }
  | { type: "hit"; x: number; z: number; target: "block" | "squad" | "boss" }
  | { type: "crate"; x: number; z: number; reward: number }
  | { type: "wall"; x: number; z: number; lost: number }
  | { type: "clash"; x: number; z: number; lost: number }
  | { type: "slam"; lost: number }
  | { type: "won" }
  | { type: "lost" };
export type World = {
  level: number;
  phase: Phase;
  length: number;
  z: number;
  x: number;
  targetX: number;
  count: number;
  best: number;
  speed: number;
  things: Thing[];
  boss: Boss;
  bullets: Bullet[];
  fireClock: number;
  time: number;
  shotsFired: number;
  events: GameEvent[];
  random: () => number;
};

export const START_COUNT = 8;
export const MAX_COUNT = 999;
export const RUN_SPEED = 10;
export const BULLET_SPEED = 46;
export const BULLET_RANGE = 34;
/** Distance in front of the boss where the squad halts and opens fire. */
export const BOSS_STOP = 14;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function applyOp(count: number, side: GateSide) {
  switch (side.op) {
    case "+":
      return Math.min(MAX_COUNT, count + side.n);
    case "-":
      return Math.max(0, count - side.n);
    case "x":
      return Math.min(MAX_COUNT, count * side.n);
    case "/":
      return Math.max(0, Math.floor(count / side.n));
  }
}
export const opLabel = (s: GateSide) =>
  `${{ "+": "+", "-": "−", x: "×", "/": "÷" }[s.op]}${s.n}`;
export const isGood = (s: GateSide) => s.op === "+" || s.op === "x";

/** How wide the squad is on the road, given its head count. */
export function crowdRadius(count: number) {
  return Math.min(0.42, 0.07 + Math.sqrt(Math.max(1, count)) * 0.028);
}
export function squadRadius(count: number) {
  return Math.min(0.4, 0.07 + Math.sqrt(Math.max(1, count)) * 0.026);
}
/** Shots per second: a bigger squad fires faster. */
export function fireRate(count: number) {
  return Math.min(40, 3 + Math.sqrt(count) * 2.6);
}

/**
 * Builds a level. Difficulty follows a rough estimate of how big a squad a
 * reasonable player will have at each point, so every level is winnable by
 * picking the better gate and shooting what is in front of you.
 */
export function newLevel(level: number): World {
  const lv = Math.max(1, Math.floor(level));
  const random = rng(lv * 7919 + 17);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const int = (lo: number, hi: number) =>
    lo + Math.floor(random() * (hi - lo + 1));
  const sections = 7 + Math.min(lv, 8);
  const things: Thing[] = [];
  let z = 34;
  let expected = START_COUNT;
  let id = 0;
  let lastKind = "";
  for (let i = 0; i < sections; i++) {
    // Always open with a gate, never repeat the same obstacle twice in a row.
    const options =
      i === 0
        ? ["gate"]
        : ["gate", "gate", "crates", "walls", "squad"].filter(
            (k) => k !== lastKind,
          );
    const kind = pick(options);
    lastKind = kind;
    if (kind === "gate") {
      const good: GateSide = pick<GateSide>(
        expected < 30
          ? [
              { op: "+", n: int(8, 20) },
              { op: "x", n: 2 },
              { op: "+", n: int(10, 25) },
            ]
          : expected < 120
            ? [
                { op: "x", n: 2 },
                { op: "+", n: int(20, 50) },
                { op: "x", n: 2 },
              ]
            : [
                { op: "+", n: int(30, 80) },
                { op: "x", n: 2 },
              ],
      );
      const bad: GateSide = pick<GateSide>([
        { op: "-", n: int(3, Math.max(5, Math.floor(expected * 0.5))) },
        { op: "/", n: 2 },
        { op: "/", n: 3 },
        { op: "-", n: int(2, 8) },
      ]);
      const goodLeft = random() < 0.5;
      things.push({
        kind: "gate",
        id: id++,
        z,
        left: goodLeft ? good : bad,
        right: goodLeft ? bad : good,
        used: false,
      });
      expected = applyOp(expected, good);
      z += 30;
    } else if (kind === "crates") {
      // a row of crates always leaves one lane open to slip past
      const open = int(0, 2);
      const lanes = [-0.62, 0, 0.62].filter(
        (_, i) => i !== open && random() < 0.85,
      );
      if (!lanes.length) lanes.push(open === 1 ? 0.62 : 0);
      for (const x of lanes) {
        const hp =
          Math.max(4, Math.round(expected * (0.18 + random() * 0.12))) + lv;
        const reward = Math.max(4, Math.round(hp * 0.7));
        things.push({
          kind: "block",
          id: id++,
          z,
          x,
          w: 0.22,
          hp,
          maxHp: hp,
          reward,
          dead: false,
        });
      }
      expected += 6;
      z += 26;
    } else if (kind === "walls") {
      const gap = pick([-0.62, 0, 0.62]);
      for (const x of [-0.62, 0, 0.62]) {
        if (x === gap) continue;
        const hp = int(10, 16) + lv * 6;
        things.push({
          kind: "block",
          id: id++,
          z,
          x,
          w: 0.27,
          hp,
          maxHp: hp,
          reward: 0,
          dead: false,
        });
      }
      z += 26;
    } else {
      const count = Math.max(
        4,
        Math.round(expected * (0.35 + random() * 0.25)) + lv * 2,
      );
      things.push({
        kind: "squad",
        id: id++,
        z: z + 8,
        x: (random() * 2 - 1) * 0.45,
        count,
        start: count,
        dead: false,
      });
      expected = Math.max(START_COUNT, expected - Math.floor(count * 0.5));
      z += 34;
    }
  }
  const length = z + 30;
  const bossHp = Math.round(fireRate(expected) * (9 + Math.min(lv, 20) * 0.6));
  return {
    level: lv,
    phase: "ready",
    length,
    z: 0,
    x: 0,
    targetX: 0,
    count: START_COUNT,
    best: START_COUNT,
    speed: RUN_SPEED,
    things,
    boss: {
      z: length,
      hp: bossHp,
      maxHp: bossHp,
      slam: 2.2,
      slamEvery: Math.max(1.1, 2 - lv * 0.06),
    },
    bullets: [],
    fireClock: 0,
    time: 0,
    shotsFired: 0,
    events: [],
    random,
  };
}

export function start(w: World) {
  if (w.phase === "ready") w.phase = "run";
}

/** Set where the player wants the squad to be, in road units. */
export function steer(w: World, x: number) {
  const limit = 1 - crowdRadius(w.count) * 0.6;
  w.targetX = Math.max(-limit, Math.min(limit, x));
}

function lose(w: World) {
  w.count = 0;
  w.phase = "lost";
  w.bullets = [];
  w.events.push({ type: "lost" });
}

/** Advances the world by dt seconds. Events since the last call are in w.events. */
export function step(w: World, dt: number) {
  if (w.phase !== "run" && w.phase !== "boss") return;
  w.time += dt;

  // steering eases toward the target; a big squad is a little slower to turn
  const r = crowdRadius(w.count);
  const limit = 1 - r * 0.6;
  w.targetX = Math.max(-limit, Math.min(limit, w.targetX));
  const turn = 3.4 - r * 2;
  const dx = w.targetX - w.x;
  w.x += Math.sign(dx) * Math.min(Math.abs(dx), turn * dt);

  const prevZ = w.z;
  if (w.phase === "run") {
    w.z = Math.min(w.z + w.speed * dt, w.boss.z - BOSS_STOP);
    if (w.z >= w.boss.z - BOSS_STOP) w.phase = "boss";
  }

  // rival squads march toward you once they're close
  for (const t of w.things)
    if (t.kind === "squad" && !t.dead && t.z - w.z < 26) {
      t.z -= 2.5 * dt;
      t.x += Math.sign(w.x - t.x) * Math.min(Math.abs(w.x - t.x), 0.25 * dt);
    }

  // gates
  for (const t of w.things) {
    if (t.kind !== "gate" || t.used || t.z > w.z || t.z <= prevZ - 0.001)
      continue;
    t.used = true;
    t.chosen = w.x < 0 ? "left" : "right";
    const side = t[t.chosen];
    const before = w.count;
    w.count = applyOp(w.count, side);
    w.events.push({
      type: "gate",
      side: t.chosen,
      good: isGood(side),
      before,
      after: w.count,
      z: t.z,
      x: t.chosen === "left" ? -0.5 : 0.5,
    });
    if (w.count <= 0) return lose(w);
  }

  // shooting
  w.fireClock += dt * fireRate(w.count);
  while (w.fireClock >= 1) {
    w.fireClock -= 1;
    w.shotsFired++;
    w.bullets.push({
      x: w.x + (w.random() * 2 - 1) * r * 0.7,
      z: w.z + 0.8,
      dead: false,
    });
  }
  for (const b of w.bullets) {
    const from = b.z;
    b.z += BULLET_SPEED * dt;
    if (b.z - w.z > BULLET_RANGE) {
      b.dead = true;
      continue;
    }
    let hit: Thing | "boss" | undefined;
    let hitZ = Infinity;
    for (const t of w.things) {
      if (t.kind === "gate" || t.dead) continue;
      if (t.z < from - 0.5 || t.z > b.z + 0.5 || t.z >= hitZ) continue;
      const half = t.kind === "block" ? t.w : squadRadius(t.count);
      if (Math.abs(b.x - t.x) <= half) {
        hit = t;
        hitZ = t.z;
      }
    }
    if (!hit && w.boss.hp > 0 && b.z >= w.boss.z - 1.5 && Math.abs(b.x) < 0.75)
      hit = "boss";
    if (!hit) continue;
    b.dead = true;
    if (hit === "boss") {
      w.boss.hp = Math.max(0, w.boss.hp - 1);
      w.events.push({ type: "hit", x: b.x, z: w.boss.z, target: "boss" });
      if (w.boss.hp === 0) {
        w.phase = "won";
        w.bullets = [];
        w.events.push({ type: "won" });
        return;
      }
    } else if (hit.kind === "block") {
      hit.hp--;
      w.events.push({ type: "hit", x: b.x, z: hit.z, target: "block" });
      if (hit.hp <= 0) {
        hit.dead = true;
        if (hit.reward) {
          w.count = Math.min(MAX_COUNT, w.count + hit.reward);
          w.events.push({
            type: "crate",
            x: hit.x,
            z: hit.z,
            reward: hit.reward,
          });
        }
      }
    } else if (hit.kind === "squad") {
      hit.count--;
      w.events.push({ type: "hit", x: b.x, z: hit.z, target: "squad" });
      if (hit.count <= 0) hit.dead = true;
    }
  }
  w.bullets = w.bullets.filter((b) => !b.dead);

  // collisions with blocks and squads
  const rr = crowdRadius(w.count);
  for (const t of w.things) {
    if (t.kind === "gate" || t.dead || t.z > w.z + 0.6) continue;
    // anything more than a body length behind the squad has been passed
    if (t.z < w.z - 0.8) {
      t.dead = true;
      continue;
    }
    if (t.kind === "block") {
      if (Math.abs(t.x - w.x) < t.w + rr * 0.8) {
        const lost = Math.min(w.count, Math.ceil(t.hp / 2));
        w.count -= lost;
        t.dead = true;
        w.events.push({ type: "wall", x: t.x, z: t.z, lost });
      }
    } else {
      if (Math.abs(t.x - w.x) < squadRadius(t.count) + rr) {
        const lost = Math.min(w.count, t.count);
        w.count -= lost;
        t.count -= lost;
        t.dead = true;
        w.events.push({ type: "clash", x: t.x, z: t.z, lost });
      }
    }
    if (w.count <= 0) return lose(w);
  }

  // the boss slams the ground once you reach it
  if (w.phase === "boss") {
    w.boss.slam -= dt;
    if (w.boss.slam <= 0) {
      w.boss.slam += w.boss.slamEvery;
      const lost = Math.min(w.count, 2 + Math.ceil(w.count * 0.06));
      w.count -= lost;
      w.events.push({ type: "slam", lost });
      if (w.count <= 0) return lose(w);
    }
  }
  w.best = Math.max(w.best, w.count);
}

/** Stars for a cleared level: based on how much of the squad survived. */
export function stars(w: World) {
  if (w.phase !== "won") return 0;
  const share = w.count / Math.max(1, w.best);
  return share > 0.6 ? 3 : share > 0.3 ? 2 : 1;
}

export function progress(w: World) {
  return Math.min(1, w.z / Math.max(1, w.boss.z - BOSS_STOP));
}
