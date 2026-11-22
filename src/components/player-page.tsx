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
import { BadgeMedal } from "./rewards-art";
import { titleOf, useGameTitles } from "./rewards";
import { HonorAvatar, HonorPath, honorName, honorOf } from "./honor";
import { PencilIcon } from "./icons";
import { KingdomVisit } from "./kingdom-visit";
import { pick } from "@/lib/i18n";
import { STAGES } from "kingdom/kingdom";
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
          <HonorAvatar
            level={player.level}
            choice={player.avatar}
            name={player.name}
            user={null}
            size={84}
            medal={40}
          />
          <div className="profile-name">
            <h1>{player.name}</h1>
            <p className={`profile-honor honor-${honor.tier}`}>
              {honorName(player.level, t)}
            </p>
          </div>
          {mine && (
            // The owner can edit what this page shows, from Settings.
            <div className="profile-actions">
              <Link
                className="profile-edit"
                href={href("/account/#settings")}
                aria-label={t("Edit profile")}
                title={t("Edit profile")}
              >
                <PencilIcon size={18} />
              </Link>
            </div>
          )}
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
        {/* Their kingdom, as they built it, to look around. */}
        <section
          className="panel player-kingdom-panel"
          aria-labelledby="player-kingdom-title"
        >
          <h2 id="player-kingdom-title">
            {stage
              ? `${t("Kingdom")} · ${pick(stage.title, locale, true)}`
              : t("Kingdom")}
          </h2>
          {player.kingdom ? (
            <>
              <KingdomVisit
                kingdom={player.kingdom}
                label={t(`${player.name}’s kingdom in 3D`)}
              />
              <p className="muted">
                {mine ? (
                  <Link href={href("/kingdom/")}>
                    {t("Build and decorate your kingdom →")}
                  </Link>
                ) : (
                  t(
                    "Choose Look around, then drag to turn and pinch or scroll to zoom.",
                  )
                )}
              </p>
            </>
          ) : (
            <p className="muted">
              {t(`${player.name} hasn’t founded a kingdom yet.`)}
            </p>
          )}
        </section>
        {/* The ranks: where they stand, and how far to the next. */}
        <HonorPath stats={player} />
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
        {!mine && (
          <Link className="button" href={href("/#games")}>
            {t("Play games and rise too →")}
          </Link>
        )}
      </div>
    </>
  );
}
