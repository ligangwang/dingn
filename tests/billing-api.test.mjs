import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import Stripe from "stripe";
import {
  catalog,
  checkout,
  fulfill,
  inventory,
  createBillingHandler,
} from "../scripts/billing.mjs";
const item = {
  id: "test-cape",
  game: "morrowglint",
  active: true,
  priceId: "price_test",
  name: { en: "Test cape", "zh-CN": "测试披风" },
  description: { en: "Test only", "zh-CN": "仅供测试" },
};
let deps, records, sessions, calls;
beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  records = new Map();
  sessions = new Map();
  calls = [];
  const db = {
    doc: (path) => ({ path }),
    collection: (name) => ({
      where: (field, op, value) => ({
        get: async () => ({
          docs: [...records]
            .filter(([p, r]) => p.startsWith(name + "/") && r[field] === value)
            .map(([, r]) => ({ data: () => r })),
        }),
      }),
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({ data: () => records.get(ref.path) }),
        set: (ref, data) => records.set(ref.path, data),
        update: (ref, data) =>
          records.set(ref.path, { ...records.get(ref.path), ...data }),
      }),
  };
  const stripe = {
    prices: {
      retrieve: async () => ({
        active: true,
        type: "one_time",
        unit_amount: 300,
        currency: "usd",
      }),
    },
    checkout: {
      sessions: {
        create: async (params, options) => {
          calls.push({ params, options });
          const key = options.idempotencyKey;
          if (!sessions.has(key))
            sessions.set(key, {
              id: "cs_test",
              url: "https://checkout.stripe.com/c/test",
              ...params,
              payment_status: "paid",
              amount_total: 300,
              currency: "usd",
              payment_intent: "pi_test",
              line_items: {
                data: [{ price: { id: "price_test" }, quantity: 1 }],
              },
            });
          return sessions.get(key);
        },
        retrieve: async () => [...sessions.values()][0],
      },
    },
    paymentIntents: {
      retrieve: async () => ({
        id: "pi_test",
        metadata: [...sessions.values()][0].metadata,
      }),
    },
    webhooks: new Stripe("sk_test_fake").webhooks,
  };
  deps = {
    db,
    stripe,
    items: [item],
    auth: { verifyIdToken: async () => ({ uid: "alice" }) },
  };
});
const event = (type) => ({
  type,
  data: { object: { id: "cs_test", payment_intent: "pi_test" } },
});
test("catalog hides unreleased and recurring items and unconfigured payments", async () => {
  assert.equal((await catalog(deps)).length, 1);
  deps.items = [{ ...item, active: false }];
  assert.deepEqual(await catalog(deps), []);
  deps.items = [item];
  deps.stripe.prices.retrieve = async () => ({
    active: true,
    type: "recurring",
    unit_amount: 300,
    currency: "usd",
  });
  assert.deepEqual(await catalog(deps), []);
  assert.deepEqual(await catalog({ ...deps, stripe: null }), []);
});
test("checkout uses server price, one-time mode, account identity and same idempotency key on retries", async () => {
  await checkout(deps, "alice", "test-cape", "en");
  await checkout(deps, "alice", "test-cape", "zh-CN");
  assert.equal(calls[0].params.mode, "payment");
  assert.deepEqual(calls[0].params.line_items, [
    { price: "price_test", quantity: 1 },
  ]);
  assert.equal(calls[0].params.client_reference_id, "alice");
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(
    [...records.keys()].filter((p) => p.startsWith("shopOrders/")).length,
    1,
  );
  await assert.rejects(
    checkout(deps, "alice", "unknown", "en"),
    /item-unavailable/,
  );
});
test("pending/forged return never grants ownership; confirmed payment is idempotent and prevents repurchase", async () => {
  await checkout(deps, "alice", "test-cape", "en");
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "pending",
  );
  const session = [...sessions.values()][0];
  session.payment_status = "unpaid";
  await fulfill(deps, event("checkout.session.completed"));
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "pending",
  );
  session.payment_status = "paid";
  await fulfill(deps, event("checkout.session.completed"));
  await fulfill(deps, event("checkout.session.completed"));
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "owned",
  );
  await assert.rejects(
    checkout(deps, "alice", "test-cape", "en"),
    /already-owned/,
  );
  assert.deepEqual(await inventory(deps, "bob"), []);
  assert.equal((await inventory(deps, "alice"))[0].status, "owned");
});
test("wrong price, amount, currency and account never grant ownership", async () => {
  await checkout(deps, "alice", "test-cape", "en");
  const s = [...sessions.values()][0];
  for (const [field, value] of [
    ["amount_total", 1],
    ["currency", "eur"],
    ["client_reference_id", "bob"],
  ]) {
    const old = s[field];
    s[field] = value;
    await assert.rejects(
      fulfill(deps, event("checkout.session.completed")),
      /payment-mismatch/,
    );
    s[field] = old;
  }
  s.line_items.data[0].price.id = "price_other";
  await assert.rejects(
    fulfill(deps, event("checkout.session.completed")),
    /payment-mismatch/,
  );
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "pending",
  );
});
test("refund or dispute revokes access even before success; late success cannot restore it", async () => {
  for (const type of ["charge.refunded", "charge.dispute.created"]) {
    records.clear();
    sessions.clear();
    await checkout(deps, "alice", "test-cape", "en");
    await fulfill(deps, event(type));
    await fulfill(deps, event("checkout.session.completed"));
    assert.equal(
      records.get("shopInventory/alice/items/test-cape").status,
      "revoked",
    );
  }
});
test("expired checkout permits a new order but expired event cannot revoke paid item", async () => {
  await checkout(deps, "alice", "test-cape", "en");
  const s = [...sessions.values()][0];
  s.status = "expired";
  s.payment_status = "unpaid";
  await fulfill(deps, event("checkout.session.expired"));
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "expired",
  );
  await checkout(deps, "alice", "test-cape", "en");
  assert.notEqual(
    calls[0].options.idempotencyKey,
    calls[1].options.idempotencyKey,
  );
});
async function request(path, body = "{}", headers = {}, method = "POST") {
  const req = Readable.from([body]);
  Object.assign(req, {
    method,
    url: path,
    headers,
    socket: { remoteAddress: "test" },
  });
  const result = { status: 200, body: null };
  const res = {
    setHeader() {},
    set statusCode(v) {
      result.status = v;
    },
    end(v) {
      result.body = JSON.parse(v);
    },
  };
  await createBillingHandler(async () => deps)(req, res);
  return result;
}
test("webhook requires valid signature over raw body; accepts genuine signed events", async () => {
  const payload = JSON.stringify({
    id: "evt_test",
    type: "irrelevant",
    data: { object: {} },
  });
  assert.equal(
    (
      await request("/api/billing/webhook", payload, {
        "stripe-signature": "bad",
      })
    ).status,
    400,
  );
  const signature = deps.stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_test",
  });
  assert.equal(
    (
      await request("/api/billing/webhook", payload, {
        "stripe-signature": signature,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/billing/webhook", payload + " ", {
        "stripe-signature": signature,
      })
    ).status,
    400,
  );
});
test("browser routes require same-origin POST and sign-in before accessing billing", async () => {
  assert.equal(
    (await request("/api/billing/items", "{}", {}, "GET")).status,
    405,
  );
  assert.equal((await request("/api/billing/items")).status, 403);
  assert.equal(
    (
      await request("/api/billing/items", "{}", {
        origin: "http://127.0.0.1:3001",
        "x-dingn-request": "1",
        "content-type": "application/json",
      })
    ).status,
    401,
  );
});
test("refund after ownership revokes the item, and expiry cannot revoke a paid item", async () => {
  await checkout(deps, "alice", "test-cape", "en");
  await fulfill(deps, event("checkout.session.completed"));
  const session = [...sessions.values()][0];
  session.status = "expired";
  await fulfill(deps, event("checkout.session.expired"));
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "owned",
  );
  await fulfill(deps, event("charge.refunded"));
  assert.equal(
    records.get("shopInventory/alice/items/test-cape").status,
    "revoked",
  );
});
