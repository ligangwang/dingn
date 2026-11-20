// Challenge links: "I reached 10 digits on Memory. Your turn." A game asks
// for one through the SDK (dingn.challengeLink) after a round. dingn saves
// the challenge (scripts/challenges.mjs) and the link carries only its id, so
// nobody can change the score by editing the address:
//
//   /play/memory/?c=Xq3v9TzK1bWm
//
// The text a link shows (the page's banner and its link preview) is put
// together here from the saved, checked fields and the game's own title,
// never from text in the link, so a link cannot make dingn say anything else.
// The player page (game-host.tsx), the server's link previews
// (scripts/game-seo.mjs) and the challenge store all read this file.

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
/**
 * The rules the round was played with, in the game's own words (its upgrades,
 * helpers allowed, …), so the friend plays under exactly the same ones.
 */
export const RULES = /^[A-Za-z0-9._-]{1,64}$/;

/** A checked challenge (mode, seed, score, unit, rules), or null. */
export function validChallenge(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { mode, seed, score, unit, rules } = raw;
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
  if (rules != null && (typeof rules !== "string" || !RULES.test(rules)))
    return null;
  return {
    mode,
    ...(seed != null ? { seed } : {}),
    score,
    unit,
    ...(rules != null ? { rules } : {}),
  };
}

/** A saved challenge's id: 12 letters, digits, dashes or underscores. */
export const CHALLENGE_ID = /^[A-Za-z0-9_-]{12}$/;

/** The challenge id in a page address's query (`?c=…`), or null. */
export function challengeIdFromQuery(search) {
  const id = new URLSearchParams(search).get("c");
  return id && CHALLENGE_ID.test(id) ? id : null;
}

/** The address of a game's page that opens the saved challenge `id`. */
export function challengeUrl(origin, gameId, id, zh) {
  return `${origin}${zh ? "/zh" : ""}/play/${gameId}/?c=${encodeURIComponent(id)}`;
}

/** "10 digits" or "10 位数字". */
export function scoreText(challenge, zh) {
  const words = UNITS[challenge.unit];
  if (zh) return `${challenge.score} ${words.zh}`;
  return `${challenge.score.toLocaleString("en-US")} ${challenge.score === 1 ? words.one : words.many}`;
}

/**
 * What a challenge link says, for its link preview (title, description) and
 * the banner above the game (the same title). `name` is the nickname of the
 * player who made it, or null for "A friend".
 */
export function challengeText(challenge, gameTitle, zh, name = null) {
  const score = scoreText(challenge, zh);
  return zh
    ? {
        title: `${name ?? "朋友"}在「${gameTitle}」中达到了 ${score}，你能超过吗？`,
        description:
          "在 dingn 免费玩同一个挑战：打开就能玩，无需登录。赢金币，建造你的王国。",
      }
    : {
        title: `${name ?? "A friend"} reached ${score} in ${gameTitle}. Can you beat it?`,
        description:
          "Play the same challenge free on dingn. It starts right away, no sign-in needed. Earn coins and build your kingdom.",
      };
}
