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
  itemId: string;
  game: string;
  name: Record<string, string>;
  status: "pending" | "owned" | "revoked" | "expired";
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
