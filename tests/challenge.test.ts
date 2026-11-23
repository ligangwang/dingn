// Challenge links and the browser's side of the funnel.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  challengeIdFromQuery,
  challengeText,
  challengeUrl,
  referrerFromQuery,
  validChallenge,
} from "../src/data/challenge.mjs";
import { cleanSource, landingSource, visitFor } from "../src/lib/funnel";
import { translate } from "../scripts/i18n.mjs";

/** A language's pack, as the player page and the server use it. */
const tr = (locale: string) => (text: string) => translate(text, locale);

test("a challenge link carries only the saved challenge's id", () => {
  const url = challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", "en");
  assert.equal(url, "https://dingn.com/play/memory/?c=Xq3v9TzK1bWm");
  assert.equal(challengeIdFromQuery(new URL(url).search), "Xq3v9TzK1bWm");
  assert.equal(
    challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", "zh-CN"),
    "https://dingn.com/zh/play/memory/?c=Xq3v9TzK1bWm",
  );
  assert.equal(
    challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", "pt-BR"),
    "https://dingn.com/pt/play/memory/?c=Xq3v9TzK1bWm",
  );
  // Shared by a signed-in player, it names them by their public number.
  const shared = challengeUrl(
    "https://dingn.com",
    "memory",
    "Xq3v9TzK1bWm",
    "zh-CN",
    "1234567890",
  );
  assert.equal(
    shared,
    "https://dingn.com/zh/play/memory/?c=Xq3v9TzK1bWm&r=1234567890",
  );
  assert.equal(referrerFromQuery(new URL(shared).search), "1234567890");
  assert.equal(challengeIdFromQuery(new URL(shared).search), "Xq3v9TzK1bWm");
  for (const bad of ["", "?r=123", "?r=abc1234567", "?r=0234567890"])
    assert.equal(referrerFromQuery(bad), null, bad);
  assert.equal(
    challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", "en", "x"),
    "https://dingn.com/play/memory/?c=Xq3v9TzK1bWm",
  );
  for (const query of [
    "",
    "?c=short",
    "?c=Xq3v9TzK1bWm1",
    "?c=Xq3v9TzK1b/m",
    // The old links that carried the score in the address no longer count.
    "?challenge=ladder&seed=2026-11-16&score=10&unit=digits",
  ])
    assert.equal(challengeIdFromQuery(query), null, query);
});

test("malformed challenges are refused", () => {
  for (const raw of [
    { score: 10, unit: "digits" },
    { mode: "Ladder", score: 10, unit: "digits" },
    { mode: "ladder", score: -1, unit: "digits" },
    { mode: "ladder", score: 1.5, unit: "digits" },
    { mode: "ladder", score: 10, unit: "dollars" },
    { mode: "ladder", seed: "a/b", score: 10, unit: "digits" },
    { mode: "ladder", score: 99999999999, unit: "digits" },
    { mode: "x", score: 1, unit: "toString" },
    { mode: "ladder", score: 1, unit: "points", rules: "a b" },
    { mode: "ladder", score: 1, unit: "points", rules: "" },
    { mode: "ladder", score: 1, unit: "points", rules: "x".repeat(65) },
    { mode: "ladder", score: 1, unit: "points", rules: 7 },
  ])
    assert.equal(validChallenge(raw), null, JSON.stringify(raw));
  assert.deepEqual(
    validChallenge({ mode: "classic", seed: null, score: 0, unit: "points" }),
    { mode: "classic", score: 0, unit: "points" },
  );
  // The round's rules come back unchanged.
  assert.deepEqual(
    validChallenge({
      mode: "level",
      seed: "12",
      score: 5,
      unit: "points",
      rules: "u3-1-0-0-2-0.n1",
    }),
    {
      mode: "level",
      seed: "12",
      score: 5,
      unit: "points",
      rules: "u3-1-0-0-2-0.n1",
    },
  );
});

test("the words come from dingn, not from the link", () => {
  const c = { mode: "ladder", score: 1, unit: "digits" as const };
  assert.equal(
    challengeText(c, "Memory", "en").title,
    "A friend reached 1 digit in Memory. Can you beat it?",
  );
  assert.equal(
    challengeText({ ...c, score: 12000 }, "Memory", "en").title,
    "A friend reached 12,000 digits in Memory. Can you beat it?",
  );
  assert.equal(
    challengeText({ ...c, score: 10 }, "记忆", "zh-CN", null, tr("zh-CN"))
      .title,
    "朋友在「记忆」中达到了 10 位数字，你能超过吗？",
  );
  // Opened by the player who made it: their own score to beat.
  assert.equal(
    challengeText({ ...c, mine: true }, "Memory", "en", "Ada").title,
    "Your score to beat: 1 digit in Memory.",
  );
  assert.equal(
    challengeText(
      { ...c, score: 10, mine: true },
      "记忆",
      "zh-CN",
      null,
      tr("zh-CN"),
    ).title,
    "你要超越的成绩：「记忆」10 位数字",
  );
  // The nickname of the player who made it, when they were signed in.
  assert.equal(
    challengeText(c, "Memory", "en", "Ada").title,
    "Ada reached 1 digit in Memory. Can you beat it?",
  );
  assert.equal(
    challengeText({ ...c, score: 10 }, "记忆", "zh-CN", "Ada", tr("zh-CN"))
      .title,
    "Ada在「记忆」中达到了 10 位数字，你能超过吗？",
  );
  // Other languages come from their packs, the name put in afterwards.
  assert.equal(
    challengeText({ ...c, score: 4210 }, "Gem Surge", "es", "Ada", tr("es"))
      .title,
    "Ada consiguió 4210 dígitos en Gem Surge. ¿Puedes superarlo?",
  );
  assert.equal(
    challengeText({ ...c, score: 3 }, "Gem Surge", "ja", null, tr("ja")).title,
    "友だちがGem Surgeで3桁を達成しました。超えられるかな？",
  );
  // A name that looks like the sentence can't change its words.
  assert.equal(
    challengeText(c, "Memory", "es", "{1} reached", tr("es")).title,
    "{1} reached consiguió 1 dígito en Memory. ¿Puedes superarlo?",
  );
  // A language without the words falls back to English.
  assert.equal(
    challengeText(c, "Memory", "xx", null, tr("xx")).title,
    "A friend reached 1 digit in Memory. Can you beat it?",
  );
});

