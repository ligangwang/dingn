export const LADDER_START: number;
export const LADDER_MAX: number;
export const LADDER_LIVES: number;
export const LADDER_ROUNDS: number;
export function ladderLength(index: number): number;
export function ladderSequences(digit: () => number): string[];
export function dailyLadder(day: string): string[];
export function scoreLadder(
  sequences: string[],
  answers: string[],
): {
  score: number;
  best: number;
  length: number;
  misses: number;
  lives: number;
  over: boolean;
  rounds: { expected: string; answer: string; correct: boolean }[];
};
