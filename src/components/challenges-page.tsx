"use client";
// The Challenges page (/challenges/): the challenges players have open,
// grouped by game, each shown as a challenge card (challenge-card.tsx): a
// round anyone can take in one click, with its results.
import Link from "next/link";
import { pick } from "@/lib/i18n";
import type { OpenChallenge } from "@/lib/challenges";
import type { CatalogGame } from "@/lib/catalog";
import { GameCover, playPath, useCatalog } from "./catalog";
import { ChallengeCard, useOpenChallenges } from "./challenge-card";
import { useLocale } from "./locale";

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
                {challenges.map((challenge) => (
                  <li key={challenge.id}>
                    <ChallengeCard challenge={challenge} game={game} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </div>
  );
}
