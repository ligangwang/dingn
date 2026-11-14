"use client";
// The kingdom page: the 3D island (kingdom-scene.ts, loaded only here), the
// stage and level over it, and the build panel. Signed-out visitors and
// players below level 2 see a sample kingdom.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { useSession } from "./session";
import { Coin } from "./rewards-art";
import {
  BUILDINGS,
  HALL_TITLES,
  MIN_LEVEL,
  STAGES,
  STAGE_IDS,
  building,
  isHallTile,
  tileKey,
  type BuildingDef,
  type StageId,
  type Title,
} from "@/data/kingdom.mjs";
import {
  buildInKingdom,
  fetchKingdom,
  moveInKingdom,
  type KingdomView,
} from "@/lib/kingdom";
import { setWalletCoins } from "@/lib/rewards";
import type { KingdomScene, SceneState } from "./kingdom-scene";

// What a signed-out visitor sees: a kingdom-stage city, to show where a
// camp can go.
const SAMPLE: SceneState = {
  size: 9,
  hall: "kingdom",
  tiles: {
    "0,2": "path",
    "0,3": "path",
    "0,4": "path",
    "2,0": "path",
    "3,0": "path",
    "4,0": "path",
    "-2,0": "path",
    "-3,0": "path",
    "-4,0": "path",
    "0,-2": "path",
    "0,-3": "path",
    "2,2": "house",
    "3,2": "house",
    "-2,2": "house",
    "-3,2": "house",
    "2,-2": "house",
    "-2,-2": "house",
    "4,2": "cottage",
    "-4,2": "cottage",
    "3,-3": "cottage",
    "-3,-3": "cottage",
    "4,-2": "cottage",
    "-4,-2": "cottage",
    "1,2": "market",
    "-1,2": "market",
    "1,3": "market",
    "-1,3": "well",
    "2,3": "fountain",
    "3,3": "chapel",
    "-3,3": "clock",
    "-2,3": "flowers",
    "-2,-3": "forge",
    "4,-4": "windmill",
    "3,-4": "farm",
    "2,-4": "farm",
    "-4,-4": "farm",
    "-3,-4": "farm",
    "4,4": "tower",
    "-4,4": "tower",
    "1,4": "statue",
    "-1,4": "statue",
    "4,3": "tree",
    "-4,3": "tree",
    "2,4": "flowers",
    "-2,4": "flowers",
    "0,-4": "tree",
    "1,-3": "tree",
    "-1,-3": "tree",
    "-4,-3": "tree",
    "2,-3": "tree",
  },
};
const ERRORS: Record<string, string> = {
  "not-enough-coins": "You don’t have enough coins for that yet.",
  occupied: "Something already stands there. Pick an empty tile.",
  "off-land": "That tile isn’t part of your land yet.",
  max: "You’ve built as many of those as your kingdom can hold.",
  "hall-first": "Upgrade your hall first.",
  level: "Reach a higher level to build that.",
  locked: "Reach level 2 to found your kingdom.",
};

type Pick =
  | { kind: "build"; def: BuildingDef }
  | { kind: "move"; from: [number, number] }
  | null;
type Ask = { def: BuildingDef; x?: number; y?: number } | null;

