// Challenge links and the browser's side of the funnel.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  challengeIdFromQuery,
  challengeText,
  challengeUrl,
  validChallenge,
} from "../src/data/challenge.mjs";
import { cleanSource, landingSource, visitFor } from "../src/lib/funnel";

test("a challenge link carries only the saved challenge's id", () => {
  const url = challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", false);
  assert.equal(url, "https://dingn.com/play/memory/?c=Xq3v9TzK1bWm");
  assert.equal(challengeIdFromQuery(new URL(url).search), "Xq3v9TzK1bWm");
  assert.equal(
    challengeUrl("https://dingn.com", "memory", "Xq3v9TzK1bWm", true),
    "https://dingn.com/zh/play/memory/?c=Xq3v9TzK1bWm",
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
  ])
    assert.equal(validChallenge(raw), null, JSON.stringify(raw));
  assert.deepEqual(
    validChallenge({ mode: "classic", seed: null, score: 0, unit: "points" }),
    { mode: "classic", score: 0, unit: "points" },
  );
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
    landingSource(page + "?c=Xq3v9TzK1bWm", ""),
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
