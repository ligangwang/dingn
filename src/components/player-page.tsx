"use client";
// A player's public page (/player/<number>/), the one anyone may open from
// the leaderboard or a shared link, signed in or not. It shows only what a
// player shows the world: nickname, avatar and honor, level and XP, streak,
// kingdom and badges. Never their email, coins or account id; the number in
// the address is a public one (ensurePlayerNumber in scripts/game-api.mjs).
// Every number shares the one exported page, which reads it from the address.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { Avatar } from "./avatar";
import { BadgeMedal } from "./rewards-art";
import { titleOf, useGameTitles } from "./rewards";
import { HonorPath, honorOf } from "./honor";
import { pick } from "@/lib/i18n";
import { STAGES } from "@/data/kingdom.mjs";
import { fetchPlayer, XpError, type PublicPlayer } from "@/lib/xp";

/** The public number in the address, or null. */
export function numberFromPath(path: string) {
  return /\/player\/([1-9]\d{9})\/?$/.exec(path)?.[1] ?? null;
}

export function PlayerPage() {
  const { t } = useLocale();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const number = numberFromPath(window.location.pathname);
    if (!number) {
      setError("No player has that number.");
      return;
    }
    let active = true;
    fetchPlayer(number)
      .then((p) => active && setPlayer(p))
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof XpError && e.code === "no_player"
              ? "No player has that number."
              : "This page couldn’t be loaded. Try again in a moment.",
          ),
      );
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="container profile-page player-page">
      {error ? (
        <section className="panel">
          <h1>{t("Player not found")}</h1>
          <p className="muted">{t(error)}</p>
        </section>
      ) : !player ? (
        <p className="muted">{t("Loading…")}</p>
      ) : (
        <PlayerView player={player} />
      )}
    </div>
  );
}

function PlayerView({ player }: { player: PublicPlayer }) {
  const { t, locale, href } = useLocale();
  const session = useOptionalSession();
  const mine =
    !!session?.stats?.number && session.stats.number === player.number;
  const honor = honorOf(player.level);
  const span = Math.max(1, player.next - player.floor);
  const into = Math.min(span, Math.max(0, player.xp - player.floor));
  let stage: (typeof STAGES)[number] | undefined;
  for (const s of STAGES) if (player.level >= s.level) stage = s;
  const gameName = useGameTitles(player.badges.map((b) => b.game));
  useEffect(() => {
    document.title = `${player.name} · dingn`;
  }, [player.name]);
  return (
    <>
      <header className="profile-head">
        <div className="profile-who">
          <div className={`profile-avatar honor-${honor.tier}`}>
            <Avatar
              choice={player.avatar}
              name={player.name}
              user={null}
              size={84}
            />
            <span className="profile-medal">
              <BadgeMedal
                tier={honor.tier}
                level={player.level}
                levelText={t("LV")}
                size={40}
                label={t(`Account level ${player.level}`)}
              />
            </span>
          </div>
          <div className="profile-name">
            <h1>{player.name}</h1>
            <p className={`profile-honor honor-${honor.tier}`}>
              {t(honor.title)}
            </p>
            {mine && (
              <Link
                className="profile-public"
                href={href("/account/#settings")}
              >
                {t("This is your public page. Edit your profile →")}
              </Link>
            )}
          </div>
        </div>
        <dl className="profile-stats">
          <div className="profile-stat profile-level">
            <dt>{t("Level")}</dt>
            <dd>
              <strong>{player.level}</strong>
              <span
                className="xp-bar"
                role="progressbar"
                aria-label={t(`Progress to level ${player.level + 1}`)}
                aria-valuemin={0}
                aria-valuemax={span}
                aria-valuenow={into}
              >
                <span style={{ width: `${(into / span) * 100}%` }} />
              </span>
              <small>
                {t(`${player.xp.toLocaleString(locale)} XP in all`)}
              </small>
            </dd>
          </div>
          <div className="profile-stat">
            <dt>{t("Kingdom")}</dt>
            <dd>
              <strong>{stage ? pick(stage.title, locale, true) : "–"}</strong>
            </dd>
          </div>
          <div className="profile-stat">
            <dt>{t("Badges")}</dt>
            <dd>
              <strong>{player.badges.length}</strong>
            </dd>
          </div>
          <div className="profile-stat">
            <dt>{t("Streak")}</dt>
            <dd>
              <strong>{`🔥 ${player.streak}`}</strong>
              <small>{t("days")}</small>
            </dd>
          </div>
        </dl>
      </header>
      <div className="player-body">
        <section
          className="panel player-badges"
          aria-labelledby="player-badges-title"
        >
          <h2 id="player-badges-title">
            {t("Badges")} <small>{player.badges.length}</small>
          </h2>
          {player.badges.length ? (
            <ul>
              {player.badges.map((badge) => (
                <li key={`${badge.game}/${badge.id}`}>
                  <BadgeMedal
                    tier={badge.tier}
                    level={badge.level}
                    icon={badge.icon}
                    levelText={t("LEVEL")}
                    size={56}
                    label={titleOf(badge.title, locale)}
                  />
                  <strong>{titleOf(badge.title, locale)}</strong>
                  <small>{gameName(badge.game)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t("No badges yet.")}</p>
          )}
        </section>
        <HonorPath stats={player} />
        {!mine && (
          <Link className="button" href={href("/#games")}>
            {t("Play games and rise too →")}
          </Link>
        )}
      </div>
    </>
  );
}
