"use client";
// Where players see their coins and badges: the coin count in the header, the
// "Badge earned" popup on the player page, the badges a game offers, and the
// badges section of the account page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { BadgeMedal, Coin } from "./rewards-art";
import {
  currentWallet,
  loadWallet,
  subscribeWallet,
  type BadgeDef,
  type Wallet,
} from "@/lib/rewards";

/** The signed-in player's coins and badges, or null while loading or signed out. */
export function useWallet() {
  const uid = useOptionalSession()?.user?.uid ?? "";
  const [wallet, setWallet] = useState<Wallet | null>(() => currentWallet(uid));
  useEffect(() => {
    setWallet(currentWallet(uid));
    const stop = subscribeWallet(setWallet);
    void loadWallet(uid);
    return stop;
  }, [uid]);
  return wallet;
}

const titleOf = (title: { en: string; zh: string }, locale: string) =>
  locale === "zh-CN" ? title.zh : title.en;

/** Coins next to the avatar in the header (hidden on phones, see mind-arcade.css). */
export function CoinCount() {
  const { t, href, locale } = useLocale();
  const wallet = useWallet();
  if (!wallet) return null;
  const coins = wallet.coins.toLocaleString(locale);
  return (
    <Link
      className="coin-count"
      href={href("/account/#badges")}
      aria-label={t(`${coins} coins`)}
      title={t(`${coins} coins`)}
    >
      <Coin size={20} />
      <span>
        {new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(wallet.coins)}
      </span>
    </Link>
  );
}

export type EarnedToast = {
  key: number;
  badge: BadgeDef;
  coins: number;
  test: boolean;
};

/** The popup the player page shows when a game awards a badge. */
export function BadgeToast({
  toast,
  gameTitle,
  onDone,
}: {
  toast: EarnedToast | null;
  gameTitle: string;
  onDone: () => void;
}) {
  const { t, locale } = useLocale();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [toast?.key]);
  return (
    <div className="badge-toast-slot" role="status" aria-live="polite">
      {toast && (
        <div className="badge-toast" key={toast.key}>
          <BadgeMedal
            tier={toast.badge.tier}
            level={toast.badge.level}
            icon={toast.badge.icon}
            levelText={t("LEVEL")}
            size={56}
          />
          <div className="badge-toast-text">
            <span className="badge-toast-eyebrow">
              {toast.test ? t("Test badge (not saved)") : t("Badge earned")}
            </span>
            <strong>{titleOf(toast.badge.title, locale)}</strong>
            <span className="badge-toast-game">{gameTitle}</span>
          </div>
          {toast.coins > 0 && (
            <span className="badge-toast-coins">
              <Coin size={22} />+{toast.coins}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The badges a game offers, earned ones in color, on its player page. */
export function GameBadges({
  game,
  badges,
}: {
  game: string;
  badges: BadgeDef[];
}) {
  const { t, locale } = useLocale();
  const wallet = useWallet();
  if (!badges.length) return null;
  const earned = new Set(
    wallet?.badges.filter((b) => b.game === game).map((b) => b.id) ?? [],
  );
  return (
    <section className="game-badges" aria-label={t("Badges in this game")}>
      <h2>
        {t("Badges in this game")}
        {wallet && (
          <small> {t(`${earned.size} of ${badges.length} earned`)}</small>
        )}
      </h2>
      <ul>
        {badges.map((badge) => {
          const has = earned.has(badge.id);
          return (
            <li key={badge.id} className={has ? "earned" : "locked"}>
              <BadgeMedal
                tier={badge.tier}
                level={badge.level}
                icon={badge.icon}
                locked={!has}
                levelText={t("LEVEL")}
                size={48}
              />
              <span>{titleOf(badge.title, locale)}</span>
              {badge.coins > 0 && (
                <small>
                  <Coin size={14} /> {badge.coins}
                </small>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The account page's badges: every badge the player has, and their coins. */
export function BadgeShelf() {
  const { t, locale, href } = useLocale();
  const wallet = useWallet();
  return (
    <section className="panel badge-shelf" id="badges">
      <h2>{t("Badges and coins")}</h2>
      {!wallet ? (
        <p className="muted">{t("Loading…")}</p>
      ) : (
        <>
          <p className="badge-shelf-coins">
            <Coin size={40} />
            <span>
              <strong>{wallet.coins.toLocaleString(locale)}</strong>{" "}
              {t("coins")}
            </span>
          </p>
          {!wallet.badges.length ? (
            <p className="muted">
              {t("Pass levels in games to earn badges and coins.")}{" "}
              <Link href={href("/#games")}>{t("Find a game →")}</Link>
            </p>
          ) : (
            <ul className="badge-grid">
              {wallet.badges.map((badge) => (
                <li key={`${badge.game}/${badge.id}`}>
                  <BadgeMedal
                    tier={badge.tier}
                    level={badge.level}
                    icon={badge.icon}
                    levelText={t("LEVEL")}
                    size={64}
                  />
                  <strong>{titleOf(badge.title, locale)}</strong>
                  <Link href={href(`/play/${badge.game}/`)}>{badge.game}</Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
