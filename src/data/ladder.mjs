/** Digits in the first round. */
export const LADDER_START = 3;
/** The ladder tops out here. */
export const LADDER_MAX = 20;
/** Misses allowed before the climb ends. */
export const LADDER_LIVES = 3;
/**
 * Most rounds a climb can take: every rung from LADDER_START to LADDER_MAX
 * plus every miss but the last (the last miss ends the climb early).
 */
export const LADDER_ROUNDS = LADDER_MAX - LADDER_START + LADDER_LIVES;

/** Digits round `index` can need at most: one more than the round before. */
export const ladderLength = (index) =>
  Math.min(LADDER_MAX, LADDER_START + index);

/** Random sequences for a whole climb. `digit()` returns 0–9. */
export function ladderSequences(digit) {
  return Array.from({ length: LADDER_ROUNDS }, (_, i) =>
    Array.from({ length: ladderLength(i) }, digit).join(""),
  );
}

export function dailyLadder(day) {
  let seed = 2166136261;
  for (const char of `dingn-ladder-v2:${day}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return ladderSequences(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * 10);
  });
}

/**
 * Follows a climb: a correct answer adds a digit, a miss keeps the length
 * and costs a life. The climb is over after LADDER_LIVES misses, after
 * clearing LADDER_MAX digits, or when the sequences run out. Answers after
 * that are ignored.
 */
export function scoreLadder(sequences, answers) {
  let length = LADDER_START,
    score = 0,
    best = 0,
    misses = 0,
    over = false;
  const rounds = [];
  for (let index = 0; index < answers.length && !over; index++) {
    const expected = (sequences[index] ?? "").slice(0, length);
    const answer = answers[index];
    const correct = expected.length === length && answer === expected;
    rounds.push({ expected, answer, correct });
    if (correct) {
      score++;
      best = length;
      if (length === LADDER_MAX) over = true;
      else length++;
    } else misses++;
    if (misses >= LADDER_LIVES || index + 1 >= sequences.length) over = true;
  }
  return {
    score,
    best,
    length,
    misses,
    lives: LADDER_LIVES - misses,
    over,
    rounds,
  };
}
