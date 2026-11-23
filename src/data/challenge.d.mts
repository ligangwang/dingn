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
export const UNITS: Record<ChallengeUnit, { one: string; many: string }>;
export const MODE: RegExp;
export const SEED: RegExp;
export const MAX_SCORE: number;
export const RULES: RegExp;
export function validChallenge(raw: unknown): Challenge | null;
export const CHALLENGE_ID: RegExp;
export function challengeIdFromQuery(search: string): string | null;
export const REFERRER: RegExp;
export function referrerFromQuery(search: string): string | null;
export function challengeUrl(
  origin: string,
  gameId: string,
  id: string,
  locale: string,
  referrer?: string | null,
): string;
export function scoreText(
  challenge: Challenge,
  locale?: string,
  translate?: (text: string) => string,
): string;
export function challengeText(
  challenge: Challenge,
  gameTitle: string,
  locale?: string,
  name?: string | null,
  translate?: (text: string) => string,
): { title: string; description: string };
export function challengeParts(
  challenge: Challenge,
  gameTitle: string,
  locale?: string,
  name?: string | null,
  translate?: (text: string) => string,
): { kind: "text" | "name" | "score" | "game"; text: string }[];
export function roundText(
  challenge: Pick<Challenge, "mode" | "seed">,
  translate?: (text: string) => string,
): string | null;
