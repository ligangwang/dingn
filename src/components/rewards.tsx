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
  type ShopDef,
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
  const [landed, setLanded] = useState(wallet?.coins ?? 0);
  const shown = useCountUp(landed);
  const [open, setOpen] = useState(false);
  // Where the panel starts on phones, where it spans the screen: just below
  // the coin, wherever the menu has wrapped it.
  const [top, setTop] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  // Bump the count when a game pays out, not when the wallet first loads.
  // While a reward popup is up, coins fly from it into this count
  // (flyCoins), so the new total waits until they land.
  const [bump, setBump] = useState(0);
  const seen = useRef<number | null>(wallet?.coins ?? null);
  useEffect(() => {
    const now = wallet?.coins ?? null;
    const before = seen.current;
    seen.current = now;
    if (now == null) return;
    if (before == null || now <= before) return setLanded(now);
    const flying = !!document.querySelector(".badge-toast-coins");
    const timer = setTimeout(
      () => {
        setLanded(now);
        setBump((b) => b + 1);
      },
      flying ? COINS_LAND_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [wallet?.coins]);
  // Close the wallet on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!wallet) return null;
  const coins = wallet.coins.toLocaleString(locale);
  return (
    <div className="wallet" ref={box}>
      <button
        type="button"
        key={bump}
        className={bump ? "coin-count bump" : "coin-count"}
        aria-label={t(`Wallet: ${coins} coins`)}
        aria-expanded={open}
        aria-controls="wallet-panel"
        title={t(`${coins} coins`)}
        onClick={(e) => {
          setTop(e.currentTarget.getBoundingClientRect().bottom + 8);
          setOpen((o) => !o);
        }}
      >
        <Coin size={20} />
        <span>
          {new Intl.NumberFormat(locale, {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(shown)}
        </span>
      </button>
      {open && (
        <div
          className="wallet-panel"
          id="wallet-panel"
          style={{ "--wallet-top": `${top}px` } as CSSProperties}
        >
          <WalletSummary wallet={wallet} compact />
          <Link
            className="wallet-more"
            href={href("/account/#badges")}
            onClick={() => setOpen(false)}
          >
            {t("See everything in your account →")}
          </Link>
        </div>
      )}
    </div>
  );
}

/** What is in a player's wallet: coins, badges and the upgrades they own. */
export function WalletSummary({
  wallet,
  compact = false,
}: {
  wallet: Wallet;
  compact?: boolean;
}) {
  const { t, locale } = useLocale();
  const badges = compact ? wallet.badges.slice(0, 8) : wallet.badges;
  return (
    <div className={compact ? "wallet-summary compact" : "wallet-summary"}>
      <p className="wallet-coins">
        <Coin size={compact ? 32 : 40} />
        <span>
          <strong>{wallet.coins.toLocaleString(locale)}</strong> {t("coins")}
        </span>
      </p>
      <h3>
        {t("Badges")} <small>{wallet.badges.length}</small>
      </h3>
      {badges.length ? (
        <ul className="wallet-badges">
          {badges.map((badge) => (
            <li
              key={`${badge.game}/${badge.id}`}
              title={`${titleOf(badge.title, locale)} · ${badge.game}`}
            >
              <BadgeMedal
                tier={badge.tier}
                level={badge.level}
                icon={badge.icon}
                levelText={t("LEVEL")}
                size={compact ? 36 : 48}
                label={titleOf(badge.title, locale)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {t("Pass levels in games to earn badges and coins.")}
        </p>
      )}
      <h3>
        {t("Upgrades")} <small>{wallet.items.length}</small>
      </h3>
      {wallet.items.length ? (
        <ul className="wallet-items">
          {wallet.items.map((item) => (
            <li key={`${item.game}/${item.id}`}>
              <span>{item.title ? titleOf(item.title, locale) : item.id}</span>
              <small>{item.game}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("Spend coins in games on upgrades.")}</p>
      )}
    </div>
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

/** How long after a popup appears its coins land in the header's count. */
export const COINS_LAND_MS = 1300;

/**
 * Coins flying from a popup's coin chip into the coin count in the header,
 * which bumps as they land (CoinCount). Nothing flies when the count isn't
 * on screen (signed out, or the game is full screen).
 */
export function flyCoins(from: Element, coins: number) {
  const target = document.querySelector("nav .coin-count");
  if (
    !target ||
    document.fullscreenElement ||
    document.documentElement.classList.contains("play-window-full") ||
    reducedMotion()
  )
    return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!b.width || !a.width) return;
  const art = from.querySelector("svg");
  const startX = a.left + 18;
  const startY = a.top + a.height / 2;
  const dx = b.left + 14 - startX;
  const dy = b.top + b.height / 2 - startY;
  const count = Math.min(12, Math.max(4, Math.round(coins / 4)));
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("span");
    coin.className = "flying-coin";
    coin.setAttribute("aria-hidden", "true");
    if (art) coin.append(art.cloneNode(true));
    coin.style.left = `${startX - 11}px`;
    coin.style.top = `${startY - 11}px`;
    document.body.append(coin);
    // burst out a little, then sweep up into the count along a curve
    const spreadX = (Math.random() - 0.5) * 90;
    const spreadY = -20 - Math.random() * 50;
    const flight = coin.animate(
      [
        { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
        {
          transform: `translate(${spreadX}px, ${spreadY}px) scale(1.15)`,
          opacity: 1,
          offset: 0.25,
        },
        {
          transform: `translate(${spreadX + dx * 0.55}px, ${dy * 0.75}px) scale(0.95)`,
          opacity: 1,
          offset: 0.7,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.9 },
      ],
      {
        duration: 1000,
        delay: i * 70,
        easing: "cubic-bezier(0.45, 0, 0.3, 1)",
        fill: "both",
      },
    );
    flight.onfinish = flight.oncancel = () => coin.remove();
  }
}

/** "+25" with coins popping out, counting up from zero, then flying home. */
function ToastCoins({ coins }: { coins: number }) {
  const shown = useCountUp(coins, 0, 700);
  const chip = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (chip.current) flyCoins(chip.current, coins);
    }, 250);
    return () => clearTimeout(timer);
    // once per popup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span className="badge-toast-coins" ref={chip}>
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

/** "+3 coins" over the game when it pays coins for play (rewards.earn). */
export function CoinToast({
  toast,
  onDone,
}: {
  toast: { key: number; coins: number; test: boolean } | null;
  onDone: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [toast?.key]);
  return (
    <div className="coin-toast-slot" role="status" aria-live="polite">
      {toast && (
        <div className="coin-toast" key={toast.key}>
          <span className="badge-toast-eyebrow">
            {toast.test ? t("Test coins (not saved)") : t("Coins earned")}
          </span>
          <ToastCoins coins={toast.coins} />
        </div>
      )}
    </div>
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

export type SpendAsk = {
  item: ShopDef;
  balance: number;
  answer: (yes: boolean) => void;
};

/**
 * dingn's own "Spend coins?" question, over the game. A game can only ask:
 * the player's coins are spent only when they press Buy here.
 */
export function SpendConfirm({
  ask,
  gameTitle,
}: {
  ask: SpendAsk;
  gameTitle: string;
}) {
  const { t, locale } = useLocale();
  const buy = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buy.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ask.answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);
  const name = titleOf(ask.item.title, locale);
  const after = ask.balance - ask.item.price;
  return (
    <div className="spend-confirm-backdrop">
      <div
        className="spend-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="spend-confirm-title"
        aria-describedby="spend-confirm-text"
      >
        <Coin size={56} />
        <h2 id="spend-confirm-title">{t(`Buy ${name}?`)}</h2>
        <p id="spend-confirm-text">
          {t(`${gameTitle} upgrade for ${ask.item.price} dingn coins.`)}{" "}
          {after >= 0 &&
            t(`You will have ${after.toLocaleString(locale)} coins left.`)}
        </p>
        <div className="spend-confirm-buttons">
          <button type="button" onClick={() => ask.answer(false)}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="primary"
            ref={buy}
            onClick={() => ask.answer(true)}
          >
            <Coin size={18} /> {t(`Buy for ${ask.item.price}`)}
          </button>
        </div>
      </div>
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

/** The account page's wallet: coins, every badge, and owned upgrades. */
export function BadgeShelf() {
  const { t, href } = useLocale();
  const wallet = useWallet();
  return (
    <section className="panel badge-shelf" id="badges">
      <h2>{t("Your wallet")}</h2>
      {!wallet ? (
        <p className="muted">{t("Loading…")}</p>
      ) : (
        <>
          <WalletSummary wallet={wallet} />
          {!wallet.badges.length && (
            <p>
              <Link href={href("/#games")}>{t("Find a game →")}</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
