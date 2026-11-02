import { api } from "./api";

// Billing goes through the Dingn server (scripts/billing.mjs), which talks to
// Firebase's "Run Payments with Stripe" extension with the player's own token.
export type PremiumPrice = {
  id: string;
  currency: string;
  unitAmount: number;
  interval: string | null;
};

export function formatPrice(price: PremiumPrice) {
  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  });
  // Stripe amounts are in the currency's minor unit (cents, but whole yen).
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const amount = format.format(price.unitAmount / 10 ** digits);
  return price.interval ? `${amount} / ${price.interval}` : amount;
}

export function readPremiumPrices() {
  return api<PremiumPrice[]>("/api/billing/prices");
}

export async function readPremiumStatus() {
  return (await api<{ isPremium: boolean }>("/api/billing/status")).isPremium;
}

// Resolves with the Stripe-hosted Checkout URL.
export async function startCheckout(price: PremiumPrice) {
  return (
    await api<{ url: string }>("/api/billing/checkout", { price: price.id })
  ).url;
}

// Resolves with a Stripe customer portal URL to update a card or cancel.
export async function openBillingPortal() {
  return (await api<{ url: string }>("/api/billing/portal")).url;
}
