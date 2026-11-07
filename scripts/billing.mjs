import { randomUUID } from "node:crypto";
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
    };
  })();
  return services;
}
// Only release-ready, non-consumable items explicitly enabled in source can sell.
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
      locale: locale === "zh-CN" ? "zh-CN" : "en",
    };
    tx.set(db.doc(`shopOrders/${proposedId}`), record);
    tx.set(inventory, { status: "pending", orderId: proposedId });
    return record;
  });
  const metadata = { orderId: order.id, uid, itemId: order.itemId };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: order.priceId, quantity: 1 }],
      client_reference_id: uid,
      metadata,
      payment_intent_data: { metadata },
      expires_at: Math.floor(order.expiresAt / 1000),
      locale: order.locale === "zh-CN" ? "zh" : "en",
      success_url: `https://dingn.com/account/?purchase=pending&lang=${order.locale}`,
      cancel_url: `https://dingn.com/account/?purchase=cancelled&lang=${order.locale}`,
    },
    { idempotencyKey: `dingn-item-${order.id}` },
  );
  if (!session.url?.startsWith("https://checkout.stripe.com/"))
    throw new ApiError(502, "checkout-failed");
  return { url: session.url };
}
export async function inventory({ db }, uid) {
  const docs = await db.collection("shopOrders").where("uid", "==", uid).get();
  return docs.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.createdAt - a.createdAt)
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
      const { uid } = await deps.auth.verifyIdToken(token, true);
      let data;
      if (path === "/api/billing/items") data = await catalog(deps);
      else if (path === "/api/billing/inventory")
        data = await inventory(deps, uid);
      else if (path === "/api/billing/checkout") {
        throttle(req);
        data = await checkout(deps, uid, body?.itemId, body?.locale);
      } else throw new ApiError(404, "not-found");
      res.end(JSON.stringify(data));
    } catch (error) {
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
