export type GameId = "warmup" | "ladder" | "ladder_daily";
/** Mirrors MIN_DURATION_MS in scripts/game-core.mjs, plus a small margin. */
export const MIN_PLAY_MS: Record<GameId, number> = {
  warmup: 3300,
  ladder: 9300,
  ladder_daily: 9300,
};
