import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleBilling, timing } from "../scripts/billing.mjs";
const original = globalThis.fetch;
timing.sleep = async () => {};
afterEach(() => {
  globalThis.fetch = original;
});
async function request(path, body = {}, headers = {}, method = "POST") {
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url: path,
    socket: { remoteAddress: `billing-${Math.random()}` },
    headers: {
      origin: "http://127.0.0.1:3001",
      "content-type": "application/json",
      "x-dingn-request": "1",
      cookie: "dingn-session=refresh-1",
      ...headers,
    },
  });
  const result = { status: 200, headers: {}, body: null };
  const res = {
    setHeader: (k, v) => {
      result.headers[k] = v;
    },
    set statusCode(v) {
      result.status = v;
    },
    end: (v) => {
      result.body = JSON.parse(v);
    },
  };
  await handleBilling(req, res);
  return result;
}
function stub(responses) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({
      url,
      ...options,
      body: options.body && JSON.parse(options.body),
    });
    const next = responses.shift();
    assert.ok(next, `unexpected upstream request ${url}`);
    return {
      ok: !next.status,
      status: next.status || 200,
      json: async () => next.data,
    };
  };
  return calls;
}
const token = (claims) =>
  `h.${Buffer.from(JSON.stringify({ user_id: "u1", ...claims })).toString("base64url")}.s`;
const signedIn = (claims = {}) => ({
  data: { id_token: token(claims), refresh_token: "refresh-2" },
});
const root = "projects/dingn-193716/databases/(default)/documents";
const products = {
  data: [{ document: { name: `${root}/products/prod_1`, fields: {} } }],
};
const prices = {
  data: [
    {
      document: {
        name: `${root}/products/prod_1/prices/price_year`,
        fields: {
          unit_amount: { integerValue: "1999" },
          currency: { stringValue: "usd" },
          interval: { stringValue: "year" },
        },
      },
    },
    {
      document: {
        name: `${root}/products/prod_1/prices/price_month`,
        fields: {
          unit_amount: { integerValue: "299" },
          currency: { stringValue: "usd" },
          interval: { stringValue: "month" },
        },
      },
    },
  ],
};

test("lists only active recurring premium prices, monthly first, using the player's token", async () => {
  const calls = stub([signedIn(), products, prices]);
  const result = await request("/api/billing/prices");
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.map((p) => [p.id, p.unitAmount, p.interval]),
    [
      ["price_month", 299, "month"],
      ["price_year", 1999, "year"],
    ],
  );
  assert.match(calls[2].url, /products\/prod_1:runQuery$/);
  const filters = calls[2].body.structuredQuery.where.compositeFilter.filters;
  assert.deepEqual(
    filters.map((f) => f.fieldFilter.field.fieldPath),
    ["active", "type"],
  );
  assert.equal(calls[1].headers.Authorization, `Bearer ${token({})}`);
});

test("creates a checkout session for the signed-in player and returns the Stripe URL", async () => {
  const calls = stub([
    signedIn(),
    products,
    prices,
    { data: {} },
    { data: { fields: {} } },
    {
      data: {
        fields: { url: { stringValue: "https://checkout.stripe.com/c/1" } },
      },
    },
  ]);
  const result = await request("/api/billing/checkout", {
    price: "price_month",
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { url: "https://checkout.stripe.com/c/1" });
  const write = calls[3].body.writes[0];
  assert.match(
    write.update.name,
    /documents\/customers\/u1\/checkout_sessions\//,
  );
  assert.deepEqual(write.currentDocument, { exists: false });
  assert.equal(write.update.fields.mode.stringValue, "subscription");
  assert.equal(
    write.update.fields.success_url.stringValue,
    "http://127.0.0.1:3001/account/?checkout=success",
  );
  assert.equal(calls[4].method, "GET");
});

test("rejects a price that is not an active premium price", async () => {
  const calls = stub([signedIn(), products, prices]);
  const result = await request("/api/billing/checkout", {
    price: "price_other",
  });
  assert.equal(result.status, 400);
  assert.equal(calls.length, 3);
});

test("reports a checkout error written by the extension", async () => {
  stub([
    signedIn(),
    products,
    prices,
    { data: {} },
    { data: { fields: { error: { mapValue: { fields: {} } } } } },
  ]);
  const result = await request("/api/billing/checkout", {
    price: "price_month",
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "checkout-failed");
});

test("reads premium status from the stripeRole claim", async () => {
  stub([signedIn({ stripeRole: "premium" })]);
  assert.deepEqual((await request("/api/billing/status")).body, {
    isPremium: true,
  });
  stub([signedIn({ stripeRole: "basic" })]);
  assert.deepEqual((await request("/api/billing/status")).body, {
    isPremium: false,
  });
});

test("opens the Stripe portal through the extension's callable function", async () => {
  const calls = stub([
    signedIn(),
    { data: { result: { url: "https://billing.stripe.com/p/1" } } },
  ]);
  const result = await request("/api/billing/portal");
  assert.deepEqual(result.body, { url: "https://billing.stripe.com/p/1" });
  assert.match(calls[1].url, /ext-firestore-stripe-payments-createPortalLink$/);
  assert.deepEqual(calls[1].body, {
    data: { returnUrl: "http://127.0.0.1:3001/account/" },
  });
});

test("requires sign-in, same-origin POST and never calls upstream otherwise", async () => {
  const calls = stub([]);
  assert.equal(
    (await request("/api/billing/prices", {}, { cookie: "" })).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/billing/checkout",
        {},
        { origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/billing/status", {}, {}, "GET")).status,
    405,
  );
  assert.equal(calls.length, 0);
});
