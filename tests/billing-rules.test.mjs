import { after, before, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";
let env;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Emulator only");
  env = await initializeTestEnvironment({
    projectId: "demo-dingn-billing",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});
after(async () => env?.cleanup());
it("blocks forged purchases, ownership, Stripe records, XP and the game registry even for the matching player", async () => {
  for (const ctx of [
    env.unauthenticatedContext(),
    env.authenticatedContext("alice"),
    env.authenticatedContext("alice", { admin: true }),
  ]) {
    for (const path of [
      "shopOrders/order1",
      "shopInventory/alice/items/cape",
      "customers/alice/payments/pi1",
      "products/prod1",
      "players/alice",
      "plays/play1",
      "games/crowd",
    ]) {
      const ref = doc(ctx.firestore(), path);
      await assertFails(setDoc(ref, { status: "owned" }));
      await assertFails(getDoc(ref));
    }
  }
});
