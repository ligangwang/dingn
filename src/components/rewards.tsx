"use client";
// Where players see their coins and badges: the coin count in the header, the
// "Badge earned" popup on the player page, the badges a game offers, and the
// badges section of the account page.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { BadgeMedal, Coin } from "./rewards-art";
import {
  currentWallet,
  loadWallet,
  subscribeWallet,
  type BadgeDef,
  type EarnedToast,
  type Wallet,
} from "@/lib/rewards";

export type { EarnedToast };

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

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from the last value shown up to `value`, for coins being paid. */
function useCountUp(value: number, from = value, ms = 900) {
  const [shown, setShown] = useState(from);
  const last = useRef(from);
  useEffect(() => {
    const start = last.current;
    last.current = value;
    if (start === value || reducedMotion()) return setShown(value);
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / ms);
      setShown(Math.round(start + (value - start) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);
  return shown;
}

/** Coins next to the avatar in the header (hidden on phones, see mind-arcade.css). */
export function CoinCount() {
  const { t, href, locale } = useLocale();
  const wallet = useWallet();
  const shown = useCountUp(wallet?.coins ?? 0);
  // Bump the count when a game pays out, not when the wallet first loads.
  const [bump, setBump] = useState(0);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const now = wallet?.coins ?? null;
    if (prev.current != null && now != null && now > prev.current)
      setBump((b) => b + 1);
    prev.current = now;
  }, [wallet?.coins]);
  if (!wallet) return null;
  const coins = wallet.coins.toLocaleString(locale);
  return (
    <Link
      key={bump}
      className={bump ? "coin-count bump" : "coin-count"}
      href={href("/account/#badges")}
      aria-label={t(`${coins} coins`)}
      title={t(`${coins} coins`)}
    >
      <Coin size={20} />
      <span>
        {new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(shown)}
      </span>
    </Link>
  );
}

// Sparkles that burst out of the medal: an angle and a distance each.
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  const reach = 34 + (i % 3) * 8;
  return {
    "--x": `${Math.round(Math.cos(angle) * reach)}px`,
    "--y": `${Math.round(Math.sin(angle) * reach)}px`,
    "--d": `${120 + (i % 4) * 40}ms`,
  } as CSSProperties;
});
// Coins that jump out of the coin chip and fall away.
const FLYING = Array.from({ length: 7 }, (_, i) => ({
  "--x": `${(i - 3) * 14}px`,
  "--y": `${-46 - (i % 3) * 14}px`,
  "--d": `${200 + i * 70}ms`,
})) as CSSProperties[];

/** "+25" with coins popping out, counting up from zero. */
function ToastCoins({ coins }: { coins: number }) {
  const shown = useCountUp(coins, 0, 700);
  return (
    <span className="badge-toast-coins">
      {FLYING.map((style, i) => (
        <span
          key={i}
          className="badge-toast-coin-fly"
          style={style}
          aria-hidden
        >
          <Coin size={14} />
        </span>
      ))}
      <Coin size={22} />+{shown}
    </span>
  );
}

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
        <div className={`badge-toast tier-${toast.badge.tier}`} key={toast.key}>
          <span className="badge-toast-medal">
            <span className="badge-toast-rays" aria-hidden />
            {SPARKS.map((style, i) => (
              <span
                key={i}
                className="badge-toast-spark"
                style={style}
                aria-hidden
              />
            ))}
            <BadgeMedal
              tier={toast.badge.tier}
              level={toast.badge.level}
              icon={toast.badge.icon}
              levelText={t("LEVEL")}
              size={56}
            />
          </span>
          <div className="badge-toast-text">
            <span className="badge-toast-eyebrow">
              {toast.test
                ? t("Test badge (not saved)")
                : toast.count > 1
                  ? t(`${toast.count} badges earned`)
                  : t("Badge earned")}
            </span>
            <strong>
              {toast.count > 1
                ? t(
                    `${titleOf(toast.badge.title, locale)} and ${toast.count - 1} more`,
                  )
                : titleOf(toast.badge.title, locale)}
            </strong>
            <span className="badge-toast-game">{gameTitle}</span>
          </div>
          {toast.coins > 0 && <ToastCoins coins={toast.coins} />}
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
