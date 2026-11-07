// Crowd Rush progress: the free-level limit, and syncing the player's level
// to their dingn account so it follows them across devices.
import { database, doc, getDoc, setDoc } from "./database";

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

/** Fields stored on the player's `accounts` document. */
export const progressRecord = (p: CrowdProgress) => ({
  crowd_level: p.level,
  crowd_best: p.best,
});

export async function readCrowdProgress(uid: string): Promise<CrowdProgress> {
  const data = (await getDoc(doc(database, "accounts", uid))).data();
  return parseProgress(data.crowd_level, data.crowd_best);
}

export async function saveCrowdProgress(uid: string, p: CrowdProgress) {
  // setDoc only updates the fields it is given, so the profile is untouched.
  await setDoc(doc(database, "accounts", uid), progressRecord(p), {
    merge: true,
  });
}
