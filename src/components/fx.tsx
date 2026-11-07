"use client";
import { useEffect, useState } from "react";

const COLORS = ["#d5ff58", "#3ddc97", "#ffb38a", "#b9a6ff", "#ff6b7a"];

/** A short, decorative confetti burst. Pure CSS; hidden from screen readers. */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => {
        // Spread pieces evenly with a little deterministic jitter.
        const jitter = ((i * 37) % 11) / 11;
        return (
          <span
            key={i}
            style={
              {
                "--x": `${(i / pieces) * 100 + jitter * 4 - 2}%`,
                "--drift": `${(jitter - 0.5) * 160}px`,
                "--spin": `${360 + ((i * 53) % 360)}deg`,
                "--delay": `${((i * 7) % 10) * 0.04}s`,
                "--fall": `${1.6 + jitter * 1.2}s`,
                background: COLORS[i % COLORS.length],
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Counts from 0 up to `value` over `ms`. Jumps straight there when motion is reduced. */
export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);
  return shown;
}

/** Circular progress ring, filled to `fraction` (0–1). */
export function Ring({
  fraction,
  size = 132,
  children,
}: {
  fraction: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={r} />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
