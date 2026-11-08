// Server-authoritative game rules. Pure functions only: the HTTP layer in
// game-api.mjs loads documents, calls these, and writes the results inside a
// Firestore transaction. Nothing here trusts a score sent by the browser.
import { readFileSync } from "node:fs";
import {
  dailyLadder,
  LADDER_MAX,
  LADDER_ROUNDS,
  LADDER_START,
  ladderSequences,
  scoreLadder,
} from "../src/data/ladder.mjs";

const rounds = JSON.parse(
  readFileSync(new URL("../src/data/mind-games.json", import.meta.url), "utf8"),
);

export const GAMES = ["warmup", "logic", "decisions", "ladder", "ladder_daily"];
export const DAILY_XP_CAP = 300;
export const STARTS_PER_HOUR = 60;
export const PLAY_TTL_MS = 30 * 60 * 1000;
/** Fastest believable completion for each game, in milliseconds. */
export const MIN_DURATION_MS = {
  warmup: 3000,
  logic: 8000,
  decisions: 8000,
  // three quick misses at three digits
  ladder: 9000,
  ladder_daily: 9000,
};

export class GameError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const hourKey = (ms) => new Date(ms).toISOString().slice(0, 13);

/** Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, … */
export function levelFor(xp) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  return level;
}
export function levelProgress(xp) {
  const level = levelFor(xp);
  const floor = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, xp, floor, next };
}

/** Builds the challenge the server hands out for a new play. */
export function newChallenge(game, randomInt) {
  if (game === "ladder_daily") {
    const day = dayKey(Date.now());
    return { sequences: dailyLadder(day), day };
  }
  if (game === "ladder")
    return { sequences: ladderSequences(() => randomInt(10)) };
  if (game === "warmup")
    return { digits: Array.from({ length: 3 }, () => randomInt(10)).join("") };
  return { rounds: rounds[game].length };
}

/** Rate-limits starts per player per hour. Returns the counter update. */
export function checkStart(player, now) {
  const key = hourKey(now);
  const count = player?.hourKey === key ? player.hourStarts || 0 : 0;
  if (count >= STARTS_PER_HOUR)
    throw new GameError(429, "rate_limited", "Too many games this hour.");
  return { hourKey: key, hourStarts: count + 1 };
}

/** Grades submitted answers against the server's own answer key. */
export function grade(play, answers) {
  if (play.game === "ladder" || play.game === "ladder_daily") {
    if (
      !Array.isArray(answers) ||
      answers.length < 1 ||
      answers.length > LADDER_ROUNDS ||
      !answers.every(
        (a) =>
          typeof a === "string" && a.length <= LADDER_MAX && /^\d*$/.test(a),
      )
    )
      throw new GameError(400, "bad_answers", "Submit every round you played.");
    const climb = scoreLadder(play.challenge.sequences, answers);
    // only a finished climb counts, with no rounds after it ended
    if (!climb.over || climb.rounds.length !== answers.length)
      throw new GameError(400, "bad_answers", "Finish the climb first.");
    return { score: climb.score, max: LADDER_MAX - LADDER_START + 1 };
  }
  if (play.game === "warmup") {
    if (typeof answers !== "string" || !/^\d{3}$/.test(answers))
      throw new GameError(400, "bad_answers", "Enter three digits.");
    const correct = answers === play.challenge.digits;
    return { score: correct ? 1 : 0, max: 1 };
  }
  const key = rounds[play.game];
  if (
    !Array.isArray(answers) ||
    answers.length !== key.length ||
    !answers.every(
      (a, i) => Number.isInteger(a) && a >= 0 && a < key[i].options.length,
    )
  )
    throw new GameError(400, "bad_answers", "Answers don't match this game.");
  return {
    score: answers.filter((a, i) => a === key[i].answer).length,
    max: key.length,
  };
}

export function xpFor(game, score, max) {
  if (game === "warmup") return score ? 5 : 1;
  return score * 10 + (score === max ? 10 : 0);
}

/**
 * Settles a finished play. Throws GameError when the play can't count.
 * Returns the player document to write and what to show the player.
 */
export function settle({ play, player, uid, answers, now }) {
  if (!play || play.uid !== uid)
    throw new GameError(404, "no_play", "This game wasn't found.");
  if (play.status !== "open")
    throw new GameError(
      409,
      "already_finished",
      "This game was already scored.",
    );
  const elapsed = now - play.startedAt;
  if (elapsed > PLAY_TTL_MS)
    throw new GameError(410, "expired", "This game expired. Start a new one.");
  if (elapsed < MIN_DURATION_MS[play.game])
    throw new GameError(
      422,
      "too_fast",
      "That was faster than the game allows.",
    );

  const { score, max } = grade(play, answers);
  const today = dayKey(now);
  const sameDay = player?.dailyKey === today;
  const dailyXp = sameDay ? player.dailyXp || 0 : 0;
  const earned = xpFor(play.game, score, max);
  const xpGained = Math.max(0, Math.min(earned, DAILY_XP_CAP - dailyXp));

  const yesterday = dayKey(now - 86_400_000);
  const last = player?.lastPlayed;
  const streak =
    last === today
      ? player.streak || 1
      : last === yesterday
        ? (player.streak || 0) + 1
        : 1;

  const best = { ...(player?.best || {}) };
  const newBest = score > (best[play.game] ?? -1);
  if (newBest) best[play.game] = score;
  const xp = (player?.xp || 0) + xpGained;

  return {
    result: {
      score,
      max,
      xpGained,
      capped: xpGained < earned,
      newBest,
      streak,
      ...levelProgress(xp),
    },
    player: {
      xp,
      level: levelFor(xp),
      streak,
      lastPlayed: today,
      dailyKey: today,
      dailyXp: dailyXp + xpGained,
      best,
      games: (player?.games || 0) + 1,
    },
  };
}

/** Public name for the leaderboard: chosen nickname, else first name only. */
export function publicName(nickname, tokenName) {
  const pick =
    (nickname || "").trim() || (tokenName || "").trim().split(/\s+/)[0];
  return (pick || "Player").slice(0, 24);
}
