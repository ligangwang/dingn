"use client";
// Another player's kingdom, on their public page (player-page.tsx): the same
// 3D island they build on /kingdom/ (the kingdom package's scene), to turn and zoom
// around but not change. The scene and its models load only once the
// kingdom scrolls into view, so the page itself stays light.
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./locale";
import { pick as textIn } from "@/lib/i18n";
import { building, type StageId } from "kingdom/kingdom";
import type { KingdomScene } from "kingdom/scene";

export type VisitedKingdom = {
  stage: StageId;
  size: number;
  hall: StageId;
  tiles: Record<string, string>;
};

export function KingdomVisit({
  kingdom,
  label,
}: {
  kingdom: VisitedKingdom;
  label: string;
}) {
  const { t, locale } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<KingdomScene | null>(null);
  const [near, setNear] = useState(false);
  const [loading, setLoading] = useState<number | null>(0);
  const [noWebgl, setNoWebgl] = useState(false);
  // The island stays still until the visitor chooses to look around, so a
  // swipe or the mouse wheel over it still scrolls the page.
  const [exploring, setExploring] = useState(false);

  // Wait until it is nearly on screen before loading three.js and the models.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          watch.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    if (!near || scene.current) return;
    let cancelled = false;
    void import("kingdom/scene").then(({ KingdomScene, webglAvailable }) => {
      if (cancelled || !host.current) return;
      if (!webglAvailable()) return setNoWebgl(true);
      scene.current = new KingdomScene(host.current, {
        // A visit: looking around only, nothing to build or move.
        onTile: () => {},
        reducedMotion:
          typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches,
        onProgress: setLoading,
        onReady: () => setLoading(null),
      });
      scene.current.set(
        { size: kingdom.size, hall: kingdom.hall, tiles: kingdom.tiles },
        { animate: false },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [near, kingdom]);

  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
    },
    [],
  );

  return (
    <div className={`player-kingdom${exploring ? " is-exploring" : ""}`}>
      <div
        className={`player-kingdom-canvas${loading === null ? " is-ready" : ""}`}
        ref={host}
        role="img"
        aria-label={label}
      />
      {loading !== null && !noWebgl && (
        <div className="kingdom-loading" role="status">
          <p>{t("Building the kingdom…")}</p>
          <div className="kingdom-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(loading * 100)}%` }} />
          </div>
        </div>
      )}
      {loading === null && (
        <button
          type="button"
          className="player-kingdom-explore"
          aria-pressed={exploring}
          onClick={() => setExploring((on) => !on)}
        >
          {t(exploring ? "Done" : "Look around")}
        </button>
      )}
      {noWebgl && (
        <ul className="player-kingdom-list">
          {Object.values(kingdom.tiles).map((id, i) => (
            <li key={i}>
              {textIn(building(id)?.title ?? { en: id, zh: id }, locale, true)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
