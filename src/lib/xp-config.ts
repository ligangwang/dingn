export type GameId = "warmup" | "logic" | "decisions";
/** Mirrors MIN_DURATION_MS in scripts/game-core.mjs, plus a small margin. */
export const MIN_PLAY_MS: Record<GameId, number> = {
  warmup: 3300,
  logic: 8300,
  decisions: 8300,
};
