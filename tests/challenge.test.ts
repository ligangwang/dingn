// Challenge links and the browser's side of the funnel.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  challengeFromQuery,
  challengeText,
  challengeUrl,
  validChallenge,
} from "../src/data/challenge.mjs";
import { cleanSource, landingSource, visitFor } from "../src/lib/funnel";

test("a challenge link round-trips through its address", () => {
  const challenge = {
    mode: "ladder",
    seed: "2026-11-16",
    score: 10,
    unit: "digits" as const,
  };
  const url = challengeUrl("https://dingn.com", "memory", challenge, false);
  assert.equal(
    url,
    "https://dingn.com/play/memory/?challenge=ladder&seed=2026-11-16&score=10&unit=digits",
  );
  assert.deepEqual(challengeFromQuery(new URL(url).search), challenge);
  assert.match(
    challengeUrl("https://dingn.com", "memory", challenge, true),
    /^https:\/\/dingn\.com\/zh\/play\/memory\/\?/,
  );
  // No seed is fine: the game picks the round from the mode alone.
  assert.deepEqual(
    challengeFromQuery("?challenge=classic&score=0&unit=points"),
    {
      mode: "classic",
      score: 0,
      unit: "points",
    },
  );
});

test("malformed challenges are ignored", () => {
  for (const query of [
    "",
    "?score=10&unit=digits",
    "?challenge=Ladder&score=10&unit=digits",
    "?challenge=ladder&score=-1&unit=digits",
    "?challenge=ladder&score=1.5&unit=digits",
    "?challenge=ladder&score=10&unit=dollars",
    "?challenge=ladder&seed=a/b&score=10&unit=digits",
    "?challenge=ladder&score=99999999999&unit=digits",
  ])
    assert.equal(challengeFromQuery(query), null, query);
  assert.equal(validChallenge({ mode: "x", score: 1, unit: "toString" }), null);
});

test("the words come from dingn, not from the link", () => {
  const c = { mode: "ladder", score: 1, unit: "digits" as const };
  assert.equal(
    challengeText(c, "Memory", false).title,
    "A friend reached 1 digit in Memory. Can you beat it?",
  );
  assert.equal(
    challengeText({ ...c, score: 12000 }, "Memory", false).title,
    "A friend reached 12,000 digits in Memory. Can you beat it?",
  );
  assert.equal(
    challengeText({ ...c, score: 10 }, "记忆", true).title,
    "朋友在「记忆」中达到了 10 位数字，你能超过吗？",
  );
});

test("a visit's source is its tag, a challenge, or the site it came from", () => {
  const page = "https://dingn.com/play/memory/";
  assert.equal(landingSource(page + "?utm_source=TikTok", ""), "tiktok");
  assert.equal(landingSource(page + "?ref=discord", ""), "discord");
  assert.equal(
    landingSource(page + "?challenge=ladder&score=3&unit=digits", ""),
    "challenge",
  );
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
