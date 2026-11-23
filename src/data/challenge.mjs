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
//
// The words are English templates such as "{0} reached {1} in {2}. Can you
// beat it?", translated by the caller's language pack (`translate`), with
// the score, name and title put in afterwards.
import { localeInfo } from "./i18n-core.mjs";

/** What a score can be counted in: "{0} point" / "{0} points". */
export const UNITS = {
  points: { one: "point", many: "points" },
  digits: { one: "digit", many: "digits" },
  cards: { one: "card", many: "cards" },
  levels: { one: "level", many: "levels" },
  stars: { one: "star", many: "stars" },
  words: { one: "word", many: "words" },
  coins: { one: "coin", many: "coins" },
};

/** A template's "{0}", "{1}", … filled in with `values`. */
const fill = (template, ...values) =>
  template.replace(/\{(\d+)\}/g, (all, n) => values[Number(n)] ?? all);
const same = (text) => text;
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

/** A player's public number, which names them as the one who shared a link (`?r=…`). */
export const REFERRER = /^[1-9]\d{9}$/;

/** The sharer's public number in a page address's query (`?r=…`), or null. */
export function referrerFromQuery(search) {
  const number = new URLSearchParams(search).get("r");
  return number && REFERRER.test(number) ? number : null;
}

/**
 * The address of a game's page, in a language, that opens the saved
 * challenge `id`. `referrer` is the public number of the signed-in player
 * sharing it: whoever joins dingn through the link is their friend.
 */
export function challengeUrl(origin, gameId, id, locale, referrer) {
  const by = referrer && REFERRER.test(referrer) ? `&r=${referrer}` : "";
  return `${origin}${localeInfo(locale).path}/play/${gameId}/?c=${encodeURIComponent(id)}${by}`;
}

/** "10 digits", "10 位数字", "10 dígitos": translated by `translate`. */
export function scoreText(challenge, locale = "en", translate = same) {
  const words = UNITS[challenge.unit];
  const number = challenge.score.toLocaleString(
    locale === "en" ? "en-US" : locale,
  );
  const word = challenge.score === 1 ? words.one : words.many;
  const english = `${number} ${word}`;
  // Its own key ("Challenge score: {0} points"), so the template can't be
  // mistaken for other text ending in "points"; English needs no pack.
  const key = `Challenge score: {0} ${word}`;
  const said = locale === "en" ? key : translate(key);
  return said === key ? english : fill(said, number);
}

/**
 * What a challenge link says, for its link preview (title, description) and
 * the banner above the game (the same title). `name` is the nickname of the
 * player who made it, or null for "A friend". A challenge with `mine` set
 * (opened by the player who made it) is their own score to beat.
 */
export function challengeText(
  challenge,
  gameTitle,
  locale = "en",
  name = null,
  translate = same,
) {
  const score = scoreText(challenge, locale, translate);
  // The player's own challenge, opened by them: their own score to beat.
  if (challenge.mine === true)
    return {
      title: fill(
        translate("Your score to beat: {0} in {1}."),
        score,
        gameTitle,
      ),
      description: "",
    };
  return {
    title: name
      ? fill(
          translate("{0} reached {1} in {2}. Can you beat it?"),
          name,
          score,
          gameTitle,
        )
      : fill(
          translate("A friend reached {0} in {1}. Can you beat it?"),
          score,
          gameTitle,
        ),
    description: translate(
      "Play the same challenge free on dingn. It starts right away, no sign-in needed. Earn coins and build your kingdom.",
    ),
  };
}

/**
 * A challenge's title in parts, so a page can set the player's name, the
 * score and the game apart: [{ kind: "text" | "name" | "score" | "game",
 * text }]. The words and their order are the language's own (the same
 * template as challengeText), so the parts read as that title when joined.
 */
export function challengeParts(
  challenge,
  gameTitle,
  locale = "en",
  name = null,
  translate = same,
) {
  const score = scoreText(challenge, locale, translate);
  // Which value each "{n}" of the template stands for.
  const [template, kinds] =
    challenge.mine === true
      ? [translate("Your score to beat: {0} in {1}."), ["score", "game"]]
      : name
        ? [
            translate("{0} reached {1} in {2}. Can you beat it?"),
            ["name", "score", "game"],
          ]
        : [
            translate("A friend reached {0} in {1}. Can you beat it?"),
            ["score", "game"],
          ];
  const values = { name, score, game: gameTitle };
  return template
    .split(/(\{\d+\})/)
    .filter(Boolean)
    .map((piece) => {
      const kind = kinds[Number(/^\{(\d+)\}$/.exec(piece)?.[1] ?? -1)];
      return kind
        ? { kind, text: values[kind] }
        : { kind: "text", text: piece };
    });
}

/**
 * Which round a challenge is, in words, when dingn can tell: "Level 28" for
 * a game whose `mode` is "level" and whose `seed` is the level's number, or
 * the day for a `seed` that is a date ("2026-11-16"). Otherwise null: a seed
 * is the game's own, and dingn does not guess at what it means.
 */
export function roundText(challenge, translate = same) {
  const seed = challenge?.seed;
  if (typeof seed !== "string") return null;
  if (challenge.mode === "level" && /^[1-9]\d{0,4}$/.test(seed))
    return fill(translate("Level {0}"), seed);
  return /^\d{4}-\d{2}-\d{2}$/.test(seed) ? seed : null;
}
