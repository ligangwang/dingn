"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./locale";
import type { createAdventure, Snapshot } from "@/game/morrowglint-scene";
const initial: Snapshot = {
  stage: "ready",
  shot: null,
  locked: false,
  health: 5,
  remaining: 3,
  cooldown: 0,
  runeIndex: 0,
  watching: true,
  flash: -1,
  mistakes: 0,
  nearSpirit: false,
};
export function MorrowglintGame() {
  const { t, locale } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof createAdventure> | null>(null);
  const [state, setState] = useState(initial),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [paused, setPaused] = useState(false),
    [completed, setCompleted] = useState(false),
    [exploring, setExploring] = useState(false),
    [steady, setSteady] = useState(false),
    [closeCamera, setCloseCamera] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let savedSteady = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let savedClose = true;
    try {
      const saved = localStorage.getItem("dingn.morrowglint.steady");
      if (saved !== null) savedSteady = saved === "true";
      savedClose = localStorage.getItem("dingn.morrowglint.close") !== "false";
    } catch {}
    setSteady(savedSteady);
    setCloseCamera(savedClose);
    try {
      setCompleted(
        localStorage.getItem("dingn.morrowglint.chapter1") === "complete",
      );
    } catch {}
    import("@/game/morrowglint-scene")
      .then(({ createAdventure }) => {
        if (cancelled || !host.current) return;
        game.current = createAdventure(
          host.current,
          setState,
          () => setPaused(true),
          () => setFailed(true),
        );
        game.current.setSteady(savedSteady);
        game.current.setCloseCamera(savedClose);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      game.current?.dispose();
      game.current = null;
    };
  }, []);
  useEffect(() => {
    if (state.stage === "won") {
      setCompleted(true);
      try {
        localStorage.setItem("dingn.morrowglint.chapter1", "complete");
      } catch {}
    }
  }, [state.stage]);
  const active =
    ["fight", "memory", "rescue"].includes(state.stage) ||
    (state.stage === "won" && exploring);
  function start() {
    setExploring(false);
    setPaused(false);
    game.current?.start();
  }
  const objective =
    state.stage === "fight"
      ? "Clear the three shadows. Get close and cast Light pulse."
      : state.stage === "memory"
        ? state.watching
          ? "Watch the rune sequence, then repeat it."
          : "Repeat the sequence with the numbered runes."
        : state.stage === "won"
          ? "The light is back. Take a walk with Luma."
          : "Walk to the glowing pool and free the light spirit.";
  return (
    <div className="morrow-game-page">
      <div className="morrow-game-heading">
        <div>
          <p className="eyebrow">{t("PLAYABLE PROTOTYPE · CHAPTER 01")}</p>
          <h1>{locale === "zh-CN" ? "拾光幻境" : "Morrowglint"}</h1>
        </div>
        <Link href="/morrowglint/">{t("About the adventure")}</Link>
      </div>
      <div className={`morrow-stage ${state.shot ? "is-shot" : ""}`}>
        <div
          ref={host}
          className="morrow-canvas"
          tabIndex={0}
          role="application"
          aria-label={t(
            "Morrowglint courtyard. Use arrow keys or WASD to move, Space to cast, and E to rescue.",
          )}
          aria-describedby="morrow-help"
        />
        {state.shot && !paused && (
          <div className="morrow-shot">
            <p>
              {t(
                state.shot === "intro"
                  ? "CHAPTER 01 · THE FIRST LIGHT"
                  : "The shadows give way to light.",
              )}
            </p>
            <button
              className="secondary-button"
              onClick={() => game.current?.skipShot()}
            >
              {t("Skip cinematic")}
            </button>
          </div>
        )}
        {active && !failed && !state.shot && (
          <>
            <div className="morrow-hud">
              <div>
                <span className="eyebrow">{t("THE LANTERN COURTYARD")}</span>
                <p role="status">{t(objective)}</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => {
                  game.current?.pause();
                  setPaused(true);
                }}
              >
                {t("Pause")}
              </button>
            </div>
            <div
              className="morrow-health"
              aria-label={t(`Light: ${state.health} of 5`)}
            >
              <span aria-hidden="true">
                {"✦".repeat(state.health)}
                <span className="spent">{"✦".repeat(5 - state.health)}</span>
              </span>
              <small>
                {state.stage === "fight"
                  ? t(`Shadows remaining: ${state.remaining}`)
                  : t("The courtyard is safe")}
              </small>
            </div>
            {!paused && (
              <div className="morrow-actions">
                <div className="morrow-pad" aria-label={t("Movement controls")}>
                  {[
                    ["↑", 0, -1, "Move forward"],
                    ["←", -1, 0, "Move left"],
                    ["↓", 0, 1, "Move back"],
                    ["→", 1, 0, "Move right"],
                  ].map(([symbol, x, z, label]) => (
                    <button
                      key={String(label)}
                      aria-label={t(String(label))}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        game.current?.move(Number(x), Number(z));
                      }}
                      onPointerUp={() => game.current?.move(0, 0)}
                      onPointerCancel={() => game.current?.move(0, 0)}
                      onLostPointerCapture={() => game.current?.move(0, 0)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          game.current?.move(Number(x), Number(z));
                        }
                      }}
                      onKeyUp={() => game.current?.move(0, 0)}
                      onBlur={() => game.current?.move(0, 0)}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
                {state.stage === "fight" && (
                  <button
                    className="button pulse-button"
                    disabled={state.cooldown > 0}
                    onClick={() => game.current?.attack()}
                  >
                    {t(state.cooldown > 0 ? "Recharging…" : "Light pulse")}
                    <small>{t("Space · nearby shadows")}</small>
                  </button>
                )}
                {state.stage === "memory" && (
                  <div className="morrow-runes">
                    <p role="status">
                      {state.watching
                        ? t(`Watch rune ${state.flash + 1}`)
                        : t(`Runes recalled: ${state.runeIndex} of 3`)}
                    </p>
                    <div>
                      {[0, 1, 2].map((i) => (
                        <button
                          key={i}
                          disabled={state.watching}
                          className={state.flash === i ? "lit" : ""}
                          aria-label={t(`Rune ${i + 1}`)}
                          onClick={() => game.current?.rune(i)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => game.current?.replayPattern()}
                    >
                      {t("Show sequence again")}
                    </button>
                    {state.mistakes > 0 && (
                      <small>{t("No penalty. Watch and try again.")}</small>
                    )}
                  </div>
                )}
                {state.stage === "won" && (
                  <button className="button" onClick={start}>
                    {t("Play chapter again")}
                  </button>
                )}
                {state.stage === "rescue" && (
                  <button
                    className="button"
                    disabled={!state.nearSpirit}
                    onClick={() => game.current?.rescue()}
                  >
                    {t(
                      state.nearSpirit
                        ? "Free the spirit · E"
                        : "Move closer to the pool",
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {(state.stage === "ready" ||
          (state.stage === "won" && !exploring) ||
          state.stage === "lost" ||
          paused ||
          failed) && (
          <div className="morrow-overlay">
            <section
              className="morrow-dialog"
              aria-label={t("Adventure status")}
            >
              <span className="morrow-dialog-star" aria-hidden="true">
                ✦
              </span>
              <p className="eyebrow">{t("CHAPTER 01 · THE FIRST LIGHT")}</p>
              <h2>
                {t(
                  failed
                    ? "Your adventure needs 3D support"
                    : state.stage === "won"
                      ? "A little light changes everything."
                      : state.stage === "lost"
                        ? "Your light will return."
                        : paused
                          ? "Take a breath."
                          : "Someone is still waiting for you.",
                )}
              </h2>
              <p>
                {t(
                  failed
                    ? "We couldn’t start the 3D scene. Try reloading, or use a browser with WebGL 2 enabled."
                    : state.stage === "won"
                      ? "You freed Luma. Flowers return to the courtyard, and your first companion has found you."
                      : state.stage === "lost"
                        ? "The shadows caught you. Keep a little distance and cast your light when they get close. Try again with full light."
                        : paused
                          ? "The courtyard can wait. Continue whenever you’re ready."
                          : "Three shadows guard a fading light spirit. Push them back, recall the ancient runes, and bring the courtyard to life.",
                )}
              </p>
              {failed ? (
                <button
                  className="button"
                  onClick={() => window.location.reload()}
                >
                  {t("Reload adventure")}
                </button>
              ) : (
                <button
                  className="button"
                  disabled={!loaded}
                  onClick={() => {
                    if (paused && active) {
                      game.current?.resume();
                      setPaused(false);
                    } else start();
                  }}
                >
                  {t(
                    !loaded
                      ? "Preparing the courtyard…"
                      : paused && active
                        ? "Continue adventure"
                        : state.stage === "ready"
                          ? "Enter the courtyard →"
                          : "Play chapter again",
                  )}
                </button>
              )}
              {state.stage === "won" && !exploring && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setExploring(true);
                    game.current?.resume();
                    setPaused(false);
                  }}
                >
                  {t("Explore the restored courtyard")}
                </button>
              )}
              {state.stage === "won" && (
                <p className="morrow-reward">{t("COMPANION FOUND · LUMA")}</p>
              )}
              {state.stage === "ready" && completed && (
                <small>{t("Chapter completed on this device")}</small>
              )}
              {(state.stage === "won" || failed) && (
                <Link href="/feedback/">{t("Tell us what you think →")}</Link>
              )}
            </section>
          </div>
        )}
      </div>
      <div className="morrow-camera-settings" aria-label={t("Camera settings")}>
        <label>
          <input
            type="checkbox"
            checked={closeCamera}
            onChange={(e) => {
              const value = e.target.checked;
              setCloseCamera(value);
              game.current?.setCloseCamera(value);
              try {
                localStorage.setItem("dingn.morrowglint.close", String(value));
              } catch {}
            }}
          />
          {t("Close-up combat camera")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={steady}
            onChange={(e) => {
              const value = e.target.checked;
              setSteady(value);
              game.current?.setSteady(value);
              try {
                localStorage.setItem("dingn.morrowglint.steady", String(value));
              } catch {}
            }}
          />
          {t("Steady camera")}
        </label>
        <span>
          {t(
            state.locked ? "Nearby enemy in focus" : "Camera follows your hero",
          )}
        </span>
      </div>
      <div className="morrow-game-notes" id="morrow-help">
        <p>
          <strong>{t("How to play")}</strong>{" "}
          {t(
            "Tap the ground or use WASD / arrow keys to move. Space casts a pulse. Use 1–3 for runes and E to rescue. Escape pauses.",
          )}
        </p>
        <p>
          {t(
            "Early prototype · One short chapter · No purchases or account required. Completion is saved on this device only.",
          )}
        </p>
      </div>
    </div>
  );
}
