"use client";
// The honors a player rises through with their account level: the ring and
// medal round their avatar, and their title, on their own profile page
// (account.tsx) and on the page others see (player-page.tsx).
import type React from "react";
import { useLocale } from "./locale";
import { BadgeMedal } from "./rewards-art";
import { Avatar } from "./avatar";

/**
 * The ranks a player rises through, from a wanderer to the ruler of a
 * capital. Each opens at a level, in the badge tiers' metals; the titles
 * follow the kingdom's stages (src/data/kingdom.mjs).
 */
export const HONORS = [
  { level: 1, tier: "bronze", title: "Wanderer" },
  { level: 2, tier: "bronze", title: "Camp leader" },
  { level: 4, tier: "bronze", title: "Village elder" },
  { level: 6, tier: "silver", title: "Town lord" },
  { level: 10, tier: "gold", title: "City governor" },
  { level: 15, tier: "gold", title: "Monarch" },
  { level: 20, tier: "diamond", title: "High monarch" },
] as const;

/** The honor a level earns: the ring and medal round the avatar, and a title. */
export function honorOf(level: number): {
  tier: (typeof HONORS)[number]["tier"];
  title: string;
} {
  let honor: (typeof HONORS)[number] = HONORS[0];
  for (const h of HONORS) if (level >= h.level) honor = h;
  return { tier: honor.tier, title: honor.title };
}

/** XP to reach a level: 50 × level × (level − 1), as scripts/game-core.mjs. */
const xpFor = (level: number) => 50 * level * (level - 1);

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
            ? honorOf(level).title === h.title
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
              <strong>{t(h.title)}</strong>
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
  className = "",
  ...avatar
}: {
  level: number | null | undefined;
  size: number;
  medal: number;
  className?: string;
} & Omit<Parameters<typeof Avatar>[0], "size" | "className">) {
  const { t } = useLocale();
  const honor = level ? honorOf(level) : null;
  return (
    <span
      className={`profile-avatar honor-${honor?.tier ?? "none"} ${className}`}
    >
      <Avatar {...avatar} size={size} />
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