const rank = (s: StageId) => STAGE_IDS.indexOf(s);
const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Kingdom() {
  const { t, locale, href } = useLocale();
  const { user, ready } = useSession();
  const uid = user?.uid ?? "";
  const name = (title: Title) => (locale === "zh-CN" ? title.zh : title.en);

  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<KingdomScene | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  // How much of the 3D kingdom has loaded, 0 to 1; null once it is shown.
  const [loading, setLoading] = useState<number | null>(0);
  const [view, setView] = useState<KingdomView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pick, setPick] = useState<Pick>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const own = !!view?.stage;
  const shown: SceneState | null = useMemo(() => {
    if (!ready) return null;
    if (!uid) return SAMPLE;
    if (!view) return null;
    return own
      ? { size: view.size, hall: view.hall, tiles: view.tiles }
      : SAMPLE;
  }, [ready, uid, view, own]);

  useEffect(() => {
    if (!ready || !uid) return;
    let live = true;
    fetchKingdom()
      .then((v) => live && setView(v))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [ready, uid]);

  // Taps on the island, read through refs so the scene keeps one handler.
  const onTile = useRef<(x: number, y: number) => void>(() => {});
  onTile.current = (x, y) => {
    if (!own || !view || busy) return;
    const key = tileKey(x, y);
    if (pick?.kind === "build") {
      if (isHallTile(x, y)) return setNote(t(ERRORS.occupied));
      if (view.tiles[key]) return setNote(t(ERRORS.occupied));
      setAsk({ def: pick.def, x, y });
      return;
    }
    if (pick?.kind === "move") {
      if (view.tiles[key] || isHallTile(x, y)) {
        setPick(null);
        scene.current?.mark(null);
        return;
      }
      void doMove(pick.from, [x, y]);
      return;
    }
    if (view.tiles[key]) {
      setPick({ kind: "move", from: [x, y] });
      scene.current?.mark([x, y]);
      const def = building(view.tiles[key]);
      setNote(
        t(
          `Moving ${def ? name(def.title) : ""}. Tap an empty tile, or tap it again to cancel.`,
        ),
      );
    }
  };

  useEffect(() => {
    if (!shown || scene.current || !host.current) return;
    let cancelled = false;
    void import("./kingdom-scene").then(({ KingdomScene, webglAvailable }) => {
      if (cancelled || !host.current) return;
      if (!webglAvailable()) return setNoWebgl(true);
      scene.current = new KingdomScene(host.current, {
        onTile: (x, y) => onTile.current(x, y),
        reducedMotion: reducedMotion(),
        onProgress: setLoading,
        onReady: () => setLoading(null),
      });
      scene.current.set(shown, { animate: false });
    });
    return () => {
      cancelled = true;
    };
  }, [shown]);
  useEffect(() => {
    if (shown && scene.current) scene.current.set(shown);
  }, [shown]);
  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
    },
    [],
  );
  useEffect(() => {
    scene.current?.preview(pick?.kind === "build" ? pick.def.id : null);
  }, [pick]);

  const done = useCallback(
    (next: KingdomView) => {
      setView(next);
      setWalletCoins(uid, next.coins);
    },
    [uid],
  );

  async function confirm() {
    if (!ask) return;
    setBusy(true);
    try {
      const next = await buildInKingdom(ask.def.id, ask.x, ask.y);
      done(next);
      setNote(t(`${name(ask.def.title)} built.`));
      if (ask.def.hall || ask.def.max === 1) setPick(null);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setNote(t(ERRORS[code] ?? "Something went wrong. Try again."));
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }
  async function doMove(from: [number, number], to: [number, number]) {
    setBusy(true);
    try {
      done(await moveInKingdom(from, to));
      setNote("");
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setNote(t(ERRORS[code] ?? "Something went wrong. Try again."));
    } finally {
      setBusy(false);
      setPick(null);
      scene.current?.mark(null);
    }
  }

  function choose(def: BuildingDef) {
    setNote("");
    scene.current?.mark(null);
    if (def.hall) return setAsk({ def });
    setPick({ kind: "build", def });
    setPanelOpen(false);
    setNote(t(`Tap a tile to build ${name(def.title)}.`));
  }

  const stage = view?.stage ? STAGES.find((s) => s.id === view.stage)! : null;
  const nextStage = STAGES.find((s) => s.level > (view?.level ?? 0));
  const hallTitle = view ? name(HALL_TITLES[view.hall]) : "";
  const progress =
    view && nextStage
      ? Math.min(1, view.xp / (50 * nextStage.level * (nextStage.level - 1)))
      : 1;
  const xpToNext =
    view && nextStage
      ? 50 * nextStage.level * (nextStage.level - 1) - view.xp
      : 0;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const id of Object.values(view?.tiles ?? {})) c[id] = (c[id] ?? 0) + 1;
    return c;
  }, [view]);
  function lock(def: BuildingDef): string {
    if (!view || !view.stage) return "";
    const needs = STAGES.find((s) => s.id === def.stage)!;
    if (rank(def.stage) > rank(view.stage))
      return t(`Needs level ${needs.level}`);
    if (def.hall) {
      if (rank(def.stage) <= rank(view.hall)) return t("Built");
      if (rank(def.stage) !== rank(view.hall) + 1)
        return t("Earlier hall first");
      return "";
    }
    if (rank(def.stage) > rank(view.hall))
      return t(`${name(HALL_TITLES[def.stage])} first`);
    if ((counts[def.id] ?? 0) >= def.max) return t("All built");
    return "";
  }

  return (
    <div className="kingdom-page">
      <div
        className={`kingdom-canvas${loading === null ? " is-ready" : ""}`}
        ref={host}
        aria-label={t("Your kingdom in 3D")}
        role="img"
      />
      {loading !== null && !noWebgl && (
        <div className="kingdom-loading" role="status">
          <p>{t("Building the kingdom…")}</p>
          <div className="kingdom-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(loading * 100)}%` }} />
          </div>
        </div>
      )}
      {noWebgl && (
        <div className="kingdom-fallback panel">
          <p>
            {t(
              "Your browser can’t show 3D here, so here is your kingdom as a list.",
            )}
          </p>
          <ul>
            {Object.values(shown?.tiles ?? {}).map((id, i) => (
              <li key={i}>{name(building(id)?.title ?? { en: id, zh: id })}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="kingdom-hud" aria-live="polite">
        <p className="kingdom-eyebrow">{t("dingn kingdom")}</p>
        {!ready || (uid && !view && !loadError) ? (
          <h1>{t("Your kingdom")}</h1>
        ) : !uid ? (
          <>
            <h1>{t("Build your own kingdom")}</h1>
            <p>
              {t(
                "Earn XP and coins in any dingn game, then grow a camp into a capital.",
              )}
            </p>
            <Link
              className="button"
              href={`${href("/signin/")}?next=${encodeURIComponent(href("/kingdom/"))}`}
            >
              {t("Sign in to start")}
            </Link>
          </>
        ) : loadError ? (
          <>
            <h1>{t("Your kingdom")}</h1>
            <p>
              {t(
                "Your kingdom couldn’t be loaded. Reload the page to try again.",
              )}
            </p>
          </>
        ) : !own ? (
          <>
            <h1>{t("A kingdom awaits")}</h1>
            <p>
              {t(
                `Reach level ${MIN_LEVEL} to found your camp. You are level ${view!.level}.`,
              )}
            </p>
            <div className="kingdom-progress" aria-hidden="true">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="kingdom-small">
              {t(
                `${xpToNext.toLocaleString(locale)} XP to go. Play a brain game or earn a badge in any game.`,
              )}
            </p>
            <Link className="button" href={href("/logic/")}>
              {t("Play a game")}
            </Link>
          </>
        ) : (
          <>
            <h1>{t(`Your ${name(stage!.title).toLowerCase()}`)}</h1>
            <p className="kingdom-small">
              {t(`Level ${view!.level} · ${hallTitle}`)}
            </p>
            {nextStage && (
              <>
                <div className="kingdom-progress" aria-hidden="true">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="kingdom-small">
                  {t(
                    `Level ${nextStage.level}: your land grows into a ${name(nextStage.title).toLowerCase()}, ${xpToNext.toLocaleString(locale)} XP to go.`,
                  )}
                </p>
              </>
            )}
          </>
        )}
      </section>

      {own && view && (
        <>
          <button
            type="button"
            className="kingdom-build-toggle"
            hidden={panelOpen}
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {t("Build")}
          </button>
          <section
            className={`kingdom-panel${panelOpen ? " open" : ""}`}
            aria-label={t("Build")}
          >
            <header>
              <h2>{t("Build")}</h2>
              <span className="kingdom-coins">
                <Coin size={18} /> {view.coins.toLocaleString(locale)}
              </span>
              <button
                type="button"
                className="kingdom-close"
                aria-label={t("Close")}
                onClick={() => setPanelOpen(false)}
              >
                ×
              </button>
            </header>
            <ul>
              {BUILDINGS.map((def) => {
                const locked = lock(def);
                if (def.hall && locked === t("Built")) return null;
                const poor = !locked && view.coins < def.coins;
                const picked = pick?.kind === "build" && pick.def.id === def.id;
                return (
                  <li key={def.id}>
                    <button
                      type="button"
                      disabled={!!locked || poor || busy}
                      aria-pressed={picked}
                      onClick={() => choose(def)}
                    >
                      <span className="kingdom-item-name">
                        {def.hall
                          ? t(`Upgrade hall: ${name(def.title)}`)
                          : name(def.title)}
                      </span>
                      <span className="kingdom-item-meta">
                        {locked || (
                          <>
                            <Coin size={14} /> {def.coins}
                            {!def.hall && def.max > 1 && (
                              <span className="kingdom-count">
                                {" "}
                                · {counts[def.id] ?? 0}/{def.max}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="kingdom-small">
              {t("Tap a building on the island to move it, free.")}
            </p>
          </section>
        </>
      )}

      {note && (
        <div className="kingdom-note" role="status">
          <span>{note}</span>
          {pick && (
            <button
              type="button"
              onClick={() => {
                setPick(null);
                setNote("");
                scene.current?.mark(null);
              }}
            >
              {t("Done")}
            </button>
          )}
        </div>
      )}

      {ask && view && (
        <div className="spend-confirm-backdrop kingdom-confirm">
          <div
            className="spend-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kingdom-ask"
          >
            <Coin size={56} />
            <h2 id="kingdom-ask">
              {ask.def.hall
                ? t(
                    `Upgrade your hall to a ${name(ask.def.title).toLowerCase()}?`,
                  )
                : t(`Build ${name(ask.def.title)}?`)}
            </h2>
            <p>
              {t(
                `It costs ${ask.def.coins} dingn coins. You will have ${(view.coins - ask.def.coins).toLocaleString(locale)} coins left.`,
              )}
            </p>
            <div className="spend-confirm-buttons">
              <button
                type="button"
                onClick={() => setAsk(null)}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirm}
                disabled={busy}
                autoFocus
              >
                <Coin size={18} /> {t(`Build for ${ask.def.coins}`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
