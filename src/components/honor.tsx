"use client";
// The honors a player rises through with their account level: the ring and
// medal round their avatar, and their title, on their own profile page
// (account.tsx) and on the page others see (player-page.tsx).
import { useLocale } from "./locale";
import { BadgeMedal } from "./rewards-art";

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
  return (
    <section className="panel honor-path" aria-labelledby="honor-path-title">
      <h2 id="honor-path-title">{t("Path of honor")}</h2>
      {stats && (
        <p className="muted">
          {next
            ? t(
                `${t(next.title)} at level ${next.level}: ${Math.max(0, xpFor(next.level) - stats.xp).toLocaleString(locale)} XP to go.`,
              )
            : t("You hold the highest honor in dingn.")}
        </p>
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
            <li key={h.title} className={`honor-step ${state}`}>
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}
