export const LADDER_ROUNDS = 6;
export function dailyLadder(day) {
  let seed = 2166136261;
  for (const char of `dingn-ladder-v1:${day}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: LADDER_ROUNDS }, () =>
    Array.from({ length: 8 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * 10);
    }).join(""),
  );
}
export function scoreLadder(sequences, answers) {
  let length = 3,
    score = 0,
    best = 0;
  const rounds = answers.map((answer, index) => {
    const expected = sequences[index].slice(0, length);
    const correct = answer === expected;
    const result = { expected, answer, correct };
    if (correct) {
      score++;
      best = length;
      length++;
    }
    return result;
  });
  return { score, best, length, rounds };
}
