export type ChallengeUnit =
  "points" | "digits" | "cards" | "levels" | "stars" | "words" | "coins";
export type Challenge = {
  mode: string;
  seed?: string;
  score: number;
  unit: ChallengeUnit;
};
export const UNITS: Record<
  ChallengeUnit,
  { one: string; many: string; zh: string }
>;
export const MODE: RegExp;
export const SEED: RegExp;
export const MAX_SCORE: number;
export function validChallenge(raw: unknown): Challenge | null;
export function challengeFromQuery(search: string): Challenge | null;
export function challengeQuery(challenge: Challenge): string;
export function challengeUrl(
  origin: string,
  gameId: string,
  challenge: Challenge,
  zh: boolean,
): string;
export function scoreText(challenge: Challenge, zh: boolean): string;
export function challengeText(
  challenge: Challenge,
  gameTitle: string,
  zh: boolean,
): { title: string; description: string };
