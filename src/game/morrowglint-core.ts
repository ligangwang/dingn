export type Point = { x: number; z: number };
export type Stage = "ready" | "fight" | "memory" | "rescue" | "won" | "lost";
export type Shade = Point & { hp: number; hit: number };
export type World = {
  stage: Stage;
  player: Point;
  target: Point | null;
  health: number;
  shades: Shade[];
  cooldown: number;
  invulnerable: number;
  pulse: number;
  time: number;
  memoryTime: number;
  runeIndex: number;
  mistakes: number;
};
export const runes: Point[] = [
  { x: -5, z: -4 },
  { x: 5, z: -4 },
  { x: 0, z: 5 },
];
export const runeOrder = [1, 0, 2];
export function newWorld(): World {
  return {
    stage: "ready",
    player: { x: 0, z: 8 },
    target: null,
    health: 5,
    shades: [
      { x: -7, z: -5, hp: 2, hit: 0 },
      { x: 7, z: -5, hp: 2, hit: 0 },
      { x: 0, z: -8, hp: 2, hit: 0 },
    ],
    cooldown: 0,
    invulnerable: 0,
    pulse: 0,
    time: 0,
    memoryTime: 0,
    runeIndex: 0,
    mistakes: 0,
  };
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function attack(w: World) {
  if (w.stage !== "fight" || w.cooldown > 0) return;
  w.cooldown = 0.65;
  w.pulse = 0.5;
  for (const s of w.shades)
    if (s.hp > 0 && distance(s, w.player) < 3.8) {
      s.hp--;
      s.hit = 0.25;
    }
  if (w.shades.every((s) => s.hp === 0)) {
    w.stage = "memory";
    w.memoryTime = 0;
    w.target = null;
  }
}
export function chooseRune(w: World, index: number) {
  if (w.stage !== "memory" || w.memoryTime < 4.5) return false;
  if (index !== runeOrder[w.runeIndex]) {
    w.runeIndex = 0;
    w.memoryTime = 0;
    w.mistakes++;
    return false;
  }
  w.runeIndex++;
  if (w.runeIndex === 3) w.stage = "rescue";
  return true;
}
export function rescue(w: World) {
  if (w.stage === "rescue" && distance(w.player, { x: 0, z: 0 }) < 2.5) {
    w.stage = "won";
    w.target = null;
    return true;
  }
  return false;
}
export function step(w: World, dt: number, input: Point) {
  if (!["fight", "memory", "rescue", "won"].includes(w.stage)) return;
  dt = Math.max(0, Math.min(dt, 0.05));
  w.time += dt;
  w.cooldown = Math.max(0, w.cooldown - dt);
  w.invulnerable = Math.max(0, w.invulnerable - dt);
  w.pulse = Math.max(0, w.pulse - dt);
  if (w.stage === "memory") w.memoryTime += dt;
  let dx = input.x,
    dz = input.z;
  if (dx || dz) w.target = null;
  else if (w.target) {
    dx = w.target.x - w.player.x;
    dz = w.target.z - w.player.z;
    if (Math.hypot(dx, dz) < 0.15) {
      w.target = null;
      dx = dz = 0;
    }
  }
  const length = Math.hypot(dx, dz);
  if (length) {
    w.player.x = Math.max(
      -10,
      Math.min(10, w.player.x + (dx / length) * 5 * dt),
    );
    w.player.z = Math.max(
      -10,
      Math.min(10, w.player.z + (dz / length) * 5 * dt),
    );
  }
  for (const s of w.shades) {
    s.hit = Math.max(0, s.hit - dt);
    if (s.hp <= 0 || w.stage !== "fight") continue;
    const d = distance(s, w.player);
    if (d > 0.9) {
      s.x += ((w.player.x - s.x) / d) * 1.55 * dt;
      s.z += ((w.player.z - s.z) / d) * 1.55 * dt;
    }
    if (d < 1.2 && w.invulnerable === 0) {
      w.health--;
      w.invulnerable = 1.5;
      if (w.health === 0) {
        w.stage = "lost";
        w.target = null;
      }
    }
  }
}
