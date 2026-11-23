"use client";
// The Challenges page (/challenges/): the challenges players have open,
// grouped by game, each a round anyone can take in one click. A challenge's own page is the game, opened on it
// (/play/<game>/?c=<id>), where its results are (game-host.tsx).
import Link from "next/link";
import { useEffect, useState } from "react";
import { pick } from "@/lib/i18n";
import { challengeText, scoreText } from "@/data/challenge.mjs";
import { fetchOpenChallenges, type OpenChallenge } from "@/lib/challenges";
import type { CatalogGame } from "@/lib/catalog";
import { GameCover, playPath, useCatalog } from "./catalog";
import { useLocale } from "./locale";

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

/** The address that opens a game on a challenge. */
export const challengePath = (game: string, id: string) =>
  `${playPath(game)}?c=${encodeURIComponent(id)}`;

export function ChallengesPage() {
  const { t, locale, href } = useLocale();
  const open = useOpenChallenges(useCatalog());
  // Grouped by game: the game with the newest challenge first, and each
  // game's challenges newest first (the order they arrive in).
  const groups: { game: CatalogGame; challenges: OpenChallenge[] }[] = [];
  for (const { challenge, game } of open ?? []) {
    const group = groups.find((g) => g.game.id === game.id);
    if (group) group.challenges.push(challenge);
    else groups.push({ game, challenges: [challenge] });
  }
  return (
    <div className="container challenges-page">
      <section className="panel">
        <p className="eyebrow">{t("Challenges")}</p>
        <h1>{t("Open challenges")}</h1>
        <p className="muted">
          {t(
            "Pick one and play the same round. Sign in and your score is posted under it.",
          )}
        </p>
        {open && !open.length && (
          <p className="muted">
            {t("No open challenges yet. Finish a round and challenge anyone.")}
          </p>
        )}
        {groups.map(({ game, challenges }) => {
          const title = pick(game.title, locale);
          return (
            <section
              key={game.id}
              className="challenge-game"
              aria-label={title}
            >
              <h2>
                <Link href={href(playPath(game.id))}>
                  <GameCover game={game} title={title} size={40} />
                  {title}
                </Link>
              </h2>
              <ul className="challenge-list">
                {challenges.map((challenge) => {
                  const top = challenge.top;
                  return (
                    <li key={challenge.id}>
                      <Link
                        className="challenge-card"
                        href={href(challengePath(game.id, challenge.id))}
                      >
                        <span className="challenge-copy">
                          <strong>
                            {
                              challengeText(
                                challenge,
                                title,
                                locale,
                                challenge.name,
                                t,
                              ).title
                            }
                          </strong>
                          <span className="muted">
                            {t("Players: {0}").replace(
                              "{0}",
                              String(challenge.players),
                            )}
                            {top &&
                              top.score > challenge.score &&
                              ` · ${t("Top score: {0} by {1}")
                                .replace(
                                  "{0}",
                                  scoreText(
                                    { ...challenge, score: top.score },
                                    locale,
                                    t,
                                  ),
                                )
                                .replace("{1}", top.name ?? t("A player"))}`}
                          </span>
                        </span>
                        <span className="button small">
                          {t("Take the challenge")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </section>
    </div>
  );
}
