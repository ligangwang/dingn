// Challenges as threads (scripts/challenges.mjs): a player's score that
// anyone can take on, with every result posted under it, highest first.
import { api } from "./api";
import type { ChallengeUnit } from "@/data/challenge.mjs";

/** One result under a challenge; `name` is null for a guest's own score. */
export type ThreadResult = {
  name: string | null;
  score: number;
  mine?: boolean;
};
export type Thread = {
  results: ThreadResult[];
  players: number;
  /** Closed by its maker: it takes no more results. */
  closed: boolean;
  /** Opened by the signed-in player who made it: they can close or delete it. */
  owner: boolean;
};

/** An open challenge, as a game's list shows it. */
export type OpenChallenge = {
  game: string;
  id: string;
  mode: string;
  score: number;
  unit: ChallengeUnit;
  name: string | null;
  players: number;
  top: { name: string | null; score: number } | null;
  createdAt: string;
};

/** What posting a result answers. */
export type PostedResult = {
  best: number;
  rank: number | null;
  players: number;
  improved: boolean;
  beat: boolean;
  test?: boolean;
};

/** A saved challenge's results, from what /api/challenges/<id> answered. */
export function threadOf(found: unknown): Thread | null {
  const raw = found as {
    results?: unknown;
    players?: unknown;
    closed?: unknown;
    mine?: unknown;
  } | null;
  if (!raw || !Array.isArray(raw.results)) return null;
  const results = raw.results.filter(
    (r): r is ThreadResult => !!r && typeof r.score === "number",
  );
  return {
    results,
    players: typeof raw.players === "number" ? raw.players : results.length,
    closed: raw.closed === true,
    owner: raw.mine === true,
  };
}

/** The open challenges of one game, or of every game, newest first. */
export async function fetchOpenChallenges(
  game?: string,
): Promise<OpenChallenge[]> {
  const response = await fetch(
    `/api/challenges${game ? `?game=${encodeURIComponent(game)}` : ""}`,
    { credentials: "same-origin" },
  );
  if (!response.ok) throw new Error("unavailable");
  const { challenges } = await response.json();
  return Array.isArray(challenges) ? challenges : [];
}

export const fetchThread = (id: string) =>
  fetch(`/api/challenges/${id}`, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then(threadOf)
    .catch(() => null);

export const postChallengeResult = (id: string, score: number) =>
  api<PostedResult>(`/api/challenges/${id}/results`, { score });

/** Closes the player's own challenge: it takes no more results. */
export const closeChallenge = (id: string) =>
  api<{ closed: true }>(`/api/challenges/${id}/close`);
/** Deletes the player's own challenge: its link no longer opens it. */
export const deleteChallenge = (id: string) =>
  api<{ deleted: true }>(`/api/challenges/${id}/delete`);

// A signed-out player's finished challenge round, kept while they sign in so
// their score is posted when they come back to the challenge.
const PENDING = "dingn.challenge.pending.v1";
export function keepPendingResult(id: string, score: number) {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ id, score }));
  } catch {
    // Storage blocked: they play the round again after signing in.
  }
}
/** The score kept for the challenge `id`, taken out of the store. */
export function takePendingResult(id: string): number | null {
  try {
    const kept = JSON.parse(sessionStorage.getItem(PENDING) ?? "null");
    if (kept?.id !== id) return null;
    sessionStorage.removeItem(PENDING);
    return Number.isInteger(kept.score) && kept.score >= 0 ? kept.score : null;
  } catch {
    return null;
  }
}
