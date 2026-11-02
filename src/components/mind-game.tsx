"use client";
import { useState } from "react";
import Link from "next/link";
const games = {
  logic: [
    {
      title: "Double take",
      prompt: "Follow the doubling rule: 3, 6, 12, 24, … What comes next?",
      options: ["30", "36", "48"],
      answer: 2,
      why: "Each number is twice the previous one. 24 × 2 = 48.",
    },
    {
      title: "Read the clues",
      prompt:
        "Every comet in this puzzle is blue. No blue object is a cube. Can a comet be a cube?",
      options: ["Yes", "No", "Not enough information"],
      answer: 1,
      why: "A comet must be blue, and blue objects cannot be cubes. So no comet can be a cube.",
    },
    {
      title: "Order matters",
      prompt:
        "Mia finishes before Leo. Leo finishes before Sam. Who finishes first?",
      options: ["Mia", "Leo", "Sam"],
      answer: 0,
      why: "The clues give one order: Mia → Leo → Sam.",
    },
    {
      title: "Growing gaps",
      prompt: "Add successive odd numbers: 1, 4, 9, 16, … What comes next?",
      options: ["23", "25", "32"],
      answer: 1,
      why: "The gaps are 3, 5, 7, then 9. 16 + 9 = 25.",
    },
  ],
  decisions: [
    {
      title: "Choose the average",
      prompt:
        "Your goal is the highest average score over many rounds. Route A always gives 4 points. Route B gives 10 points half the time and 0 otherwise. Choose a route.",
      options: ["Route A", "Route B"],
      answer: 1,
      why: "B averages 0.5 × 10 + 0.5 × 0 = 5 points, versus 4 for A. A is more predictable; B fits this round’s average-score goal.",
    },
    {
      title: "Protect the mission",
      prompt:
        "You need at least 4 energy to finish this one mission. Route A guarantees 4. Route B gives 10 with a 50% chance, otherwise 0. Which maximizes your chance of finishing?",
      options: ["Route A", "Route B"],
      answer: 0,
      why: "A finishes the mission 100% of the time. B finishes only 50%. A different goal changes the best choice.",
    },
    {
      title: "Spend your budget",
      prompt:
        "You have 6 energy. A shield costs 4 and earns 7 points. A scanner costs 3 and earns 6 points. You can buy multiples. What earns the most points within your budget?",
      options: ["One shield", "Two scanners", "One of each"],
      answer: 1,
      why: "Two scanners cost 6 and earn 12. One shield earns 7. One of each costs 7, over your budget.",
    },
    {
      title: "Fresh start",
      prompt:
        "You already spent 3 energy on a blocked path; it cannot be recovered. From here, finishing it costs 5 more energy. A new path costs 2 and reaches the same goal with certainty. What uses the least additional energy?",
      options: ["Finish the old path", "Take the new path"],
      answer: 1,
      why: "Compare the costs from this point: 5 versus 2. The 3 energy already spent is gone either way.",
    },
  ],
};
export function MindGame({ mode }: { mode: keyof typeof games }) {
  const rounds = games[mode];
  const [round, setRound] = useState(0),
    [choice, setChoice] = useState<number | null>(null),
    [results, setResults] = useState<boolean[]>([]);
  const score = results.filter(Boolean).length;
  const done = round === rounds.length;
  const game = rounds[Math.min(round, rounds.length - 1)];
  function choose(index: number) {
    if (choice !== null) return;
    setChoice(index);
    setResults((r) => [...r, index === game.answer]);
  }
  function restart() {
    setRound(0);
    setChoice(null);
    setResults([]);
  }
  const stars = starsFor(score, rounds.length);
  const next =
    mode === "logic"
      ? { href: "/decisions/", label: "Next game: Decisions" }
      : { href: "/logic/", label: "Next game: Logic" };
  return (
    <div className="mind-page container">
      <Link href="/">← All games</Link>
      <p className="eyebrow">
        {mode === "logic" ? "LOGIC LAB" : "DECISION ROOM"} / NO SIGN-IN
      </p>
      <h1>
        {mode === "logic" ? "Connect the clues." : "Make your next move."}
      </h1>
      <p>
        {mode === "logic"
          ? "Four puzzles. Take your time and find the reasoning."
          : "Four fictional scenarios. Match each choice to the goal."}
      </p>
      <section className="mind-panel" aria-label="Game round">
        {done ? (
          <>
            <div className="end-screen">
              <p className="eyebrow">Round complete</p>
              <div className="end-stars" aria-label={`${stars} of 3 stars`}>
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
              <h2>{endTitle(score, rounds.length)}</h2>
              <p role="status">
                {score} of {rounds.length} answers matched the goal.
              </p>
              <p className="end-hint">
                Explore the explanations and try a different approach next time.
              </p>
              <div className="end-actions">
                <button className="button" onClick={restart}>
                  Play again
                </button>
                <Link className="secondary-button" href={next.href}>
                  {next.label} →
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="game-hud">
              <div>
                <span className="hud-label">
                  Round {round + 1} of {rounds.length}
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
                  {score === 1 ? "point" : "points"}
                </span>
              </div>
            </div>
            <h2>{game.title}</h2>
            <p className="round-prompt">{game.prompt}</p>
            <div className="round-options">
              {game.options.map((option, i) => (
                <button
                  key={option}
                  disabled={choice !== null}
                  className={`round-option ${choice === i ? "picked" : ""} ${choice !== null && i === game.answer ? "correct" : ""} ${choice === i && i !== game.answer ? "wrong" : ""}`}
                  onClick={() => choose(i)}
                >
                  {option}
                  {choice !== null && i === game.answer ? " ✓" : ""}
                </button>
              ))}
            </div>
            {choice !== null && (
              <div className="round-explanation" role="status">
                <h3>
                  {choice === game.answer
                    ? "You found it."
                    : "Let’s unpack that."}
                </h3>
                <p>{game.why}</p>
                <button
                  className="button"
                  onClick={() => {
                    setRound((r) => r + 1);
                    setChoice(null);
                  }}
                >
                  {round === rounds.length - 1 ? "See results" : "Next round"} →
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <p className="game-note">
        Play for curiosity. These games are not an IQ test. Scores last for this
        session only.
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
