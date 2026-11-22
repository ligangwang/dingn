"use client";
// The honors a player rises through with their account level: the ring and
// medal round their avatar, and their title, on their own profile page
// (account.tsx) and on the page others see (player-page.tsx).
import type React from "react";
import { useLocale } from "./locale";
import { BadgeMedal } from "./rewards-art";
import { Avatar } from "./avatar";

import { kingdomRules, useKingdomRules } from "@/lib/reward-plugin";
import type * as Honors from "kingdom/honors";

// The honors themselves (titles, levels, metals and numerals) are the
// reward system's: the live kingdom plugin's honors module
// (src/lib/reward-plugin.ts). This file draws them. A component that uses
// these calls useKingdomRules(), so it redraws when the plugin's arrive;
// until then there are no honors: an empty name, and no honor.
export const honorName = (...a: Parameters<typeof Honors.honorName>): string =>
  kingdomRules()?.honors.honorName(...a) ?? "";
export const honorOf = (
  ...a: Parameters<typeof Honors.honorOf>
): ReturnType<typeof Honors.honorOf> | null =>
  kingdomRules()?.honors.honorOf(...a) ?? null;
export { useKingdomRules };

/**
 * Every rank on one road: the ones reached lit, the next one marked with the
 * XP still to go, the rest waiting with the level that opens them.
 */
export function HonorPath({
  stats,
}: {
  stats: { level: number; xp: number } | null | undefined;
}) {
  const { t, locale } = useLocale();
  const rules = useKingdomRules();
  if (!rules) return null;
  return <HonorRoad stats={stats} rules={rules} t={t} locale={locale} />;
}

function HonorRoad({
  stats,
  rules: {
    honors: { HONORS },
    levels: { xpToReach: xpFor },
  },
  t,
  locale,
}: {
  stats: { level: number; xp: number } | null | undefined;
  rules: NonNullable<ReturnType<typeof useKingdomRules>>;
  t: (text: string) => string;
  locale: string;
}) {
  const level = stats?.level ?? 0;
  const next = HONORS.find((h) => h.level > level);
  // How far along the road to the next rank: the line to it fills in.
  const from = xpFor(HONORS.findLast((h) => h.level <= level)?.level ?? 1);
  const toGo = stats && next ? Math.max(0, xpFor(next.level) - stats.xp) : 0;
  const fill =
    stats && next
      ? Math.min(1, Math.max(0, (stats.xp - from) / (xpFor(next.level) - from)))
      : 0;
  return (
    <section className="panel honor-path" aria-labelledby="honor-path-title">
      <h2 id="honor-path-title">{t("Path of honor")}</h2>
      {stats && !next && (
        <p className="muted">{t("You hold the highest honor in dingn.")}</p>
      )}
      <ol>
        {HONORS.map((h) => {
          const reached = level >= h.level;
          const state = reached
            ? honorOf(level)?.title === h.title
              ? "current"
              : "reached"
            : next === h
              ? "next"
              : "locked";
          return (
            <li
              key={h.title}
              className={`honor-step ${state}`}
              style={
                state === "next"
                  ? ({ "--fill": fill } as React.CSSProperties)
                  : undefined
              }
            >
              <BadgeMedal
                tier={h.tier}
                level={h.level}
                locked={!reached}
                levelText={t("LV")}
                size={52}
                label={t(h.title)}
              />
              <strong>
                {state === "current" ? honorName(level, t) : t(h.title)}
              </strong>
              <small>{t(`Level ${h.level}+`)}</small>
              {state === "next" && stats && (
                <small className="honor-to-go">
                  {t(`${toGo.toLocaleString(locale)} XP to go`)}
                </small>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * A player's avatar in the ring of their honor's metal, with their level on
 * a medal at its foot: in the site header, on their profile page and on
 * their public page. Without a level it is the plain avatar in a grey ring.
 */
export function HonorAvatar({
  level,
  size,
  medal,
  tester = false,
  className = "",
  ...avatar
}: {
  level: number | null | undefined;
  size: number;
  medal: number;
  /** A test account: a striped ring and a TEST tag, so it is never mistaken for a player. */
  tester?: boolean;
  className?: string;
} & Omit<Parameters<typeof Avatar>[0], "size" | "className">) {
  const { t } = useLocale();
  useKingdomRules();
  const honor = level ? honorOf(level) : null;
  return (
    <span
      className={`profile-avatar honor-${honor?.tier ?? "none"}${tester ? " is-tester" : ""} ${className}`}
    >
      <Avatar {...avatar} size={size} />
      {tester && (
        <span
          className="tester-tag"
          style={{ fontSize: Math.max(8, Math.round(size * 0.22)) }}
          title={t("Test account")}
        >
          {t("TEST")}
        </span>
      )}
      {level && honor ? (
        <span className="profile-medal">
          <BadgeMedal
            tier={honor.tier}
            level={level}
            // An account level, not a game's: its own word on the medal.
            levelText={t("LV")}
            size={medal}
            label={t(`Account level ${level}`)}
          />
        </span>
      ) : null}
    </span>
  );
}
