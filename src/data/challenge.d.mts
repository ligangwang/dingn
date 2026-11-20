export type ChallengeUnit =
  "points" | "digits" | "cards" | "levels" | "stars" | "words" | "coins";
export type Challenge = {
  mode: string;
  seed?: string;
  score: number;
  unit: ChallengeUnit;
  rules?: string;
  /** Opened by the player who made it: their own score to beat. */
  mine?: boolean;
};
export const UNITS: Record<
  ChallengeUnit,
  { one: string; many: string; zh: string }
>;
export const MODE: RegExp;
export const SEED: RegExp;
export const MAX_SCORE: number;
export const RULES: RegExp;
export function validChallenge(raw: unknown): Challenge | null;
export const CHALLENGE_ID: RegExp;
export function challengeIdFromQuery(search: string): string | null;
export function challengeUrl(
  origin: string,
  gameId: string,
  id: string,
  zh: boolean,
): string;
export function scoreText(challenge: Challenge, zh: boolean): string;
export function challengeText(
  challenge: Challenge,
  gameTitle: string,
  zh: boolean,
  name?: string | null,
): { title: string; description: string };
