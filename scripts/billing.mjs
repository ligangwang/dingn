import { randomUUID } from "node:crypto";
import { isLocale, localePath } from "./i18n.mjs";
import { readFile } from "node:fs/promises";
import Stripe from "stripe";
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
let services;
async function productionServices() {
  services ??= (async () => {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { getAuth } = await import("firebase-admin/auth");
    const app =
      getApps().find((a) => a.name === "dingn-billing") ||
      initializeApp({ projectId: "dingn-193716" }, "dingn-billing");
    return {
      db: getFirestore(app),
      auth: getAuth(app),
      stripe: process.env.STRIPE_SECRET_KEY
        ? new Stripe(process.env.STRIPE_SECRET_KEY, {
            maxNetworkRetries: 2,
            timeout: 15000,
          })
        : null,
      items: JSON.parse(
        await readFile(
          new URL("../src/data/shop-items.json", import.meta.url),
          "utf8",
        ),
      ),
      packs: JSON.parse(
        await readFile(
          new URL("../src/data/coin-packs.json", import.meta.url),
          "utf8",
        ),
      ),
    };
  })();
  return services;
}
// Only release-ready, non-consumable items explicitly enabled in source can sell.
/**
 * Stripe Checkout's language for a dingn language: Stripe says "zh" for
 * Simplified Chinese and knows the rest by the same codes; anything else
 * gets English. Prices stay in US dollars in every language.
 */
export const stripeLocale = (locale) =>
  locale === "zh-CN"
    ? "zh"
    : ["es", "pt-BR", "id", "ja", "ko"].includes(locale)
      ? locale
      : "en";
export function releasedItems(items) {
  return items.filter(
    (i) =>
      i.active === true &&
      /^[a-z0-9-]{1,80}$/.test(i.id) &&
      /^[a-z0-9-]{1,80}$/.test(i.game) &&
      /^price_[A-Za-z0-9]+$/.test(i.priceId) &&
      i.name?.en &&
      i.name?.["zh-CN"] &&
      i.description?.en &&
      i.description?.["zh-CN"],
  );
}
const refFor = (db, uid, id) => db.doc(`shopInventory/${uid}/items/${id}`);
export async function catalog({ stripe, items }) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return [];
  return (
    await Promise.all(
      releasedItems(items).map(async (item) => {
        const price = await stripe.prices.retrieve(item.priceId);
        if (
          !price.active ||
          price.type !== "one_time" ||
          !Number.isSafeInteger(price.unit_amount) ||
          price.unit_amount <= 0
        )
          return null;
        return {
          ...item,
          unitAmount: price.unit_amount,
          currency: price.currency,
        };
      }),
    )
  ).filter(Boolean);
}
export async function checkout(deps, uid, itemId, locale) {
  const { db, stripe } = deps;
  const item = (await catalog(deps)).find((i) => i.id === itemId);
  if (!item) throw new ApiError(400, "item-unavailable");
  const inventory = refFor(db, uid, item.id),
    proposedId = randomUUID(),
    now = Date.now();
  // Concurrent clicks and retries share an order and Stripe idempotency key.
  const order = await db.runTransaction(async (tx) => {
    const owned = (await tx.get(inventory)).data();
    if (owned?.status === "owned") throw new ApiError(409, "already-owned");
    if (owned?.orderId) {
      const prior = (
        await tx.get(db.doc(`shopOrders/${owned.orderId}`))
      ).data();
      if (prior?.status === "pending") return prior;
    }
    const record = {
      id: proposedId,
      uid,
      itemId: item.id,
      game: item.game,
      name: item.name,
      priceId: item.priceId,
      unitAmount: item.unitAmount,
      currency: item.currency,
      status: "pending",
      createdAt: now,
      expiresAt: now + 35 * 60 * 1000,
      locale: isLocale(locale) ? locale : "en",
    };
    tx.set(db.doc(`shopOrders/${proposedId}`), record);
    tx.set(inventory, { status: "pending", orderId: proposedId });
    return record;
  });
  const metadata = { orderId: order.id, uid, itemId: order.itemId };
  const accountPath = localePath("/account/", order.locale);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: order.priceId, quantity: 1 }],
      client_reference_id: uid,
      metadata,
      payment_intent_data: { metadata },
      expires_at: Math.floor(order.expiresAt / 1000),
      locale: stripeLocale(order.locale),
      success_url: `https://dingn.com${accountPath}?purchase=pending`,
      cancel_url: `https://dingn.com${accountPath}?purchase=cancelled`,
    },
    { idempotencyKey: `dingn-item-${order.id}` },
  );
  if (!session.url?.startsWith("https://checkout.stripe.com/"))
    throw new ApiError(502, "checkout-failed");
  return { url: session.url };
}
// Coin packs: consumable purchases that add coins to `rewards/{uid}`, the
// same balance games pay into and players spend in game shops. Prices live in
// src/data/coin-packs.json and go to Stripe as inline price_data, so no
// Stripe product setup is needed. Orders are `coinOrders/{id}` (server-only).
export function validPacks(packs = []) {
  return packs.filter(
    (p) =>
      /^[a-z0-9-]{1,40}$/.test(p.id) &&
      Number.isSafeInteger(p.coins) &&
      p.coins > 0 &&
      p.coins <= 100000 &&
      Number.isSafeInteger(p.unitAmount) &&
      p.unitAmount >= 50 &&
      /^[a-z]{3}$/.test(p.currency) &&
      p.name?.en &&
      p.name?.["zh-CN"],
  );
}
const testMode = () =>
  (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
export function coinPacks({ stripe, packs }) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET)
    return { packs: [], testMode: false };
  return { packs: validPacks(packs), testMode: testMode() };
}
/**
 * Coins are digital content delivered at once. Under EU and UK consumer law a
 * buyer keeps a 14-day right to cancel unless, before paying, they ask for
 * immediate delivery and acknowledge losing that right. The coin shop collects
 * that consent; the order records it and Stripe repeats it on the checkout
 * page and the receipt. Change the version when the wording changes.
 */
