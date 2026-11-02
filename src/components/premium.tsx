"use client";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { friendlyError } from "@/lib/models";
import {
  formatPrice,
  openBillingPortal,
  readPremiumPrices,
  readPremiumStatus,
  startCheckout,
  type PremiumPrice,
} from "@/lib/premium";

function checkoutResult() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("checkout") || "";
}
// Stripe's webhook sets the premium claim a few seconds after checkout.
export const ACTIVATION_CHECKS_MS = [0, 2000, 4000, 8000, 15000];

export function PremiumPanel() {
  const { user } = useSession();
  const [premium, setPremium] = useState(user?.isPremium === true);
  const [prices, setPrices] = useState<PremiumPrice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result] = useState(checkoutResult);

  useEffect(() => {
    if (premium) return;
    let active = true;
    readPremiumPrices()
      .then((value) => active && setPrices(value))
      .catch(() => active && setPrices([]));
    return () => {
      active = false;
    };
  }, [premium]);

  useEffect(() => {
    if (result !== "success" || premium) return;
    let active = true;
    const timers = ACTIVATION_CHECKS_MS.map((ms) =>
      setTimeout(() => {
        readPremiumStatus()
          .then((value) => active && value && setPremium(true))
          .catch(() => {});
      }, ms),
    );
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [result, premium]);

  async function go(next: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      window.location.assign(await next());
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <section className="panel premium-panel" aria-labelledby="premium-title">
      <h2 id="premium-title">
        Dingn Premium
        {premium && <span className="premium-badge">Active</span>}
      </h2>
      {premium ? (
        <>
          <p>Thanks for supporting Dingn. Premium is active on this account.</p>
          <button
            className="button"
            onClick={() => go(openBillingPortal)}
            disabled={busy}
          >
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
                  onClick={() => go(() => startCheckout(price))}
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
