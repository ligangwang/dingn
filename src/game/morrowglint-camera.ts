import type { Point, World } from "./morrowglint-core";
export function combatTarget(world: World): number {
  let result = -1,
    nearest = 7 * 7;
  if (world.stage !== "fight") return result;
  world.shades.forEach((s, i) => {
    const d = (s.x - world.player.x) ** 2 + (s.z - world.player.z) ** 2;
    if (s.hp > 0 && d < nearest) {
      nearest = d;
      result = i;
    }
  });
  return result;
}
/** Stable world-aligned shoulder view: movement directions never flip with a target change. */
export function cameraFrame(
  player: Point,
  target: Point | null,
  aspect: number,
  close: boolean,
) {
  const portrait = aspect < 1;
  const focus = {
    x: player.x + (target ? (target.x - player.x) * 0.4 : 0),
    y: 1.1,
    z: player.z + (target ? (target.z - player.z) * 0.4 : -1.5),
  };
  const distance = close ? (portrait ? 12.5 : 7.5) : portrait ? 18 : 14;
  return {
    focus,
    eye: {
      x: focus.x + (close ? 1.1 : 0),
      y: close ? (portrait ? 6 : 4.2) : 8.5,
      z: focus.z + distance,
    },
    fov: portrait ? 62 : 52,
  };
}
