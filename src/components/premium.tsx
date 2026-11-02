"use client";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { friendlyError } from "@/lib/models";
import {
  formatPrice,
  openBillingPortal,
  readPremiumPrices,
  startCheckout,
  watchActiveSubscription,
  type PremiumPrice,
} from "@/lib/premium";

function checkoutResult() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("checkout") || "";
}

export function PremiumPanel() {
  const { user, isPremium, refreshClaims } = useSession();
  const [prices, setPrices] = useState<PremiumPrice[] | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result] = useState(checkoutResult);
  const uid = user?.uid;

  useEffect(() => {
    let active = true;
    readPremiumPrices()
      .then((value) => active && setPrices(value))
      .catch(() => active && setPrices([]));
    return () => {
      active = false;
    };
  }, []);

  // Stripe's webhook records the subscription moments after checkout; once it
  // appears, refresh the sign-in token so the premium claim takes effect.
  useEffect(() => {
    if (!uid) return;
    return watchActiveSubscription(uid, setSubscribed);
  }, [uid]);
  const needsClaim = subscribed && !isPremium;
  useEffect(() => {
    if (!needsClaim) return;
    const refresh = () => refreshClaims().catch(() => {});
    refresh();
    const timers = [3000, 10000].map((ms) => setTimeout(refresh, ms));
    return () => timers.forEach(clearTimeout);
    // refreshClaims is recreated each render; only react to the state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsClaim]);

  async function upgrade(price: PremiumPrice) {
    if (!uid) return;
    setBusy(true);
    setError("");
    try {
      window.location.assign(await startCheckout(uid, price));
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }
  async function manage() {
    setBusy(true);
    setError("");
    try {
      window.location.assign(await openBillingPortal());
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const premium = isPremium || subscribed;
  return (
    <section className="panel premium-panel" aria-labelledby="premium-title">
      <h2 id="premium-title">
        Dingn Premium
        {premium && <span className="premium-badge">Active</span>}
      </h2>
      {premium ? (
        <>
          <p>Thanks for supporting Dingn. Premium is active on this account.</p>
          <button className="button" onClick={manage} disabled={busy}>
            {busy ? "Opening…" : "Manage subscription"}
          </button>
        </>
      ) : (
        <>
          <p>
            Support Dingn and unlock extra games and detailed stats as they
            launch.
          </p>
          {result === "success" && (
            <p role="status">Payment received. Activating Premium…</p>
          )}
          {result === "cancelled" && (
            <p role="status">Checkout was cancelled. You weren’t charged.</p>
          )}
          {prices === null ? (
            <p role="status">Loading plans…</p>
          ) : prices.length === 0 ? (
            <p>Premium isn’t available yet. Check back soon.</p>
          ) : (
            <div className="premium-prices">
              {prices.map((price) => (
                <button
                  key={price.id}
                  className="button"
                  onClick={() => upgrade(price)}
                  disabled={busy}
                >
                  {busy ? "Please wait…" : `Upgrade · ${formatPrice(price)}`}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
