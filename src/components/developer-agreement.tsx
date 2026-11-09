"use client";
// /developers/agreement/: the terms a developer accepts on /developers/games/
// before uploading. Its version is AGREEMENT_VERSION in
// scripts/developer-games.mjs: change both together.
import Link from "next/link";
import { useLocale } from "./locale";

export const AGREEMENT_VERSION = "2026-11-09";

const SECTIONS: [string, string[]][] = [
  [
    "Your game",
    [
      "You keep every right to your game.",
      "You confirm that you made everything in it, or have the right to use it on dingn: code, art, sound, music and fonts, and that you follow their licenses and credit their authors.",
    ],
  ],
  [
    "What you allow dingn to do",
    [
      "While your game is on dingn, dingn may store it, serve it and let anyone play it, free of charge, anywhere in the world.",
      "dingn may show your game's name, description and pictures of it to tell people about it.",
      "You can ask dingn to remove your game at any time.",
    ],
  ],
  [
    "What games must not do",
    [
      "Harm players' devices or data, or try to escape dingn's sandbox.",
      "Ask players for passwords, payment details or other personal information.",
      "Track players or sell or share data about them.",
      "Show illegal, hateful, sexual or violent content, or content that targets real people.",
      "Include gambling with real money, scams, or links to them.",
      "Copy another game's name, characters, art or music without permission.",
    ],
  ],
  [
    "Players of every age",
    [
      "dingn is for players of every age. Keep your game suitable for children, and do not show ads in it.",
    ],
  ],
  [
    "Review and removal",
    [
      "dingn reviews every version before it goes live, and may decline it. When it does, it tells you why by email.",
      "dingn may hide or take down any game at any time, for example after a player's report, and may end your developer access if you break this agreement.",
    ],
  ],
  [
    "No payment and no warranty",
    [
      "dingn does not pay for games and does not charge for publishing them.",
      "dingn runs the platform as it is, without promises that it is always available, and is not responsible for losses that come from using it.",
    ],
  ],
  [
    "Changes",
    [
      "dingn may update this agreement. It will email you about changes, and you may need to accept the new version before your next upload.",
    ],
  ],
];

export function DeveloperAgreement() {
  const { t, href } = useLocale();
  return (
    <div className="container dev-page">
      <p className="eyebrow">{t("FOR GAME DEVELOPERS")}</p>
      <h1>{t("Developer agreement")}</h1>
      <p className="dev-lead">
        {t(
          "These terms apply when you upload a game to dingn. Read them before you sign up on My games.",
        )}
      </p>
      <p className="dev-hint">{t(`Agreement version ${AGREEMENT_VERSION}`)}</p>
      {SECTIONS.map(([heading, points]) => (
        <section key={heading}>
          <h2>{t(heading)}</h2>
          <ul>
            {points.map((point) => (
              <li key={point}>{t(point)}</li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        {t("Questions about these terms?")}{" "}
        <Link href={href("/feedback/")}>{t("Ask us")}</Link>
      </p>
      <p className="dev-actions">
        <Link className="button" href={href("/developers/games/")}>
          {t("My games")}
        </Link>
      </p>
    </div>
  );
}
