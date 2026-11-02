import { after, before, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
} from "firebase/firestore";
let env;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run with the Firestore emulator; never production.");
  env = await initializeTestEnvironment({
    projectId: "demo-dingn-feedback",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "products", "prod_1"), {
      active: true,
      role: "premium",
    });
    await setDoc(doc(db, "products", "prod_1", "prices", "price_1"), {
      active: true,
    });
    await setDoc(doc(db, "customers", "alice"), { email: "a@example.com" });
    await setDoc(doc(db, "customers", "alice", "subscriptions", "sub_1"), {
      status: "active",
    });
  });
});
after(async () => {
  await env?.cleanup();
});
const session = () => ({
  price: "price_1",
  mode: "subscription",
  allow_promotion_codes: true,
  success_url: "https://dingn.com/account/?checkout=success",
  cancel_url: "https://dingn.com/account/?checkout=cancelled",
});

it("lets anyone read products and prices but nobody write them", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(anon, "products")));
  await assertSucceeds(
    getDocs(collection(anon, "products", "prod_1", "prices")),
  );
  const alice = env.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(alice, "products", "prod_2"), { active: true }));
  await assertFails(
    updateDoc(doc(alice, "products", "prod_1", "prices", "price_1"), {
      unit_amount: 1,
    }),
  );
});

it("lets players create and read only their own checkout sessions", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const ref = await assertSucceeds(
    addDoc(
      collection(alice, "customers", "alice", "checkout_sessions"),
      session(),
    ),
  );
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { url: "https://evil.example" }));
  await assertFails(
    addDoc(collection(alice, "customers", "alice", "checkout_sessions"), {
      ...session(),
      customer: "cus_x",
    }),
  );
  await assertFails(
    addDoc(
      collection(alice, "customers", "bob", "checkout_sessions"),
      session(),
    ),
  );
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(getDoc(doc(bob, ref.path)));
  await assertFails(getDoc(doc(bob, "customers", "alice")));
});

it("never lets players write subscriptions or their customer record", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  await assertSucceeds(
    getDocs(collection(alice, "customers", "alice", "subscriptions")),
  );
  await assertFails(
    setDoc(doc(alice, "customers", "alice", "subscriptions", "sub_2"), {
      status: "active",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "customers", "alice"), { stripeId: "cus_x" }),
  );
  await assertFails(
    getDocs(
      collection(
        env.authenticatedContext("bob").firestore(),
        "customers",
        "alice",
        "subscriptions",
      ),
    ),
  );
});

it("keeps legacy collections writable by signed-in players", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  await assertSucceeds(
    setDoc(doc(alice, "accounts", "alice"), { user_name: "A" }),
  );
});
