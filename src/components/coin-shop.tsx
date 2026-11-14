"use client";
// The coin shop at /coins/: players buy coin packs through Stripe Checkout.
// Coins land in the same wallet games pay into, once Stripe's signed webhook
// confirms payment (scripts/billing.mjs); the return URL only prompts a refresh.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { AuthGate } from "./auth";
import { useSession } from "./session";
import { useWallet } from "./rewards";
import { Coin } from "./rewards-art";
import { loadWallet } from "@/lib/rewards";
import {
  buyCoins,
  formatPrice,
  readCoinPacks,
  type CoinPack,
} from "@/lib/shop";

function Shop() {
  const { t, locale, href } = useLocale();
  const uid = useSession().user?.uid ?? "";
  const wallet = useWallet();
  const [packs, setPacks] = useState<CoinPack[] | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    readCoinPacks()
      .then((value) => {
        setPacks(value.packs);
        setTestMode(value.testMode);
      })
      .catch(() => {
        setPacks([]);
        setError("The coin shop could not be loaded. Please try again.");
      });
    const purchase = new URLSearchParams(window.location.search).get(
      "purchase",
    );
    setResult(purchase ?? "");
    if (purchase !== "pending") return;
    // Stripe's webhook adds the coins a few seconds after payment.
    const timers = [1500, 4000, 8000, 15000, 30000].map((ms) =>
      setTimeout(() => void loadWallet(uid, true), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [uid]);
  async function buy(pack: CoinPack) {
    if (lock.current) return;
    lock.current = true;
    setBusy(pack.id);
    setError("");
    try {
      window.location.assign((await buyCoins(pack.id, locale)).url);
    } catch {
      setError("Checkout could not be opened. Please try again.");
      lock.current = false;
      setBusy("");
    }
  }
  const best = packs?.length
    ? Math.min(...packs.map((p) => p.unitAmount / p.coins))
    : 0;
  return (
    <div className="narrow container coin-shop">
      <p className="eyebrow">{t("Coin shop")}</p>
      <h1>{t("Get more coins")}</h1>
      <p className="lede">
        {t(
          "Spend coins on upgrades in dingn games. You still earn coins free every day by playing.",
        )}
      </p>
      {wallet && (
        <p className="wallet-coins coin-balance">
          <Coin size={32} />
          <span>
            {t("You have")}{" "}
            <strong>{wallet.coins.toLocaleString(locale)}</strong> {t("coins")}
          </span>
        </p>
      )}
      {testMode && (
        <p className="coin-test-banner" role="note">
          {t(
            "Test mode: no real money is charged. Pay with card 4242 4242 4242 4242, any future date and any CVC.",
          )}
        </p>
      )}
      {result === "pending" && (
        <p role="status" className="coin-result">
          {t("Thanks! Your coins will appear in a few seconds.")}
        </p>
      )}
      {result === "cancelled" && (
        <p role="status" className="coin-result">
          {t("Checkout was cancelled. You weren’t charged.")}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {packs === null ? (
        <p role="status">{t("Loading coin packs…")}</p>
      ) : packs.length === 0 ? (
        !error && <p>{t("The coin shop isn’t open yet. Check back soon.")}</p>
      ) : (
        <div className="coin-packs">
          {packs.map((pack) => {
            const bonus = Math.round(
              (packs[0].unitAmount /
                packs[0].coins /
                (pack.unitAmount / pack.coins) -
                1) *
                100,
            );
            return (
              <article
                key={pack.id}
                className={
                  pack.unitAmount / pack.coins === best
                    ? "coin-pack best"
                    : "coin-pack"
                }
              >
                {pack.tag && (
                  <span className="coin-tag">
                    {pack.tag[locale] || pack.tag.en}
                  </span>
                )}
                <Coin size={44} />
                <h2>{pack.coins.toLocaleString(locale)}</h2>
                <p>{pack.name[locale] || pack.name.en}</p>
                {bonus > 0 && (
                  <p className="coin-bonus">{t(`+${bonus}% more coins`)}</p>
                )}
                <button
                  className="button"
                  disabled={!!busy}
                  onClick={() => void buy(pack)}
                >
                  {busy === pack.id
                    ? t("Opening checkout…")
                    : formatPrice(pack, locale)}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <p className="coin-fine-print">
        {t(
          "One-time purchases, no subscription. Coins have no cash value and can’t be transferred. Payments are handled securely by Stripe.",
        )}
      </p>
      <Link className="text-button" href={href("/#games")}>
        {t("Play games →")}
      </Link>
    </div>
  );
}
export function CoinShop() {
  return (
    <AuthGate returnTo="/coins/">
      <Shop />
    </AuthGate>
  );
}
