import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_PLAY_MS } from "../src/lib/xp-config";
import { DAILY_XP_CAP } from "kingdom/levels";
import {
  MIN_DURATION_MS,
  GAMES,
  GameError,
  STARTS_PER_HOUR,
  checkStart,
  levelFor,
  newChallenge,
  publicName,
  settle,
} from "../scripts/game-core.mjs";

const T0 = Date.parse("2026-11-02T12:00:00Z");
const play = (over: Record<string, unknown> = {}) => ({
  uid: "alice",
  game: "warmup",
  challenge: { digits: "407" },
  startedAt: T0,
  status: "open",
  ...over,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof GameError);
    return (e as GameError).code;
  }
  assert.fail("expected a GameError");
};

test("forged or replayed plays are rejected", () => {
  const base = { player: undefined, answers: "407", now: T0 + 5_000 };
  assert.equal(
    code(() => settle({ ...base, play: play(), uid: "mallory" })),
    "no_play",
  );
  assert.equal(
    code(() => settle({ ...base, play: undefined, uid: "alice" })),
    "no_play",
  );
  assert.equal(
    code(() =>
      settle({ ...base, play: play({ status: "scored" }), uid: "alice" }),
    ),
    "already_finished",
  );
  assert.equal(
    code(() =>
      settle({ ...base, play: play(), uid: "alice", now: T0 + 1_000 }),
    ),
    "too_fast",
  );
  assert.equal(
    code(() =>
      settle({ ...base, play: play(), uid: "alice", now: T0 + 31 * 60_000 }),
    ),
    "expired",
  );
  for (const answers of ["40", "4071", 407, ["4", "0", "7"], null])
    assert.equal(
      code(() => settle({ ...base, play: play(), uid: "alice", answers })),
      "bad_answers",
    );
});

test("retired games can no longer be started or scored", () => {
  assert.deepEqual(GAMES, ["warmup", "ladder", "ladder_daily"]);
  for (const game of ["logic", "decisions"]) {
    assert.equal(
      code(() => newChallenge(game, () => 0)),
      "bad_game",
    );
    assert.equal(
      code(() =>
        settle({
          play: play({ game, challenge: { rounds: 4 } }),
          player: undefined,
          uid: "alice",
          answers: [0, 0, 0, 0],
          now: T0 + 20_000,
        }),
      ),
      "bad_game",
    );
  }
});

test("warm-up is checked against the server's own digits", () => {
  const p = play();
  const win = settle({
    play: p,
    player: undefined,
    uid: "alice",
    answers: "407",
    now: T0 + 5_000,
  });
  assert.equal(win.result.xpGained, 5);
  assert.equal(win.player.xp, 5);
  const miss = settle({
    play: p,
    player: undefined,
    uid: "alice",
    answers: "123",
    now: T0 + 5_000,
  });
  assert.equal(miss.result.score, 0);
  assert.equal(miss.result.xpGained, 1);
});

test("XP per day is capped, streaks count consecutive days", () => {
  const near = {
    xp: 1000,
    dailyKey: "2026-11-02",
    dailyXp: DAILY_XP_CAP - 3,
    streak: 3,
    lastPlayed: "2026-11-01",
  };
  const capped = settle({
    play: play(),
    player: near,
    uid: "alice",
    answers: "407",
    now: T0 + 5_000,
  });
  assert.equal(capped.result.xpGained, 3);
  assert.equal(capped.result.capped, true);
  assert.equal(capped.player.streak, 4);
  const full = settle({
    play: play(),
    player: { ...near, dailyXp: DAILY_XP_CAP },
    uid: "alice",
    answers: "407",
    now: T0 + 5_000,
  });
  assert.equal(full.result.xpGained, 0);
  const nextDay = settle({
    play: play({ startedAt: T0 + 86_400_000 }),
    player: { ...near, dailyXp: DAILY_XP_CAP },
    uid: "alice",
    answers: "407",
    now: T0 + 86_405_000,
  });
  assert.equal(nextDay.result.xpGained, 5);
  const gap = settle({
    play: play(),
    player: { streak: 9, lastPlayed: "2026-10-28" },
    uid: "alice",
    answers: "407",
    now: T0 + 5_000,
  });
  assert.equal(gap.player.streak, 1);
});

test("starts are rate-limited per hour", () => {
  assert.deepEqual(checkStart(undefined, T0), {
    hourKey: "2026-11-02T12",
    hourStarts: 1,
  });
  assert.equal(
    code(() =>
      checkStart({ hourKey: "2026-11-02T12", hourStarts: STARTS_PER_HOUR }, T0),
    ),
    "rate_limited",
  );
  assert.equal(
    checkStart({ hourKey: "2026-11-02T11", hourStarts: STARTS_PER_HOUR }, T0)
      .hourStarts,
    1,
  );
});

test("levels and public names", () => {
  assert.deepEqual(
    [0, 99, 100, 299, 300, 600].map(levelFor),
    [1, 1, 2, 2, 3, 4],
  );
  assert.equal(publicName("", "Ada Lovelace"), "Ada");
  assert.equal(publicName("  Ace ", "Ada Lovelace"), "Ace");
  assert.equal(publicName("", undefined), "Player");
});

test("the client waits at least as long as the server requires", () => {
  for (const [game, ms] of Object.entries(MIN_DURATION_MS))
    assert.ok(MIN_PLAY_MS[game as keyof typeof MIN_PLAY_MS] > (ms as number));
});
