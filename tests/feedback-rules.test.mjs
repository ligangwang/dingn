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
it("allows only a boolean admin token claim to read and list feedback", async () => {
  const admin = env
    .authenticatedContext("admin-user", { admin: true })
    .firestore();
  await assertSucceeds(getDocs(collection(admin, "feedback")));
  await assertSucceeds(getDoc(doc(admin, "feedback", "valid")));
  await assertFails(
    setDoc(doc(admin, "feedback", "fake"), {
      ...data(),
      uid: "admin-user",
      status: "reviewed",
    }),
  );
  const ordinary = env.authenticatedContext("ordinary").firestore();
  await setDoc(doc(ordinary, "accounts", "ordinary"), { admin: true });
  await assertFails(getDocs(collection(ordinary, "feedback")));
  for (const value of [false, "true", 1]) {
    await assertFails(
      getDocs(
        collection(
          env.authenticatedContext("not-admin", { admin: value }).firestore(),
          "feedback",
        ),
      ),
    );
  }
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
it("lets anyone signed in read a player's account, and only its owner change it", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(alice, "accounts", "alice"), { avatar: "owl" }),
  );
  await assertSucceeds(
    setDoc(doc(alice, "accounts", "alice"), { avatar: "fox" }, { merge: true }),
  );
  // Another player can read it, as another player's page shows it...
  await assertSucceeds(getDoc(doc(bob, "accounts", "alice")));
  // ...but never create, change or delete it.
  await assertFails(setDoc(doc(bob, "accounts", "alice"), { avatar: "robot" }));
  await assertFails(
    updateDoc(doc(bob, "accounts", "alice"), { avatar: "robot" }),
  );
  await assertFails(setDoc(doc(bob, "accounts", "carol"), { avatar: "frog" }));
  await assertFails(deleteDoc(doc(bob, "accounts", "alice")));
  await assertFails(deleteDoc(doc(alice, "accounts", "alice")));
  // Guests can do neither, and only admins can list every account.
  await assertFails(getDoc(doc(guest, "accounts", "alice")));
  await assertFails(getDocs(collection(bob, "accounts")));
  await assertSucceeds(
    getDocs(
      collection(
        env.authenticatedContext("boss", { admin: true }).firestore(),
        "accounts",
      ),
    ),
  );
});
it("leaves nicknames and public numbers to the server, which keeps them unique", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  // The server gives Alice her nickname (the Admin SDK skips these rules).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "accounts", "alice"), {
      user_name: "Player10001",
      name_key: "player10001",
      player_no: "4821937065",
    });
  });
  // She can save everything else, even sending her nickname back unchanged.
  await assertSucceeds(
    setDoc(doc(alice, "accounts", "alice"), { avatar: "fox" }, { merge: true }),
  );
  await assertSucceeds(
    setDoc(
      doc(alice, "accounts", "alice"),
      { user_name: "Player10001", avatar: "owl" },
      { merge: true },
    ),
  );
  // But not change it, or its register key, herself.
  await assertFails(
    updateDoc(doc(alice, "accounts", "alice"), { user_name: "Ada" }),
  );
  await assertFails(
    updateDoc(doc(alice, "accounts", "alice"), { name_key: "ada" }),
  );
  // Nor take another public number, which would take over another page.
  await assertFails(
    updateDoc(doc(alice, "accounts", "alice"), { player_no: "1000000001" }),
  );
  // A new account can't start with one either.
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(setDoc(doc(bob, "accounts", "bob"), { user_name: "Bob" }));
  await assertFails(
    setDoc(doc(bob, "accounts", "bob"), { player_no: "4821937065" }),
  );
  await assertSucceeds(setDoc(doc(bob, "accounts", "bob"), { avatar: "fox" }));
  // The name and number registers are the server's alone.
  for (const path of ["nicknames/ada", "playerNumbers/4821937065"]) {
    await assertFails(getDoc(doc(bob, path)));
    await assertFails(setDoc(doc(bob, path), { uid: "bob" }));
  }
});
it("keeps a player's favourite words theirs alone", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const fav = { uid: "alice", number: "07", favoriteWord: "sock" };
  await assertSucceeds(setDoc(doc(alice, "number_favorites", "alice-07"), fav));
  await assertSucceeds(getDoc(doc(alice, "number_favorites", "alice-07")));
  // A favourite not saved yet reads as missing, not as an error.
  await assertSucceeds(getDoc(doc(alice, "number_favorites", "alice-08")));
  await assertFails(getDoc(doc(bob, "number_favorites", "alice-07")));
  await assertFails(
    setDoc(doc(bob, "number_favorites", "alice-07"), { ...fav, uid: "bob" }),
  );
  // Nobody can file a favourite under someone else's name or number.
  await assertFails(
    setDoc(doc(bob, "number_favorites", "alice-09"), {
      ...fav,
      uid: "alice",
      number: "09",
    }),
  );
  await assertFails(
    setDoc(doc(bob, "number_favorites", "bob-09"), {
      ...fav,
      uid: "bob",
      number: "10",
    }),
  );
  await assertFails(deleteDoc(doc(alice, "number_favorites", "alice-07")));
});
it("lets players read the word lists but never change them, and opens nothing else", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "numbers", "07"), { number: "07" });
    await setDoc(doc(ctx.firestore(), "words", "sock"), { word: "sock" });
  });
  for (const [name, id] of [
    ["numbers", "07"],
    ["words", "sock"],
  ]) {
    await assertSucceeds(getDoc(doc(alice, name, id)));
    await assertFails(setDoc(doc(alice, name, id), { vandal: true }));
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), name, id)),
    );
  }
  // A collection with no rule of its own is closed, even to its "owner".
  for (const path of [
    "anything/alice",
    "customers/alice",
    "accounts/alice/private/x",
  ]) {
    await assertFails(setDoc(doc(alice, path), { x: 1 }));
    await assertFails(getDoc(doc(alice, path)));
  }
  await assertFails(
    setDoc(doc(alice, "feedback/valid/private/nested"), { leak: true }),
  );
});
it("keeps XP and plays server-only, even for their owner", async () => {
  const db = env.authenticatedContext("alice").firestore();
  for (const path of ["players/alice", "plays/p1", "players/alice/x/y"]) {
    await assertFails(setDoc(doc(db, path), { xp: 999999 }));
    await assertFails(getDoc(doc(db, path)));
  }
  await assertFails(updateDoc(doc(db, "players/alice"), { xp: 1 }));
  await assertFails(deleteDoc(doc(db, "plays/p1")));
  await assertFails(getDocs(collection(db, "players")));
});
