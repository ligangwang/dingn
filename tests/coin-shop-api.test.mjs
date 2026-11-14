import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buyCoins,
  coinPacks,
  fulfill,
  validPacks,
} from "../scripts/billing.mjs";
const packs = JSON.parse(
  await readFile(
    new URL("../src/data/coin-packs.json", import.meta.url),
    "utf8",
  ),
);
let deps, records, sessions, calls;
beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  records = new Map();
  sessions = [];
  calls = [];
  const db = {
    doc: (path) => ({ path }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({ data: () => records.get(ref.path) }),
        set: (ref, data) => records.set(ref.path, data),
        update: (ref, data) =>
          records.set(ref.path, { ...records.get(ref.path), ...data }),
      }),
  };
  const stripe = {
    checkout: {
      sessions: {
        create: async (params, options) => {
          calls.push({ params, options });
          const line = params.line_items[0];
          const session = {
            id: `cs_${sessions.length}`,
            url: "https://checkout.stripe.com/c/test",
            ...params,
            mode: "payment",
            status: "complete",
            payment_status: "paid",
            amount_total: line.price_data.unit_amount * line.quantity,
            currency: line.price_data.currency,
            payment_intent: `pi_${sessions.length}`,
            line_items: { data: [{ quantity: line.quantity }] },
          };
          sessions.push(session);
          return session;
        },
        retrieve: async (id) => sessions.find((s) => s.id === id),
      },
    },
    paymentIntents: {
      retrieve: async (id) => ({
        id,
        metadata: sessions.find((s) => s.payment_intent === id).metadata,
      }),
    },
  };
  deps = { db, stripe, packs };
});
const paid = (i = 0) => ({
  type: "checkout.session.completed",
  data: { object: { id: `cs_${i}` } },
});
const refund = (i = 0) => ({
  type: "charge.refunded",
  data: { object: { payment_intent: `pi_${i}` } },
});
const balance = (uid = "alice") => records.get(`rewards/${uid}`)?.coins ?? 0;

test("ships three valid packs where bigger packs give more coins per dollar", () => {
  assert.equal(validPacks(packs).length, 3);
  const rates = packs.map((p) => p.coins / p.unitAmount);
  assert.ok(rates[0] < rates[1] && rates[1] < rates[2]);
});
test("the shop is closed until Stripe is configured, and reports test mode", () => {
  assert.equal(coinPacks(deps).packs.length, 3);
  assert.equal(coinPacks(deps).testMode, true);
  process.env.STRIPE_SECRET_KEY = "sk_live_x";
  assert.equal(coinPacks(deps).testMode, false);
  assert.deepEqual(coinPacks({ ...deps, stripe: null }).packs, []);
  delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.deepEqual(coinPacks(deps).packs, []);
});
test("checkout charges the server's price for the pack, for the signed-in account", async () => {
  await buyCoins(deps, "alice", "coins-800", "zh-CN");
  const { params, options } = calls[0];
  assert.equal(params.mode, "payment");
  assert.deepEqual(params.line_items[0].price_data.unit_amount, 199);
  assert.equal(params.line_items[0].quantity, 1);
  assert.equal(params.client_reference_id, "alice");
  assert.equal(params.metadata.kind, "coins");
  assert.match(
    params.success_url,
    /^https:\/\/dingn\.com\/zh\/coins\/\?purchase=pending$/,
  );
  assert.match(options.idempotencyKey, /^dingn-coins-/);
  await assert.rejects(
    buyCoins(deps, "alice", "coins-999999", "en"),
    /pack-unavailable/,
  );
});
test("a confirmed payment adds the pack's coins once, keeping the existing balance", async () => {
  records.set("rewards/alice", { coins: 50, spent: 10, badges: { a: 1 } });
  await buyCoins(deps, "alice", "coins-300", "en");
  sessions[0].payment_status = "unpaid";
  await fulfill(deps, paid());
  assert.equal(balance(), 50);
  sessions[0].payment_status = "paid";
  await fulfill(deps, paid());
  await fulfill(deps, paid());
  assert.equal(balance(), 350);
  assert.equal(records.get("rewards/alice").bought, 300);
  assert.deepEqual(records.get("rewards/alice").badges, { a: 1 });
});
test("a mismatched amount, currency or account never adds coins", async () => {
  await buyCoins(deps, "alice", "coins-2200", "en");
  for (const [field, value] of [
    ["amount_total", 1],
    ["currency", "eur"],
    ["client_reference_id", "bob"],
  ]) {
    const old = sessions[0][field];
    sessions[0][field] = value;
    await assert.rejects(fulfill(deps, paid()), /payment-mismatch/);
    sessions[0][field] = old;
  }
  assert.equal(balance(), 0);
});
test("a refund takes back unspent coins; one before payment blocks the credit", async () => {
  await buyCoins(deps, "alice", "coins-800", "en");
  await fulfill(deps, paid(0));
  records.get("rewards/alice").coins = 500; // 300 already spent
  await fulfill(deps, refund(0));
  await fulfill(deps, refund(0));
  assert.equal(balance(), 0);
  assert.equal(
    records.get(`coinOrders/${sessions[0].metadata.orderId}`).coinsTaken,
    500,
  );

  await buyCoins(deps, "alice", "coins-300", "en");
  await fulfill(deps, refund(1));
  await fulfill(deps, paid(1));
  assert.equal(balance(), 0);
});
test("an expired checkout never adds coins", async () => {
  await buyCoins(deps, "alice", "coins-300", "en");
  sessions[0].status = "expired";
  sessions[0].payment_status = "unpaid";
  await fulfill(deps, {
    type: "checkout.session.expired",
    data: { object: { id: "cs_0" } },
  });
  sessions[0].payment_status = "paid";
  await fulfill(deps, paid());
  assert.equal(balance(), 0);
});
