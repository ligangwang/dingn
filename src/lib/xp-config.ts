export type GameId =
  "warmup" | "logic" | "decisions" | "ladder" | "ladder_daily";
/** Mirrors MIN_DURATION_MS in scripts/game-core.mjs, plus a small margin. */
export const MIN_PLAY_MS: Record<GameId, number> = {
  warmup: 3300,
  ladder: 18300,
  ladder_daily: 18300,
  logic: 8300,
  decisions: 8300,
};
