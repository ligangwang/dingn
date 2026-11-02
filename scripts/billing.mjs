// Dingn Premium billing routes. Stripe is driven by Firebase's "Run Payments
// with Stripe" extension (invertase/firestore-stripe-payments): it syncs
// products into Firestore, turns customers/{uid}/checkout_sessions docs into
// Stripe Checkout URLs, and sets the stripeRole custom claim for subscribers.
// Every Firestore and function call here uses the signed-in player's own ID
// token, so firestore.rules still decide access. No Stripe keys live here.
import { randomUUID } from "node:crypto";
import {
  ApiError,
  base,
  readBody,
  refresh,
  throttle,
  upstream,
  validateOrigin,
} from "./api.mjs";

export const PREMIUM_ROLE = "premium";
const PORTAL_URL =
  "https://us-central1-dingn-193716.cloudfunctions.net/ext-firestore-stripe-payments-createPortalLink";
const CHECKOUT_WAIT_MS = 20000;
const POLL_MS = 1000;
export const timing = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

// Only read after Google's token endpoint returned this token over TLS.
function claimsOf(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}
function value(field) {
  if (!field) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("mapValue" in field)
    return Object.fromEntries(
      Object.entries(field.mapValue.fields || {}).map(([k, v]) => [
        k,
        value(v),
      ]),
    );
  return undefined;
}
const equal = (field, v) => ({
  fieldFilter: {
    field: { fieldPath: field },
    op: "EQUAL",
    value: typeof v === "boolean" ? { booleanValue: v } : { stringValue: v },
  },
});
const all = (...filters) => ({ compositeFilter: { op: "AND", filters } });

// Active recurring prices of the active product with firebaseRole=premium.
// One-time prices are skipped: the extension only sets stripeRole for
// subscriptions, so a one-time charge would not activate Premium.
export async function premiumPrices(token) {
  const products = await upstream(
    `${base}:runQuery`,
    {
      structuredQuery: {
        from: [{ collectionId: "products" }],
        where: all(equal("active", true), equal("role", PREMIUM_ROLE)),
        limit: 5,
      },
    },
    token,
  );
  const prices = [];
  for (const { document } of products) {
    if (!document) continue;
    const path = document.name.slice(document.name.indexOf("/documents/"));
    const result = await upstream(
      `${base}${path.slice("/documents".length)}:runQuery`,
      {
        structuredQuery: {
          from: [{ collectionId: "prices" }],
          where: all(equal("active", true), equal("type", "recurring")),
          limit: 10,
        },
      },
      token,
    );
    for (const { document: price } of result) {
      if (!price) continue;
      const f = price.fields || {};
      const unitAmount = value(f.unit_amount);
      const currency = value(f.currency);
      if (typeof unitAmount !== "number" || typeof currency !== "string")
        continue;
      const interval = value(f.interval);
      prices.push({
        id: price.name.split("/").at(-1),
        currency,
        unitAmount,
        interval: typeof interval === "string" ? interval : null,
      });
    }
  }
  const order = (p) =>
    p.interval === "month" ? 0 : p.interval === "year" ? 1 : 2;
  return prices.sort(
    (a, b) => order(a) - order(b) || a.unitAmount - b.unitAmount,
  );
}

async function checkout(token, priceId, origin) {
  if (typeof priceId !== "string" || !priceId || priceId.length > 200)
    throw new ApiError(400, "invalid-request");
  if (!(await premiumPrices(token)).some((p) => p.id === priceId))
    throw new ApiError(400, "invalid-request");
  const uid = claimsOf(token).user_id;
  if (typeof uid !== "string" || !uid || uid.includes("/"))
    throw new ApiError(401, "invalid-credential");
  const path = `customers/${encodeURIComponent(uid)}/checkout_sessions/${randomUUID()}`;
  const s = (v) => ({ stringValue: v });
  await upstream(
    `${base}:commit`,
    {
      writes: [
        {
          update: {
            name: `projects/dingn-193716/databases/(default)/documents/${decodeURIComponent(path)}`,
            fields: {
              price: s(priceId),
              mode: s("subscription"),
              allow_promotion_codes: { booleanValue: true },
              success_url: s(`${origin}/account/?checkout=success`),
              cancel_url: s(`${origin}/account/?checkout=cancelled`),
            },
          },
          currentDocument: { exists: false },
        },
      ],
    },
    token,
  );
  // The extension fills in the Stripe URL (or an error) within a few seconds.
  for (let waited = 0; waited < CHECKOUT_WAIT_MS; waited += POLL_MS) {
    await timing.sleep(POLL_MS);
    const doc = await upstream(`${base}/${path}`, undefined, token, "GET");
    const url = value(doc.fields?.url);
    if (typeof url === "string" && url.startsWith("https://")) return { url };
    if (doc.fields?.error) throw new ApiError(502, "checkout-failed");
  }
  throw new ApiError(504, "checkout-timeout");
}

async function portal(token, origin) {
  const result = await upstream(
    PORTAL_URL,
    { data: { returnUrl: `${origin}/account/` } },
    token,
  );
  const url = result.result?.url;
  if (typeof url !== "string" || !url.startsWith("https://"))
    throw new ApiError(502, "unavailable");
  return { url };
}

export async function handleBilling(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    const route = new URL(req.url, "http://localhost").pathname;
    const body = await readBody(req);
    const token = await refresh(req, res);
    let data;
    if (route === "/api/billing/status") {
      data = { isPremium: claimsOf(token).stripeRole === PREMIUM_ROLE };
    } else if (route === "/api/billing/prices") {
      data = await premiumPrices(token);
    } else if (route === "/api/billing/checkout") {
      throttle(req);
      data = await checkout(token, body.price, req.headers.origin);
    } else if (route === "/api/billing/portal") {
      throttle(req);
      data = await portal(token, req.headers.origin);
    } else throw new ApiError(404, "not-found");
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e instanceof ApiError ? e.status : 503;
    res.end(
      JSON.stringify({ error: e instanceof ApiError ? e.code : "unavailable" }),
    );
  }
}
