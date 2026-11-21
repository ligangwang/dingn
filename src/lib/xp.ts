import type { GameId } from "./xp-config";
import type { EarnedBadge } from "./rewards";
import type { StageId } from "@/data/kingdom.mjs";
export { MIN_PLAY_MS, type GameId } from "./xp-config";
export type PlayerStats = {
  level: number;
  xp: number;
  floor: number;
  next: number;
  streak: number;
  best: Partial<Record<GameId, number>>;
  /** The player's nickname: a new player's default one, "Player<number>". */
  name?: string | null;
  /** The ten digits naming the player's public page, /player/<number>/. */
  number?: string | null;
};
export type PlayResult = {
  score: number;
  max: number;
  xpGained: number;
  capped: boolean;
  newBest: boolean;
  streak: number;
  level: number;
  xp: number;
  floor: number;
  next: number;
};
export type LeaderboardEntry = {
  name: string;
  xp: number;
  level: number;
  /** The player's account id, sent only to admins. */
  uid?: string;
  /** Their public number, for their page; missing until they next visit. */
  number?: string;
  /** Their avatar choice (src/lib/models.ts avatarPresets). */
  avatar?: string;
};
/** What anyone may see of a player, on their page /player/<number>/. */
export type PublicPlayer = {
  number: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  floor: number;
  next: number;
  streak: number;
  /** Newest first. */
  badges: Omit<EarnedBadge, "at" | "coins">[];
  /** Their kingdom as built, or null below the level that founds one. */
  kingdom: {
    stage: StageId;
    size: number;
    hall: StageId;
    tiles: Record<string, string>;
  } | null;
};

export class XpError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

// Same-origin POST with the HttpOnly session cookie, like the rest of the
// dingn API (see src/lib/api.ts); the server reads the player from it.
async function call<T>(path: string, body: unknown = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Dingn-Request": "1" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new XpError("XP is unavailable right now.", "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new XpError(
      data.message || "XP is unavailable right now.",
      data.error || "unavailable",
    );
  return data as T;
}

export const startPlay = <C>(game: GameId) =>
  call<{ playId: string; challenge: C }>("/api/play/start", { game });
export const finishPlay = (playId: string, answers: unknown) =>
  call<PlayResult>("/api/play/finish", { playId, answers });
export const fetchStats = () => call<PlayerStats>("/api/me");
/**
 * Changes the player's nickname. Nicknames are unique: the server refuses
 * one another player holds (code "nickname_taken").
 */
export const saveNickname = (name: string) =>
  call<{ name: string }>("/api/me/nickname", { name });
/** The top players; `shown` is false while too few players have XP. */
export const fetchLeaderboard = () =>
  call<{ shown: boolean; entries: LeaderboardEntry[] }>("/api/leaderboard");
/** A player's public page (code "no_player" when no player has the number). */
export const fetchPlayer = (number: string) =>
  call<PublicPlayer>("/api/player", { number });
