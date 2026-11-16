// Challenge links: "I reached 10 digits on Memory. Your turn." A game asks
// for one through the SDK (dingn.challengeLink) after a round, and the link
// opens the same round for a friend:
//
//   /play/memory/?challenge=ladder&seed=2026-11-16&score=10&unit=digits
//
// Everything is in the address, so nothing is stored. The text a link shows
// (the page's banner and its link preview) is put together here from those
// checked fields and the game's own title, never from text in the link, so a
// link cannot make dingn say anything else. The player page (game-host.tsx)
// and the server's link previews (scripts/game-seo.mjs) both read this file.

/** What a score can be counted in, with its words in both languages. */
export const UNITS = {
  points: { one: "point", many: "points", zh: "分" },
  digits: { one: "digit", many: "digits", zh: "位数字" },
  cards: { one: "card", many: "cards", zh: "张牌" },
  levels: { one: "level", many: "levels", zh: "关" },
  stars: { one: "star", many: "stars", zh: "颗星" },
  words: { one: "word", many: "words", zh: "个单词" },
  coins: { one: "coin", many: "coins", zh: "枚金币" },
};
export const MODE = /^[a-z][a-z0-9-]{0,23}$/;
export const SEED = /^[A-Za-z0-9-]{1,32}$/;
export const MAX_SCORE = 1_000_000_000;

/** A checked challenge (mode, seed, score, unit), or null. */
export function validChallenge(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { mode, seed, score, unit } = raw;
  if (typeof mode !== "string" || !MODE.test(mode)) return null;
  if (seed != null && (typeof seed !== "string" || !SEED.test(seed)))
    return null;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  )
    return null;
  if (typeof unit !== "string" || !Object.hasOwn(UNITS, unit)) return null;
  return { mode, ...(seed != null ? { seed } : {}), score, unit };
}

/** The challenge in a page address's query (`?challenge=…`), or null. */
export function challengeFromQuery(search) {
  const params = new URLSearchParams(search);
  const mode = params.get("challenge");
  if (!mode) return null;
  const score = params.get("score") ?? "";
  return validChallenge({
    mode,
    seed: params.get("seed") ?? undefined,
    score: /^\d{1,10}$/.test(score) ? Number(score) : NaN,
    unit: params.get("unit"),
  });
}

/** The query that carries a checked challenge, without the "?". */
export function challengeQuery(challenge) {
  const params = new URLSearchParams({ challenge: challenge.mode });
  if (challenge.seed) params.set("seed", challenge.seed);
  params.set("score", String(challenge.score));
  params.set("unit", challenge.unit);
  return params.toString();
}

/** The address of a game's page that opens `challenge`. */
export function challengeUrl(origin, gameId, challenge, zh) {
  return `${origin}${zh ? "/zh" : ""}/play/${gameId}/?${challengeQuery(challenge)}`;
}

/** "10 digits" or "10 位数字". */
export function scoreText(challenge, zh) {
  const words = UNITS[challenge.unit];
  if (zh) return `${challenge.score} ${words.zh}`;
  return `${challenge.score.toLocaleString("en-US")} ${challenge.score === 1 ? words.one : words.many}`;
}

/**
 * What a challenge link says, for its link preview (title, description) and
 * the banner above the game (the same title).
 */
export function challengeText(challenge, gameTitle, zh) {
  const score = scoreText(challenge, zh);
  return zh
    ? {
        title: `朋友在「${gameTitle}」中达到了 ${score}，你能超过吗？`,
        description:
          "在 dingn 免费玩同一个挑战：打开就能玩，无需登录。赢金币，建造你的王国。",
      }
    : {
        title: `A friend reached ${score} in ${gameTitle}. Can you beat it?`,
        description:
          "Play the same challenge free on dingn. It starts right away, no sign-in needed. Earn coins and build your kingdom.",
      };
}
