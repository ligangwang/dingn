"use client";
// A challenge as dingn shows it everywhere: who made it and the score to
// beat, its results ranked highest first (each player's name opens their
// page), and the way in. One implementation for the Challenges page
// (challenges-page.tsx), the home page's latest challenge (home.tsx) and the
// results beside a game opened on a challenge (game-host.tsx).
import Link from "next/link";
import { useEffect, useState } from "react";
import { pick } from "@/lib/i18n";
import {
  challengeText,
  challengeUrl,
  scoreText,
  type Challenge,
} from "@/data/challenge.mjs";
import {
  fetchOpenChallenges,
  type OpenChallenge,
  type ThreadResult,
} from "@/lib/challenges";
import type { CatalogGame } from "@/lib/catalog";
import { playPath } from "./catalog";
import { useLocale } from "./locale";

/** The address that opens a game on a challenge. */
export const challengePath = (game: string, id: string) =>
  `${playPath(game)}?c=${encodeURIComponent(id)}`;

/** The open challenges of games in the catalog, newest first; null while loading. */
export function useOpenChallenges(games: CatalogGame[] | null) {
  const [list, setList] = useState<OpenChallenge[] | null>(null);
  useEffect(() => {
    let active = true;
    fetchOpenChallenges()
      .then((found) => active && setList(found))
      .catch(() => active && setList([]));
    return () => {
      active = false;
    };
  }, []);
  if (!list || !games) return null;
  return list.flatMap((challenge) => {
    const game = games.find((g) => g.id === challenge.game);
    return game ? [{ challenge, game }] : [];
  });
}

/**
 * A challenge's results, highest first: rank, the player (their name opens
 * their page when dingn knows their public number) and their score in the
 * challenge's unit.
 */
export function ChallengeResults({
  challenge,
  results,
}: {
  challenge: Pick<Challenge, "mode" | "unit">;
  results: ThreadResult[];
}) {
  const { t, locale, href } = useLocale();
  if (!results.length) return null;
  return (
    <ol className="challenge-rows">
      {results.map((r, i) => (
        <li key={i} className={r.mine ? "mine" : undefined}>
          <span className="rank">{i + 1}</span>
          <span className="name">
            {r.number ? (
              <Link href={href(`/player/${r.number}/`)}>
                {r.name ?? t("A player")}
              </Link>
            ) : (
              (r.name ?? t("A player"))
            )}
            {r.mine && <em> · {t("you")}</em>}
          </span>
          <span className="pts">
            {scoreText({ ...challenge, score: r.score }, locale, t)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Two ways to pass a challenge on to anyone: copy its link, or open the
 * device's share sheet (only where the browser has one).
 */
export function ShareChallenge({ game, id }: { game: string; id: string }) {
  const { t, locale } = useLocale();
  const [copied, setCopied] = useState(false);
  // Known only in the browser, so the server's page and the first paint agree.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const url = () => challengeUrl(location.origin, game, id, locale);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The browser refused the clipboard: nothing was copied.
    }
  }
  return (
    <>
      <button
        type="button"
        className="quiet-link challenge-share"
        onClick={() => void copy()}
      >
        {copied ? t("Link copied") : t("Copy link")}
      </button>
      {canShare && (
        <button
          type="button"
          className="quiet-link challenge-share"
          // Closing the share sheet rejects; there is nothing to do then.
          onClick={() => void navigator.share({ url: url() }).catch(() => {})}
        >
          {t("Share")}
        </button>
      )}
    </>
  );
}

/**
 * An open challenge: its title, which opens the game on it, how many players
 * took it, its results and the ways to pass it on. `hero` is the home page's
 * large one, whose title is the page's heading.
 */
export function ChallengeCard({
  challenge,
  game,
  hero = false,
}: {
  challenge: OpenChallenge;
  game: CatalogGame;
  hero?: boolean;
}) {
  const { t, locale, href } = useLocale();
  const to = href(challengePath(game.id, challenge.id));
  const title = challengeText(
    challenge,
    pick(game.title, locale),
    locale,
    challenge.name,
    t,
  ).title;
  // A website from before lists carried results sends only the top one.
  const results = challenge.results ?? (challenge.top ? [challenge.top] : []);
  return (
    <article className={hero ? "challenge-card hero" : "challenge-card"}>
      <div className="challenge-card-head">
        {/* The title is the way in: it opens the game on this challenge. */}
        {hero ? (
          <h1>
            <Link className="challenge-title" href={to}>
              {title}
            </Link>
          </h1>
        ) : (
          <Link className="challenge-title" href={to}>
            {title}
          </Link>
        )}
        <span className="challenge-actions">
          <ShareChallenge game={game.id} id={challenge.id} />
        </span>
      </div>
      <p className="muted challenge-players">
        {t("Players: {0}").replace("{0}", String(challenge.players))}
      </p>
      <ChallengeResults challenge={challenge} results={results} />
    </article>
  );
}
