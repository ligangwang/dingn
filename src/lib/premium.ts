import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "./firebase";

// Stripe billing runs through Firebase's "Run Payments with Stripe" extension
// (invertase/firestore-stripe-payments). It syncs Stripe products into
// `products`, creates Checkout sessions from `customers/{uid}/checkout_sessions`,
// and sets the `stripeRole` custom claim from the product's `firebaseRole`
// metadata. No Stripe keys live in this repository.
export const PREMIUM_ROLE = "premium";
const EXTENSION_REGION = "us-central1";

export type PremiumPrice = {
  id: string;
  currency: string;
  unitAmount: number;
  interval: string | null;
  recurring: boolean;
};

export function isPremiumClaim(claims: Record<string, unknown>) {
  return claims.stripeRole === PREMIUM_ROLE;
}

export function formatPrice(price: PremiumPrice) {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unitAmount / 100);
  return price.interval ? `${amount} / ${price.interval}` : amount;
}

// Reads the active prices of the active product marked firebaseRole=premium.
export async function readPremiumPrices(): Promise<PremiumPrice[]> {
  const { db } = firebase();
  const products = await getDocs(
    query(
      collection(db, "products"),
      where("active", "==", true),
      where("role", "==", PREMIUM_ROLE),
    ),
  );
  const prices: PremiumPrice[] = [];
  for (const product of products.docs) {
    const result = await getDocs(
      query(collection(product.ref, "prices"), where("active", "==", true)),
    );
    for (const item of result.docs) {
      const data = item.data();
      if (typeof data.unit_amount !== "number" || !data.currency) continue;
      prices.push({
        id: item.id,
        currency: String(data.currency),
        unitAmount: data.unit_amount,
        interval: typeof data.interval === "string" ? data.interval : null,
        recurring: data.type === "recurring",
      });
    }
  }
  // Monthly before yearly; cheapest first otherwise.
  const order = (p: PremiumPrice) =>
    p.interval === "month" ? 0 : p.interval === "year" ? 1 : 2;
  return prices.sort(
    (a, b) => order(a) - order(b) || a.unitAmount - b.unitAmount,
  );
}

// Creates a Checkout session and resolves with the Stripe-hosted URL.
export async function startCheckout(
  uid: string,
  price: PremiumPrice,
  origin = window.location.origin,
  timeoutMs = 30000,
): Promise<string> {
  if (!uid) throw new Error("Sign in required");
  const ref = await addDoc(
    collection(firebase().db, "customers", uid, "checkout_sessions"),
    {
      price: price.id,
      mode: price.recurring ? "subscription" : "payment",
      allow_promotion_codes: true,
      success_url: `${origin}/account/?checkout=success`,
      cancel_url: `${origin}/account/?checkout=cancelled`,
    },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new Error("Checkout is taking too long. Please try again."));
    }, timeoutMs);
    const stop = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (data?.error) {
          clearTimeout(timer);
          stop();
          reject(new Error(String(data.error.message || "Checkout failed")));
        } else if (typeof data?.url === "string") {
          clearTimeout(timer);
          stop();
          resolve(data.url);
        }
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Watches for an active or trialing subscription for the signed-in player.
export function watchActiveSubscription(
  uid: string,
  onChange: (active: boolean) => void,
) {
  return onSnapshot(
    query(
      collection(firebase().db, "customers", uid, "subscriptions"),
      where("status", "in", ["trialing", "active"]),
    ),
    (snap) => onChange(!snap.empty),
    () => onChange(false),
  );
}

// Opens Stripe's customer portal to update a card or cancel.
export async function openBillingPortal(origin = window.location.origin) {
  const { auth } = firebase();
  const createPortalLink = httpsCallable<
    { returnUrl: string },
    { url: string }
  >(
    getFunctions(auth.app, EXTENSION_REGION),
    "ext-firestore-stripe-payments-createPortalLink",
  );
  const { data } = await createPortalLink({ returnUrl: `${origin}/account/` });
  return data.url;
}
