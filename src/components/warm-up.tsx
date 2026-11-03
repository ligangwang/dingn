"use client";
import { useEffect, useRef, useState } from "react";
import { dailyLadder, scoreLadder } from "@/data/ladder.mjs";
import { useXpPlay, XpSummary } from "./xp";
type Phase = "ready" | "memorize" | "recall" | "round" | "done";
const bestKey = "dingn.memory-ladder.best.v1";
export function WarmUp() {
  const [daily, setDaily] = useState(false);
  const [day, setDay] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [sequences, setSequences] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [best, setBest] = useState(0);
  const [starting, setStarting] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const deadline = useRef(0);
  const xp = useXpPlay<{ sequences: string[]; day?: string }>(
    daily ? "ladder_daily" : "ladder",
  );
  const result = scoreLadder(sequences, answers);
  const length = result.length;
  const sequence = sequences[answers.length]?.slice(0, length) ?? "";
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(bestKey));
      if (Number.isInteger(saved) && saved >= 0 && saved <= 8) setBest(saved);
    } catch {}
  }, []);
  function memorize() {
    lock.current = false;
    setAnswer("");
    setPhase("memorize");
  }
  async function start() {
    if (starting) return;
    setStarting(true);
    const challenge = await xp.begin();
    const today = challenge?.day ?? new Date().toISOString().slice(0, 10);
    const random = () =>
      Array.from(
        crypto.getRandomValues(new Uint32Array(8)),
        (n) => n % 10,
      ).join("");
    setDay(today);
    setSequences(
      challenge?.sequences ??
        (daily ? dailyLadder(today) : Array.from({ length: 6 }, random)),
    );
    setAnswers([]);
    setShareMessage("");
    setStarting(false);
    memorize();
  }
  function finishRound(value: string) {
    if (lock.current) return;
    lock.current = true;
    const next = [...answers, value];
    setAnswers(next);
    setPhase("round");
    const scored = scoreLadder(sequences, next);
    if (scored.best > best) {
      setBest(scored.best);
      try {
        localStorage.setItem(bestKey, String(scored.best));
      } catch {}
    }
    if (next.length === 6) void xp.submit(next);
  }
  useEffect(() => {
    if (phase !== "memorize" && phase !== "recall") return;
    const seconds = phase === "memorize" ? length : 15;
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(left);
      if (!left) {
        if (phase === "memorize") setPhase("recall");
        else finishRound(input.current?.value ?? "");
      }
    };
    const timer = window.setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // Round state stays fixed throughout each timed phase; typing must not restart the clock.
  }, [phase]);
  useEffect(() => {
    if (phase === "recall") input.current?.focus();
  }, [phase]);
  const last = result.rounds.at(-1);
  const shareText = `Memory Ladder${daily ? ` · ${day} UTC` : ""}: ${result.score}/6 rounds · ${result.best} digits recalled. Can you beat it? https://dingn.com/#warm-up`;
  async function share() {
    try {
      await navigator.clipboard.writeText(shareText);
      setShareMessage("Result copied. Send it to a friend!");
    } catch {
      setShareMessage(shareText);
    }
  }
  return (
    <section className="warmup ladder" aria-label="Memory Ladder">
      <div className="warmup-top">
        <span className="eyebrow">MEMORY LADDER</span>
        <span className="live-dot">
          {xp.signedIn ? "PLAY FOR XP" : "PLAY WITHOUT SIGNING IN"}
        </span>
      </div>
      <div className="warmup-body">
        <div className="warmup-copy">
          <h2>
            How high can
            <br />
            your memory climb?
          </h2>
          <p>
            Six rounds. Start with three digits. Get them right to add one more.
            Miss a round? Try a fresh sequence at the same level.
          </p>
          <p>About two minutes · 15 seconds to answer each round.</p>
          <p className="ladder-best">
            Best on this device:{" "}
            {best ? `${best} digits` : "Set your first record"}
          </p>
          <ol className="ladder-steps" aria-label="Digits to master">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <li key={n} className={result.best >= n ? "cleared" : ""}>
                {n}
                <span className="sr-only">
                  {" "}
                  digits{result.best >= n ? " cleared" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="warmup-play">
          {phase === "ready" && (
            <>
              <div
                className="digit-tabs"
                role="group"
                aria-label="Challenge type"
              >
                <button aria-pressed={!daily} onClick={() => setDaily(false)}>
                  Free play
                </button>
                <button aria-pressed={daily} onClick={() => setDaily(true)}>
                  Daily challenge
                </button>
              </div>
              <p>
                {daily
                  ? "The same sequences for everyone. Resets at midnight UTC. Replays are welcome."
                  : "Fresh numbers every game. Build your personal best."}
              </p>
              <button className="button" disabled={starting} onClick={start}>
                {starting ? "Getting ready…" : "Start climbing →"}
              </button>
            </>
          )}
          {(phase === "memorize" || phase === "recall") && (
            <div className="ladder-hud">
              <span>
                Round {answers.length + 1} / 6 · {length} digits
              </span>
              <span role="timer" aria-label="Seconds remaining">
                {remaining}s
              </span>
            </div>
          )}
          {phase === "memorize" && (
            <>
              <p role="status">Memorize the sequence.</p>
              <div
                className="digit-slots"
                aria-label={`Remember ${sequence.split("").join(", ")}`}
              >
                {sequence.split("").map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
              <p>The numbers disappear when time runs out.</p>
            </>
          )}
          {phase === "recall" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (answer.length === length) finishRound(answer);
              }}
            >
              <label htmlFor="ladder-answer">
                What were the {length} digits?
              </label>
              <input
                ref={input}
                id="ladder-answer"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={length}
                value={answer}
                onChange={(e) =>
                  setAnswer(e.target.value.replace(/\D/g, "").slice(0, length))
                }
              />
              <button className="button" disabled={answer.length !== length}>
                Check answer →
              </button>
            </form>
          )}
          {phase === "round" && last && (
            <>
              <div role="status">
                <h3 className={last.correct ? "win" : ""}>
                  {last.correct ? "One rung higher!" : "A miss, not the end."}
                </h3>
                <p>
                  {last.correct
                    ? `${last.expected.length} digits remembered.`
                    : `You entered ${last.answer || "no answer"}. The sequence was ${last.expected}.`}
                </p>
                <div
                  className="digit-slots ladder-review"
                  aria-label="Correct sequence"
                >
                  {last.expected.split("").map((n, i) => (
                    <span
                      className={last.answer[i] === n ? "matched" : "missed"}
                      key={i}
                    >
                      {n}
                      <small>{last.answer[i] === n ? "✓" : "×"}</small>
                    </span>
                  ))}
                </div>
                <p>
                  {answers.length < 6
                    ? last.correct
                      ? `Next up: ${length} digits.`
                      : `Stay with ${length} digits. You’ve got another shot.`
                    : "Six rounds complete. See how you did."}
                </p>
              </div>
              <button
                className="button"
                onClick={() =>
                  answers.length === 6 ? setPhase("done") : memorize()
                }
              >
                {answers.length === 6 ? "See results →" : "Next round →"}
              </button>
            </>
          )}
          {phase === "done" && (
            <>
              <h3 className="round-result win">
                {result.score === 6
                  ? "Top of the ladder!"
                  : "Your climb is complete."}
              </h3>
              <p>
                {result.score} / 6 correct · Longest recall: {result.best}{" "}
                digits
              </p>
              <p>
                {result.score
                  ? "Ready to take it one digit further?"
                  : "Try saying the digits in small groups, then have another go."}
              </p>
              <XpSummary
                outcome={xp.outcome}
                signedIn={xp.signedIn}
                returnTo="/#warm-up"
              />
              <div className="ladder-actions">
                <button
                  className="button"
                  disabled={starting || xp.outcome.kind === "saving"}
                  onClick={start}
                >
                  {starting ? "Getting ready…" : "Play again →"}
                </button>
                <button className="secondary-button" onClick={share}>
                  Share result
                </button>
                <button
                  className="text-button"
                  onClick={() => setPhase("ready")}
                >
                  Choose challenge
                </button>
              </div>
              <p role="status">{shareMessage}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