test("a visit's source is its tag, a challenge, or the site it came from", () => {
  const page = "https://dingn.com/play/memory/";
  assert.equal(landingSource(page + "?utm_source=TikTok", ""), "tiktok");
  assert.equal(landingSource(page + "?ref=discord", ""), "discord");
  assert.equal(landingSource(page + "?c=Xq3v9TzK1bWm", ""), "challenge");
  assert.equal(landingSource(page, "https://www.google.co.uk/"), "google");
  assert.equal(landingSource(page, "https://t.co/abc"), "x");
  assert.equal(
    landingSource(page, "https://news.ycombinator.com/"),
    "news_ycombinator_com",
  );
  assert.equal(landingSource(page, "https://dingn.com/"), "direct");
  assert.equal(landingSource(page, ""), "direct");
  assert.equal(cleanSource("<script>"), "script");
  assert.equal(cleanSource("!!!"), "");
});

test("a browser counts once a day, and once as back within a week", () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  const first = visitFor(null, "challenge", day("2026-11-10"));
  assert.deepEqual(first.event, {
    event: "visit",
    source: "challenge",
    new: true,
    returning: false,
    returner: false,
    referred: true,
  });
  assert.equal(visitFor(first.state, "direct", day("2026-11-10")).event, null);
  const back = visitFor(first.state, "direct", day("2026-11-12"));
  // Counted under the first source.
  assert.equal(back.event?.source, "challenge");
  assert.equal(
    back.event && "returner" in back.event && back.event.returner,
    true,
  );
  const again = visitFor(back.state, "direct", day("2026-11-13"));
  assert.equal(
    again.event && "returner" in again.event && again.event.returner,
    false,
  );
  assert.equal(
    again.event && "returning" in again.event && again.event.returning,
    true,
  );
  // Back after more than a week: a return visit, not a returner.
  const late = visitFor(first.state, "direct", day("2026-11-25"));
  assert.equal(
    late.event && "returner" in late.event && late.event.returner,
    false,
  );
});

test("a challenge's title names the round when dingn can tell which it is", () => {
  const level = {
    mode: "level",
    seed: "28",
    score: 2110,
    unit: "points" as const,
  };
  assert.equal(
    challengeText(level, "Gem Surge", "en", "Ada").title,
    "Ada reached 2,110 points in Gem Surge (Level 28). Can you beat it?",
  );
  assert.equal(
    challengeText({ ...level, mine: true }, "Gem Surge").title,
    "Your score to beat: 2,110 points in Gem Surge (Level 28).",
  );
  // A seed that is the game's own names nothing.
  assert.equal(
    challengeText({ ...level, seed: "abc" }, "Gem Surge", "en", "Ada").title,
    "Ada reached 2,110 points in Gem Surge. Can you beat it?",
  );
});

test("a challenge's title comes in parts, in the language's own order", async () => {
  const { challengeParts } = await import("../src/data/challenge.mjs");
  const round = { mode: "level", score: 2110, unit: "points" as const };
  assert.deepEqual(challengeParts(round, "Gem Surge", "en", "Ada"), [
    { kind: "name", text: "Ada" },
    { kind: "text", text: " reached " },
    { kind: "score", text: "2,110 points" },
    { kind: "text", text: " in " },
    { kind: "game", text: "Gem Surge" },
    { kind: "text", text: ". Can you beat it?" },
  ]);
  // A translation may put the game first.
  const zh = (text: string) =>
    text === "{0} reached {1} in {2}. Can you beat it?"
      ? "在{2}中，{0}拿到了{1}。"
      : text;
  assert.deepEqual(
    challengeParts(round, "Gem Surge", "en", "Ada", zh).map((p) => p.kind),
    ["text", "game", "text", "name", "text", "score", "text"],
  );
  // Without a name there is no name part.
  assert.deepEqual(
    challengeParts(round, "Gem Surge").map((p) => p.kind),
    ["text", "score", "text", "game", "text"],
  );
});

test("a challenge's round is named when dingn can tell which it is", async () => {
  const { roundText } = await import("../src/data/challenge.mjs");
  assert.equal(roundText({ mode: "level", seed: "28" }), "Level 28");
  assert.equal(
    roundText({ mode: "level", seed: "28" }, (text: string) =>
      text === "Level {0}" ? "第 {0} 关" : text,
    ),
    "第 28 关",
  );
  // A day's round is named by its day.
  assert.equal(roundText({ mode: "ladder", seed: "2026-11-16" }), "2026-11-16");
  // Any other seed is the game's own business.
  assert.equal(roundText({ mode: "classic", seed: "839201" }), null);
  assert.equal(roundText({ mode: "level", seed: "boss" }), null);
  assert.equal(roundText({ mode: "level" }), null);
});
