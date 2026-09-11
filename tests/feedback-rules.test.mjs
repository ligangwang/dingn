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
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
let env;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run with the Firestore emulator; never production.");
  env = await initializeTestEnvironment({
    projectId: "demo-dingn-feedback",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});
after(async () => {
  await env?.cleanup();
});
const data = () => ({
  uid: "alice",
  message: "First line\nSecond line",
  createdAt: serverTimestamp(),
  status: "new",
});
it("allows valid signed-in submissions and admin console-style access", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertSucceeds(setDoc(doc(db, "feedback", "valid"), data()));
  await env.withSecurityRulesDisabled(async (context) => {
    await assertSucceeds(getDoc(doc(context.firestore(), "feedback", "valid")));
  });
});
it("denies public/submitter/other-user reads, listing, changes and deletion", async () => {
  for (const context of [
    env.unauthenticatedContext(),
    env.authenticatedContext("alice"),
    env.authenticatedContext("bob"),
  ]) {
    const db = context.firestore();
    await assertFails(getDoc(doc(db, "feedback", "valid")));
    await assertFails(getDocs(collection(db, "feedback")));
    await assertFails(
      updateDoc(doc(db, "feedback", "valid"), { status: "read" }),
    );
    await assertFails(deleteDoc(doc(db, "feedback", "valid")));
  }
});
it("rejects anonymous, forged, oversized, whitespace and extra-field submissions", async () => {
  await assertFails(
    setDoc(
      doc(env.unauthenticatedContext().firestore(), "feedback", "anon"),
      data(),
    ),
  );
  const db = env.authenticatedContext("alice").firestore();
  for (const [i, override] of [
    { uid: "bob" },
    { message: "" },
    { message: " \n\t " },
    { message: "x".repeat(5001) },
    { status: "reviewed" },
    { createdAt: new Date(0) },
    { private: false },
  ].entries()) {
    await assertFails(
      setDoc(doc(db, "feedback", `invalid-${i}`), { ...data(), ...override }),
    );
  }
  await assertFails(setDoc(doc(db, "feedback", "missing"), { uid: "alice" }));
});
it("preserves legacy collection access and excludes nested feedback paths", async () => {
  const db = env.authenticatedContext("alice").firestore();
  for (const name of ["accounts", "numbers", "words", "number_favorites"]) {
    await assertSucceeds(setDoc(doc(db, name, "fixture"), { legacy: true }));
    await assertSucceeds(getDoc(doc(db, name, "fixture")));
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), name, "fixture")),
    );
  }
  await assertFails(
    setDoc(doc(db, "feedback/valid/private/nested"), { leak: true }),
  );
});
