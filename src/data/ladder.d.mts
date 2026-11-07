export const LADDER_ROUNDS: number;
export function dailyLadder(day: string): string[];
export function scoreLadder(
  sequences: string[],
  answers: string[],
): {
  score: number;
  best: number;
  length: number;
  rounds: { expected: string; answer: string; correct: boolean }[];
};