export const WAIVER_VERSION = "2026-11-14";
const WAIVER_TEXT =
  "Your coins are delivered immediately. You asked for immediate delivery and agreed that you lose your right to cancel once they are delivered.";
export async function buyCoins(deps, uid, packId, locale, waiver) {
  const { db, stripe } = deps;
  const pack = coinPacks(deps).packs.find((p) => p.id === packId);
  if (!pack) throw new ApiError(400, "pack-unavailable");
  if (waiver !== WAIVER_VERSION) throw new ApiError(400, "waiver-required");
  const now = Date.now();
  const order = {
    id: randomUUID(),
    uid,
    packId: pack.id,
    coins: pack.coins,
    unitAmount: pack.unitAmount,
    currency: pack.currency,
    status: "pending",
    createdAt: now,
    expiresAt: now + 35 * 60 * 1000,
    locale: isLocale(locale) ? locale : "en",
    waiver: { version: WAIVER_VERSION, acceptedAt: now },
  };
  await db.runTransaction(async (tx) =>
    tx.set(db.doc(`coinOrders/${order.id}`), order),
  );
  const metadata = { kind: "coins", orderId: order.id, uid, packId: pack.id };
  const page = localePath("/coins/", order.locale);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: pack.unitAmount,
            product_data: {
              name: `${pack.coins.toLocaleString("en")} dingn coins`,
            },
          },
        },
      ],
      client_reference_id: uid,
      metadata,
      // The receipt carries the payment description: the confirmation of the
      // buyer's waiver that EU/UK law asks for.
      payment_intent_data: {
        metadata,
        description: `${pack.coins.toLocaleString("en")} dingn coins. ${WAIVER_TEXT}`,
      },
      custom_text: { submit: { message: WAIVER_TEXT } },
      expires_at: Math.floor(order.expiresAt / 1000),
      locale: stripeLocale(order.locale),
      success_url: `https://dingn.com${page}?purchase=pending`,
      cancel_url: `https://dingn.com${page}?purchase=cancelled`,
    },
    { idempotencyKey: `dingn-coins-${order.id}` },
  );
  if (!session.url?.startsWith("https://checkout.stripe.com/"))
    throw new ApiError(502, "checkout-failed");
  return { url: session.url };
}
async function fulfillCoins(db, metadata, { paid, revoke, session, intent }) {
  const ref = db.doc(`coinOrders/${metadata.orderId}`);
  await db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data();
    if (
      !order ||
      order.uid !== metadata.uid ||
      order.packId !== metadata.packId
    )
      return;
    const walletRef = db.doc(`rewards/${order.uid}`);
    const wallet = (await tx.get(walletRef)).data() ?? {};
    const coins = wallet.coins ?? 0;
    if (paid) {
      const lines = session.line_items?.data || [];
      if (
        session.client_reference_id !== order.uid ||
        lines.length !== 1 ||
        lines[0].quantity !== 1 ||
        session.amount_total !== order.unitAmount ||
        session.currency !== order.currency
      )
        throw new ApiError(400, "payment-mismatch");
      // Credit once; a refund or dispute that came first wins.
      if (order.status !== "pending") return;
      tx.update(ref, { status: "paid", paymentIntent: session.payment_intent });
      tx.set(walletRef, {
        ...wallet,
        coins: coins + order.coins,
        bought: (wallet.bought ?? 0) + order.coins,
      });
    } else if (revoke) {
      if (order.status === "revoked") return;
      const wasPaid = order.status === "paid";
      // Take back what is left of the pack; coins already spent stay spent.
      const taken = wasPaid ? Math.min(coins, order.coins) : 0;
      tx.update(ref, {
        status: "revoked",
        paymentIntent: intent.id,
        coinsTaken: taken,
      });
      if (wasPaid)
        tx.set(walletRef, {
          ...wallet,
          coins: coins - taken,
          bought: Math.max(0, (wallet.bought ?? 0) - order.coins),
        });
    } else if (order.status === "pending") {
      tx.update(ref, { status: "expired" });
    }
  });
}
/** Coin pack orders for the purchase history, without abandoned checkouts. */
async function coinHistory(db, uid) {
  const now = Date.now();
  const docs = await db.collection("coinOrders").where("uid", "==", uid).get();
  return docs.docs
    .map((doc) => doc.data())
    .filter(
      (o) =>
        o.status === "paid" ||
        o.status === "revoked" ||
        (o.status === "pending" && o.expiresAt > now),
    )
    .map(({ id, packId, coins, status, createdAt, unitAmount, currency }) => ({
      id,
      kind: "coins",
      itemId: packId,
      game: "",
      name: {
        en: `${coins.toLocaleString("en")} coins`,
        "zh-CN": `${coins.toLocaleString("zh-CN")} 金币`,
      },
      status,
      createdAt,
      unitAmount,
      currency,
    }));
}
export async function inventory({ db }, uid) {
  const docs = await db.collection("shopOrders").where("uid", "==", uid).get();
  const items = docs.docs
    .map((doc) => doc.data())
    .map(
      ({
        id,
        itemId,
        game,
        name,
        status,
        createdAt,
        unitAmount,
        currency,
      }) => ({
        id,
        itemId,
        game,
        name,
        status,
        createdAt,
        unitAmount,
        currency,
      }),
    );
  return [...items, ...(await coinHistory(db, uid))].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}
