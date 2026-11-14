import { api } from "./api";
export type Item = {
  id: string;
  game: string;
  name: Record<string, string>;
  description: Record<string, string>;
  unitAmount: number;
  currency: string;
};
export type Purchase = {
  id: string;
  /** "coins" for a coin pack; game items have no kind. */
  kind?: "coins";
  itemId: string;
  game: string;
  name: Record<string, string>;
  status: "pending" | "owned" | "paid" | "revoked" | "expired";
  createdAt: number;
  unitAmount: number;
  currency: string;
};
export function formatPrice(
  price: Pick<Item, "unitAmount" | "currency">,
  locale = "en",
) {
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
  });
  return format.format(
    price.unitAmount /
      10 ** (format.resolvedOptions().maximumFractionDigits ?? 2),
  );
}
export const readItems = () => api<Item[]>("/api/billing/items");
export const readInventory = () => api<Purchase[]>("/api/billing/inventory");
export const buyItem = (itemId: string, locale: string) =>
  api<{ url: string }>("/api/billing/checkout", { itemId, locale });
export type CoinPack = {
  id: string;
  coins: number;
  unitAmount: number;
  currency: string;
  name: Record<string, string>;
  tag?: Record<string, string>;
};
export const readCoinPacks = () =>
  api<{ packs: CoinPack[]; testMode: boolean }>("/api/billing/coin-packs");
/** The version of the right-to-cancel waiver; WAIVER_VERSION in billing.mjs. */
export const WAIVER_VERSION = "2026-11-14";
export const buyCoins = (packId: string, locale: string) =>
  api<{ url: string }>("/api/billing/buy-coins", {
    packId,
    locale,
    waiver: WAIVER_VERSION,
  });
