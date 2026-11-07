"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "./locale";
import {
  buyItem,
  formatPrice,
  readInventory,
  readItems,
  type Item,
  type Purchase,
} from "@/lib/shop";
export function ItemShop() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<Item[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const [nextItems, nextPurchases] = await Promise.all([
        readItems(),
        readInventory(),
      ]);
      setItems(nextItems);
      setPurchases(nextPurchases);
      setError("");
    } catch {
      setError("The item shop could not be loaded. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
    // A return URL is only a prompt to refresh, never proof of purchase.
    if (
      new URLSearchParams(window.location.search).get("purchase") !== "pending"
    )
      return;
    const timers = [2000, 5000, 10000, 20000].map((ms) =>
      setTimeout(() => void load(), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [load]);
  async function buy(item: Item) {
    if (lock.current) return;
    lock.current = true;
    setBusy(item.id);
    setError("");
    try {
      const { url } = await buyItem(item.id, locale);
      window.location.assign(url);
    } catch {
      setError(
        "Checkout could not be opened. Refresh your purchases before trying again.",
      );
      lock.current = false;
      setBusy(null);
    }
  }
  const labels = {
    owned: "Owned",
    pending: "Awaiting payment confirmation",
    revoked: "Refunded or disputed",
    expired: "Checkout expired",
  };
  return (
    <section className="panel shop-panel" aria-labelledby="shop-title">
      <h2 id="shop-title">{t("Game items")}</h2>
      <p>{t("Optional items. One-time purchases, no subscription.")}</p>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {items === null ? (
        !error && <p role="status">{t("Loading items…")}</p>
      ) : items.length === 0 ? (
        <p>
          {t(
            "No items are available yet. We will only sell items that are ready to use.",
          )}
        </p>
      ) : (
        <div className="shop-items">
          {items.map((item) => {
            const owned = purchases.some(
              (p) => p.itemId === item.id && p.status === "owned",
            );
            return (
              <article key={item.id}>
                <h3>{item.name[locale] || item.name.en}</h3>
                <p>{item.description[locale] || item.description.en}</p>
                <button
                  className="button"
                  disabled={owned || !!busy}
                  onClick={() => void buy(item)}
                >
                  {owned
                    ? t("Owned")
                    : busy === item.id
                      ? t("Opening checkout…")
                      : t(`Buy · ${formatPrice(item, locale)}`)}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <h3>{t("Your purchases")}</h3>
      {purchases.length ? (
        <ul>
          {purchases.map((p) => (
            <li key={p.id}>
              {p.name[locale] || p.name.en} · {t(labels[p.status])} ·{" "}
              {formatPrice(p, locale)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("No purchases yet.")}</p>
      )}
      <button className="text-button" onClick={() => void load()}>
        {t("Refresh purchases")}
      </button>
    </section>
  );
}
