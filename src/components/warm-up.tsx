"use client";
import { useLocale } from "@/components/locale";

import { useEffect, useRef, useState } from "react";
import {
  dailyLadder,
  LADDER_LIVES,
  LADDER_MAX,
  ladderSequences,
  scoreLadder,
} from "@/data/ladder.mjs";
import { useXpPlay, XpSummary } from "./xp";
type Phase = "ready" | "memorize" | "recall" | "round" | "done";
const bestKey = "dingn.memory-ladder.best.v1";
/** Rungs marked on the ladder beside the game. */
const MILESTONES = [3, 5, 8, 10, 12, 15, LADDER_MAX];
/** Seconds to type the answer: longer sequences get longer. */
const recallSeconds = (length: number) => Math.max(15, Math.ceil(length * 1.5));
export function WarmUp() {
  const { t, locale } = useLocale();

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
      if (Number.isInteger(saved) && saved >= 0 && saved <= LADDER_MAX)
        setBest(saved);
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
      ladderSequences(() => crypto.getRandomValues(new Uint32Array(1))[0] % 10);
    setDay(today);
    setSequences(
      challenge?.sequences ?? (daily ? dailyLadder(today) : random()),
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
    if (scored.over) void xp.submit(next);
  }
  useEffect(() => {
    if (phase !== "memorize" && phase !== "recall") return;
    const seconds = phase === "memorize" ? length : recallSeconds(length);
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
  const shareText = t(
    `Memory Ladder${daily ? ` · ${day} UTC` : ""}: ${result.best} digits recalled. Can you beat it? https://dingn.com/#warm-up`,
  );
  async function share() {
    try {
      await navigator.clipboard.writeText(shareText);
      setShareMessage("Result copied. Send it to a friend!");
    } catch {
      setShareMessage(shareText);
    }
  }
  return (
    <section className="warmup ladder" aria-label={t("Memory Ladder")}>
      <div className="warmup-top">
        <span className="eyebrow">{t("MEMORY LADDER")}</span>
        <span className="live-dot">
          {t(xp.signedIn ? "PLAY FOR XP" : "PLAY WITHOUT SIGNING IN")}
        </span>
      </div>
      <div className="warmup-body">
        <div className="warmup-copy">
          <h2>
            {t("How high can")}
            <br />
            {t("your memory climb?")}
          </h2>
          <p>
            {t(
              "Start with three digits. Get them right to add one more, all the way up to 20. Miss a round? Try a fresh sequence at the same length. Three misses end the climb.",
            )}
          </p>
          <p>{t("At least 15 seconds to answer each round.")}</p>
          <p className="ladder-best">
            {t("Best on this device:")}{" "}
            {t(best ? `${best} digits` : "Set your first record")}
          </p>
          <ol className="ladder-steps" aria-label={t("Digits to master")}>
            {MILESTONES.map((n) => (
              <li key={n} className={result.best >= n ? "cleared" : ""}>
                {n}
                <span className="sr-only">
                  {" "}
                  {t("digits")}
                  {t(result.best >= n ? " cleared" : "")}
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
                aria-label={t("Challenge type")}
              >
                <button aria-pressed={!daily} onClick={() => setDaily(false)}>
                  {t("Free play")}
                </button>
                <button aria-pressed={daily} onClick={() => setDaily(true)}>
                  {t("Daily challenge")}
                </button>
              </div>
              <p>
                {t(
                  daily
                    ? "The same sequences for everyone. Resets at midnight UTC. Replays are welcome."
                    : "Fresh numbers every game. Build your personal best.",
                )}
              </p>
              <button className="button" disabled={starting} onClick={start}>
                {t(starting ? "Getting ready…" : "Start climbing →")}
              </button>
            </>
          )}
          {(phase === "memorize" || phase === "recall") && (
            <div className="ladder-hud">
              <span>{t(`Round ${answers.length + 1} · ${length} digits`)}</span>
              <span
                className="ladder-lives"
                aria-label={t(`${result.lives} of ${LADDER_LIVES} lives left`)}
              >
                {"♥".repeat(result.lives)}
                {"♡".repeat(LADDER_LIVES - result.lives)}
              </span>
              <span role="timer" aria-label={t("Seconds remaining")}>
                {remaining}
                {t("s")}
              </span>
            </div>
          )}
          {phase === "memorize" && (
            <>
              <p role="status">{t("Memorize the sequence.")}</p>
              <div
                className={`digit-slots${length > 10 ? " long" : ""}`}
                aria-label={t(`Remember ${sequence.split("").join(", ")}`)}
              >
                {sequence.split("").map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
              <p>{t("The numbers disappear when time runs out.")}</p>
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
                {t(`What were the ${length} digits?`)}
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
                {t("Check answer →")}
              </button>
            </form>
          )}
          {phase === "round" && last && (
            <>
              <div role="status">
                <h3 className={last.correct ? "win" : ""}>
                  {t(
                    last.correct ? "One rung higher!" : "A miss, not the end.",
                  )}
                </h3>
                <p>
                  {t(
                    last.correct
                      ? `${last.expected.length} digits remembered.`
                      : `You entered ${last.answer || t("no answer")}. The sequence was ${last.expected}.`,
                  )}
                </p>
                <div
                  className={`digit-slots ladder-review${last.expected.length > 10 ? " long" : ""}`}
                  aria-label={t("Correct sequence")}
                >
                  {last.expected.split("").map((n, i) => (
                    <span
                      className={last.answer[i] === n ? "matched" : "missed"}
                      key={i}
                    >
                      {n}
                      <small>{t(last.answer[i] === n ? "✓" : "×")}</small>
                    </span>
                  ))}
                </div>
                <p>
                  {t(
                    !result.over
                      ? last.correct
                        ? `Next up: ${length} digits.`
                        : `Stay with ${length} digits. Lives left: ${result.lives}.`
                      : result.best === LADDER_MAX
                        ? "You cleared all 20 digits!"
                        : "That was your last life. See how you did.",
                  )}
                </p>
              </div>
              <button
                className="button"
                onClick={() => (result.over ? setPhase("done") : memorize())}
              >
                {t(result.over ? "See results →" : "Next round →")}
              </button>
            </>
          )}
          {phase === "done" && (
            <>
              <h3 className="round-result win">
                {t(
                  result.best === LADDER_MAX
                    ? "Top of the ladder!"
                    : "Your climb is complete.",
                )}
              </h3>
              <p>
                {t(
                  `Longest recall: ${result.best} digits · ${result.score} correct rounds`,
                )}
              </p>
              <p>
                {t(
                  result.score && result.best < LADDER_MAX
                    ? "Ready to take it one digit further?"
                    : "Try saying the digits in small groups, then have another go.",
                )}
              </p>
              <XpSummary
                outcome={xp.outcome}
                signedIn={xp.signedIn}
                returnTo="/memory-ladder/"
              />
              <div className="ladder-actions">
                <button
                  className="button"
                  disabled={starting || xp.outcome.kind === "saving"}
                  onClick={start}
                >
                  {t(starting ? "Getting ready…" : "Play again →")}
                </button>
                <button className="secondary-button" onClick={share}>
                  {t("Share result")}
                </button>
                <button
                  className="text-button"
                  onClick={() => setPhase("ready")}
                >
                  {t("Choose challenge")}
                </button>
              </div>
              <p role="status">{t(shareMessage)}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