export async function fulfill({ db, stripe }, event) {
  const object = event.data.object;
  const paid = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ].includes(event.type);
  const revoke = ["charge.refunded", "charge.dispute.created"].includes(
    event.type,
  );
  const expired = event.type === "checkout.session.expired";
  if (!paid && !revoke && !expired) return;
  let session, intent, metadata;
  if (paid || expired) {
    session = await stripe.checkout.sessions.retrieve(object.id, {
      expand: ["line_items"],
    });
    if (session.mode !== "payment") return;
    if (
      expired ? session.status !== "expired" : session.payment_status !== "paid"
    )
      return;
    metadata = session.metadata;
  } else {
    if (!object.payment_intent) return;
    intent = await stripe.paymentIntents.retrieve(object.payment_intent);
    metadata = intent.metadata;
  }
  if (!metadata?.orderId || !/^[a-f0-9-]{36}$/.test(metadata.orderId)) return;
  if (metadata.kind === "coins")
    return fulfillCoins(db, metadata, { paid, revoke, session, intent });
  const ref = db.doc(`shopOrders/${metadata.orderId}`);
  await db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data();
    if (
      !order ||
      order.uid !== metadata.uid ||
      order.itemId !== metadata.itemId
    )
      return;
    const itemRef = refFor(db, order.uid, order.itemId);
    const current = (await tx.get(itemRef)).data();
    if (expired) {
      if (order.status !== "pending") return;
      tx.update(ref, { status: "expired" });
      if (current?.orderId === order.id)
        tx.set(itemRef, { status: "expired", orderId: order.id });
    } else if (paid) {
      const lines = session.line_items?.data || [];
      if (
        session.client_reference_id !== order.uid ||
        lines.length !== 1 ||
        lines[0].price?.id !== order.priceId ||
        lines[0].quantity !== 1 ||
        session.amount_total !== order.unitAmount ||
        session.currency !== order.currency
      )
        throw new ApiError(400, "payment-mismatch");
      // Replayed/late payment events never undo a refund or dispute.
      if (order.status === "revoked" || order.status === "owned") return;
      tx.update(ref, {
        status: "owned",
        paymentIntent: session.payment_intent,
      });
      tx.set(itemRef, { status: "owned", orderId: order.id, game: order.game });
    } else {
      tx.update(ref, { status: "revoked", paymentIntent: intent.id });
      if (current?.orderId === order.id)
        tx.set(itemRef, { status: "revoked", orderId: order.id });
    }
  });
}
export function createBillingHandler(getServices = productionServices) {
  return async function handleBilling(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/api/billing/webhook") {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new ApiError(503, "shop-unavailable");
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk);
          if (size > 262144) throw new ApiError(413, "request-too-large");
          chunks.push(Buffer.from(chunk));
        }
        const deps = await getServices();
        if (!deps.stripe) throw new ApiError(503, "shop-unavailable");
        let event;
        try {
          event = deps.stripe.webhooks.constructEvent(
            Buffer.concat(chunks),
            req.headers["stripe-signature"],
            secret,
          );
        } catch {
          throw new ApiError(400, "invalid-signature");
        }
        await fulfill(deps, event);
        res.end(JSON.stringify({ received: true }));
        return;
      }
      validateOrigin(req);
      const body = await readBody(req),
        token = await refresh(req, res),
        deps = await getServices();
      // refresh() has just exchanged the session with Google, which rejects
      // disabled/revoked sessions. Verify that fresh token locally as the game
      // API does; checkRevoked would additionally require Auth admin IAM access.
      const { uid } = await deps.auth.verifyIdToken(token);
      let data;
      if (path === "/api/billing/items") data = await catalog(deps);
      else if (path === "/api/billing/coin-packs") data = coinPacks(deps);
      else if (path === "/api/billing/buy-coins") {
        throttle(req);
        data = await buyCoins(
          deps,
          uid,
          body?.packId,
          body?.locale,
          body?.waiver,
        );
      } else if (path === "/api/billing/inventory")
        data = await inventory(deps, uid);
      else if (path === "/api/billing/checkout") {
        throttle(req);
        data = await checkout(deps, uid, body?.itemId, body?.locale);
      } else throw new ApiError(404, "not-found");
      res.end(JSON.stringify(data));
    } catch (error) {
      if (!(error instanceof ApiError))
        console.error(
          `${req.url} failed:`,
          error?.type ?? "",
          error?.message ?? error,
        );
      res.statusCode = error instanceof ApiError ? error.status : 503;
      res.end(
        JSON.stringify({
          error: error instanceof ApiError ? error.code : "shop-unavailable",
        }),
      );
    }
  };
}
export const handleBilling = createBillingHandler();
