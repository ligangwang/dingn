"use client";
// /terms/ and /privacy/: the terms of use (with the coin refund policy) and
// the privacy policy. Change UPDATED when the text changes.
import Link from "next/link";
import { useLocale } from "./locale";

export const UPDATED = "2026-11-14";

type Sections = [string, string[]][];

const TERMS: Sections = [
  [
    "Using dingn",
    [
      "dingn is a website of free games for players of every age. You can play many games without an account; signing in with Google saves your progress, coins and kingdom.",
      "Play fairly. Don't cheat, attack the site, or use it to harm other people.",
      "dingn may change or remove games and features, and may suspend accounts that break these terms.",
    ],
  ],
  [
    "Coins",
    [
      "You earn coins free by playing, and you can also buy coin packs in the coin shop.",
      "Coins can only be spent on items and upgrades in dingn games. They have no cash value, can't be exchanged for money, and can't be transferred to another account.",
      "If you are under 18, ask a parent or guardian before you buy coins.",
    ],
  ],
  [
    "Payments",
    [
      "Prices are shown in the coin shop before you pay. Each purchase is a one-time payment, not a subscription.",
      "Payments are handled by Stripe. dingn never sees or stores your card details.",
      "Coins are added to your account a few seconds after Stripe confirms the payment.",
    ],
  ],
  [
    "Refunds",
    [
      "If you were charged but your coins didn't arrive, or you were charged twice, contact us and we will fix it or refund you in full.",
      "Coins are delivered right away. Before you pay, you ask for immediate delivery and agree that you lose the right to cancel (the 14-day cancellation right in the EU and UK) once they are delivered. Your Stripe receipt confirms this.",
      "So a purchase can't be cancelled just because you changed your mind, but you are always entitled to a fix or a refund if coins are missing or don't work as described.",
      "Refunds go back to the card or account you paid with. When a purchase is refunded or disputed, its coins are removed from your balance.",
      "Where you live, the law may give you more rights. These terms don't take them away.",
    ],
  ],
  [
    "No warranty",
    [
      "dingn is provided as it is, without promises that it is always available or free of errors. As far as the law allows, dingn is not responsible for indirect losses that come from using it.",
    ],
  ],
  [
    "Changes to these terms",
    [
      "dingn may update these terms. The date at the top shows the latest version, and using dingn after a change means you accept it.",
    ],
  ],
];

const PRIVACY: Sections = [
  [
    "What dingn keeps",
    [
      "When you sign in with Google: your account ID, name, email address and profile picture.",
      "What you do in games: progress, scores, XP, coins, items and your kingdom.",
      "Coin purchases: what you bought, when, and the amount. Stripe processes the payment; dingn receives a record of it but never your card number.",
      "Feedback you send us.",
    ],
  ],
  [
    "Analytics",
    [
      "dingn uses Google Analytics to count visits and see which games people play. You can turn it off for your browser at dingn.com/opt-out.",
    ],
  ],
  [
    "How it is used",
    [
      "To run your account, save your games, deliver what you buy, prevent fraud and improve dingn.",
      "dingn does not sell your data and does not show ads.",
    ],
  ],
  [
    "Who else handles it",
    [
      "Google (sign-in, hosting on Google Cloud and Firebase, analytics) and Stripe (payments). They process data for dingn under their own privacy terms.",
    ],
  ],
  [
    "Your choices",
    [
      "You can change your display name and avatar on your account page.",
      "To get a copy of your data or have your account deleted, contact us. Payment records may be kept as long as the law requires.",
    ],
  ],
];

/** Turns the dingn.com/opt-out mention into a link to that page. */
function withLinks(text: string, href: (path: string) => string) {
  const [before, after] = text.split("dingn.com/opt-out");
  if (after === undefined) return text;
  return (
    <>
      {before}
      <Link href={href("/opt-out/")}>dingn.com/opt-out</Link>
      {after}
    </>
  );
}

function LegalPage({
  eyebrow,
  title,
  lead,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Sections;
}) {
  const { t, href } = useLocale();
  return (
    <div className="container dev-page">
      <p className="eyebrow">{t(eyebrow)}</p>
      <h1>{t(title)}</h1>
      <p className="dev-lead">{t(lead)}</p>
      <p className="dev-hint">{t(`Last updated ${UPDATED}`)}</p>
      {sections.map(([heading, points]) => (
        <section key={heading}>
          <h2>{t(heading)}</h2>
          <ul>
            {points.map((point) => (
              <li key={point}>{withLinks(t(point), href)}</li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        {t("Questions, refunds or data requests?")}{" "}
        <Link href={href("/feedback/")}>{t("Contact us")}</Link>
      </p>
    </div>
  );
}

export function Terms() {
  return (
    <LegalPage
      eyebrow="THE RULES"
      title="Terms of use"
      lead="These terms apply when you use dingn.com, including buying coins."
      sections={TERMS}
    />
  );
}

export function Privacy() {
  return (
    <LegalPage
      eyebrow="YOUR PRIVACY"
      title="Privacy policy"
      lead="What dingn keeps about you, why, and what you can do about it."
      sections={PRIVACY}
    />
  );
}

/** Footer links to the terms and privacy policy in the current language. */
export function LegalLinks() {
  const { t, href } = useLocale();
  return (
    <>
      <Link href={href("/terms/")}>{t("Terms")}</Link> ·{" "}
      <Link href={href("/privacy/")}>{t("Privacy")}</Link>
    </>
  );
}
