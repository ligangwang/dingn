// Crowd Rush progress: the free-level limit, and syncing the player's level
// to their dingn account (through the game SDK) so it follows them across
// devices.
import type { DingnGame } from "../../../packages/game-sdk/dingn-sdk.js";

/** Levels anyone can play without an account. */
export const FREE_LEVELS = 5;
const MAX_LEVEL = 9999;

export type CrowdProgress = { level: number; best: number };

const clamp = (value: unknown, min: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(MAX_LEVEL, Math.max(min, n)) : min;
};

/** A level beyond the free ones needs a signed-in player. */
export const needsSignIn = (level: number, signedIn: boolean) =>
  !signedIn && level > FREE_LEVELS;

/** Reads progress from loosely typed storage (localStorage or Firestore). */
export function parseProgress(level: unknown, best: unknown): CrowdProgress {
  const b = clamp(best, 0);
  // The level to play next is always past the best level cleared.
  return { level: Math.max(clamp(level, 1), b + 1), best: b };
}

/** Combines two saves, keeping the furthest progress from either. */
export function mergeProgress(
  a: CrowdProgress,
  b: CrowdProgress,
): CrowdProgress {
  return parseProgress(Math.max(a.level, b.level), Math.max(a.best, b.best));
}

export const sameProgress = (a: CrowdProgress, b: CrowdProgress) =>
  a.level === b.level && a.best === b.best;

/** What is saved to the player's account through the dingn SDK. */
export const progressRecord = (p: CrowdProgress) => ({
  level: p.level,
  best: p.best,
});

type Saved = { level?: unknown; best?: unknown } | null;

export async function readCrowdProgress(
  sdk: DingnGame,
): Promise<CrowdProgress> {
  const data = (await sdk.progress.load()) as Saved;
  return parseProgress(data?.level, data?.best);
}

export async function saveCrowdProgress(sdk: DingnGame, p: CrowdProgress) {
  await sdk.progress.save(progressRecord(p));
}
