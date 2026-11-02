"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function WarmUp() {
  const [phase, setPhase] = useState<
    "ready" | "memorize" | "recall" | "result"
  >("ready");
  const [sequence, setSequence] = useState("");
  const [answer, setAnswer] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (phase !== "memorize") return;
    const timer = window.setTimeout(() => setPhase("recall"), 3000);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === "recall") input.current?.focus();
  }, [phase]);
  function start() {
    const values = crypto.getRandomValues(new Uint32Array(3));
    setSequence(Array.from(values, (n) => n % 10).join(""));
    setAnswer("");
    setPhase("memorize");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setPhase("result");
  }
  return (
    <section className="warmup" aria-label="Quick memory warm-up">
      <div className="warmup-top">
        <span className="eyebrow">TRY A QUICK ROUND</span>
        <span className="live-dot">NO SIGN-IN</span>
      </div>
      <div className="warmup-body">
        <div className="warmup-copy">
          <h2>
            A tiny challenge.
            <br />A little brain buzz.
          </h2>
          <p>Three digits. Three seconds. Think you can remember them?</p>
        </div>
        <div className="warmup-play">
          <div aria-live="polite">
            {phase === "ready" && (
              <>
                <div className="digit-slots" aria-hidden="true">
                  <span>?</span>
                  <span>?</span>
                  <span>?</span>
                </div>
                <p>Ready when you are.</p>
              </>
            )}
            {phase === "memorize" && (
              <>
                <div
                  className="digit-slots"
                  aria-label={`Remember ${sequence.split("").join(", ")}`}
                >
                  {sequence.split("").map((n, i) => (
                    <span key={i}>{n}</span>
                  ))}
                </div>
                <p>Lock them in. You have 3 seconds.</p>
                <div className="memory-timer" />
              </>
            )}
            {phase === "result" && (
              <>
                <div
                  className={`round-result ${answer === sequence ? "win" : ""}`}
                >
                  {answer === sequence ? "Nailed it! ✦" : "One more round?"}
                </div>
                <p>
                  {answer === sequence
                    ? "That’s a good memory moment."
                    : `The sequence was ${sequence}. You entered ${answer}.`}
                </p>
              </>
            )}
          </div>
          {phase === "recall" && (
            <form onSubmit={submit}>
              <label htmlFor="warmup-answer">What were the three digits?</label>
              <input
                ref={input}
                id="warmup-answer"
                inputMode="numeric"
                pattern="[0-9]{3}"
                autoComplete="off"
                maxLength={3}
                required
                value={answer}
                onChange={(event) =>
                  setAnswer(event.target.value.replace(/\D/g, "").slice(0, 3))
                }
              />
              <button className="button" type="submit">
                Check answer →
              </button>
            </form>
          )}
          {(phase === "ready" || phase === "result") && (
            <button className="button" onClick={start}>
              {phase === "ready" ? "Let’s play" : "Play again"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
