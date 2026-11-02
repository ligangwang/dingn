import type { GameId } from "./xp-config";
export { MIN_PLAY_MS, type GameId } from "./xp-config";
export type PlayerStats = {
  level: number;
  xp: number;
  floor: number;
  next: number;
  streak: number;
  best: Partial<Record<GameId, number>>;
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
export type LeaderboardEntry = { name: string; xp: number; level: number };

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
export const fetchLeaderboard = () =>
  call<{ entries: LeaderboardEntry[] }>("/api/leaderboard").then(
    (r) => r.entries,
  );
