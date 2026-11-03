"use client";
import { useLocale } from "@/components/locale";

import { useEffect, useState } from "react";
import Link from "next/link";
import mindGames from "@/data/mind-games.json";
import { Leaderboard, useXpPlay, XpSummary } from "./xp";
type MindRound = {
  title: string;
  prompt: string;
  options: string[];
  answer: number;
  why: string;
};
const games = mindGames as Record<"logic" | "decisions", MindRound[]>;

export function MindGame({ mode }: { mode: keyof typeof games }) {
  const { t, locale } = useLocale();

  const rounds = games[mode];
  const [round, setRound] = useState(0),
    [choice, setChoice] = useState<number | null>(null),
    [answers, setAnswers] = useState<number[]>([]);
  const xp = useXpPlay(mode);
  const { begin, submit } = xp;
  const results = answers.map((a, i) => a === rounds[i].answer);
  useEffect(() => {
    void begin();
  }, [begin]);
  const score = results.filter(Boolean).length;
  const done = round === rounds.length;
  const game = rounds[Math.min(round, rounds.length - 1)];
  function choose(index: number) {
    if (choice !== null) return;
    setChoice(index);
    setAnswers((a) => [...a, index]);
  }
  function restart() {
    setRound(0);
    setChoice(null);
    setAnswers([]);
    void begin();
  }
  const stars = starsFor(score, rounds.length);
  const next =
    mode === "logic"
      ? { href: "/decisions/", label: "Next game: Decisions" }
      : { href: "/logic/", label: "Next game: Logic" };
  return (
    <div className="mind-page container">
      <Link href="/">{t("← All games")}</Link>
      <p className="eyebrow">
        {t(mode === "logic" ? "LOGIC LAB" : "DECISION ROOM")}
        {t("/ NO SIGN-IN")}
      </p>
      <h1>
        {t(mode === "logic" ? "Connect the clues." : "Make your next move.")}
      </h1>
      <p>
        {t(
          mode === "logic"
            ? "Four puzzles. Take your time and find the reasoning."
            : "Four fictional scenarios. Match each choice to the goal.",
        )}
      </p>
      <section className="mind-panel" aria-label={t("Game round")}>
        {done ? (
          <>
            <div className="end-screen">
              <p className="eyebrow">{t("Round complete")}</p>
              <div className="end-stars" aria-label={t(`${stars} of 3 stars`)}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < stars ? "on" : ""}>
                    ★
                  </span>
                ))}
              </div>
              <div className="end-score">
                {score}
                <small>/{rounds.length}</small>
              </div>
              <h2>{t(endTitle(score, rounds.length))}</h2>
              <p role="status">
                {t(`${score} of ${rounds.length} answers matched the goal.`)}
              </p>
              <XpSummary
                outcome={xp.outcome}
                signedIn={xp.signedIn}
                returnTo={`/${mode}/`}
              />
              <div className="end-actions">
                <button className="button" onClick={restart}>
                  {t("Play again")}
                </button>
                <Link className="secondary-button" href={next.href}>
                  {t(next.label)} →
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="game-hud">
              <div>
                <span className="hud-label">
                  {t(`Round ${round + 1} of ${rounds.length}`)}
                </span>
                <ol className="round-pips" aria-hidden="true">
                  {rounds.map((_, i) => (
                    <li
                      key={i}
                      className={
                        i < results.length
                          ? results[i]
                            ? "hit"
                            : "miss"
                          : i === round
                            ? "current"
                            : ""
                      }
                    />
                  ))}
                </ol>
              </div>
              <div className="hud-score">
                <span key={score} className="score-value">
                  {score}
                </span>
                <span className="hud-label">
                  {t(score === 1 ? "point" : "points")}
                </span>
              </div>
            </div>
            <h2>{t(game.title)}</h2>
            <p className="round-prompt">{t(game.prompt)}</p>
            <div className="round-options">
              {game.options.map((option, i) => (
                <button
                  key={option}
                  disabled={choice !== null}
                  className={`round-option ${choice === i ? "picked" : ""} ${choice !== null && i === game.answer ? "correct" : ""} ${choice === i && i !== game.answer ? "wrong" : ""}`}
                  onClick={() => choose(i)}
                >
                  {t(option)}
                  {t(choice !== null && i === game.answer ? " ✓" : "")}
                </button>
              ))}
            </div>
            {choice !== null && (
              <div className="round-explanation" role="status">
                <h3>
                  {t(
                    choice === game.answer
                      ? "You found it."
                      : "Let’s unpack that.",
                  )}
                </h3>
                <p>{t(game.why)}</p>
                <button
                  className="button"
                  onClick={() => {
                    if (round === rounds.length - 1) void submit(answers);
                    setRound((r) => r + 1);
                    setChoice(null);
                  }}
                >
                  {t(
                    round === rounds.length - 1 ? "See results" : "Next round",
                  )}{" "}
                  →
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {done && <Leaderboard />}
      <p className="game-note">
        {t(
          "Play for curiosity. These games are not an IQ test. Signed-in players earn XP; every score is checked by the dingn server.",
        )}
      </p>
    </div>
  );
}

export function starsFor(score: number, total: number) {
  if (score === total) return 3;
  if (score >= total - 1) return 2;
  return score > 0 ? 1 : 0;
}
function endTitle(score: number, total: number) {
  if (score === total) return "Flawless run!";
  if (score >= total - 1) return "Sharp thinking.";
  if (score > 0) return "Good start.";
  return "Warm-up complete.";
}
