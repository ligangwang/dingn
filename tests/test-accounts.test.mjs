// Test accounts, made by admins on the Users page (scripts/test-accounts.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TESTERS,
  newPassword,
  testerEmails,
  testers,
} from "../scripts/test-accounts.mjs";
import { notOnBoard } from "../scripts/game-api.mjs";

/** A small stand-in for Firebase Auth's admin API. */
function fakeAuth(seed = []) {
  const users = new Map(seed.map((u) => [u.uid, structuredClone(u)]));
  let next = 1;
  const byEmail = (email) =>
    [...users.values()].find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
  return {
    users,
    listUsers: async () => ({ users: [...users.values()] }),
    getUser: async (uid) => {
      if (!users.has(uid)) throw new Error("auth/user-not-found");
      return users.get(uid);
    },
    getUsers: async (ids) => {
      const found = ids
        .map((id) => (id.uid ? users.get(id.uid) : byEmail(id.email)))
        .filter(Boolean);
      return {
        users: found,
        notFound: ids.filter(
          (id) => !(id.uid ? users.get(id.uid) : byEmail(id.email)),
        ),
      };
    },
    createUser: async (props) => {
      if (byEmail(props.email)) throw new Error("auth/email-already-exists");
      const user = {
        uid: `u${next++}`,
        ...props,
        metadata: { creationTime: "Sun, 22 Nov 2026 10:00:00 GMT" },
      };
      users.set(user.uid, user);
      return user;
    },
    setCustomUserClaims: async (uid, claims) => {
      users.get(uid).customClaims = claims;
    },
    updateUser: async (uid, props) => Object.assign(users.get(uid), props),
    revokeRefreshTokens: async (uid) => (users.get(uid).revoked = true),
    deleteUser: async (uid) => users.delete(uid),
  };
}
const create = (auth, body) =>
  testers(
    "/api/admin/testers/update",
    { action: "create", ...body },
    auth,
    "admin",
  );
const rejects = (promise, code) =>
  assert.rejects(promise, (e) => e.code === code);

test("an address becomes numbered addresses when several accounts are made", () => {
  assert.deepEqual(testerEmails("qa@example.com"), ["qa@example.com"]);
  assert.deepEqual(testerEmails("you+qa@gmail.com", 3), [
    "you+qa1@gmail.com",
    "you+qa2@gmail.com",
    "you+qa3@gmail.com",
  ]);
  assert.match(newPassword(), /^[A-Za-z0-9_-]{16}$/);
});

test("test accounts are made confirmed, as testers, with one password that comes back once", async () => {
  const auth = fakeAuth();
  const made = await create(auth, {
    email: "qa@example.com",
    count: 2,
    name: "QA",
  });
  assert.deepEqual(
    made.testers.map((t) => [t.email, t.name]),
    [
      ["qa1@example.com", "QA 1"],
      ["qa2@example.com", "QA 2"],
    ],
  );
  assert.match(made.password, /^[A-Za-z0-9_-]{16}$/);
  for (const user of auth.users.values()) {
    // Their address is confirmed when they are made.
    assert.equal(user.emailVerified, true);
    assert.deepEqual(user.customClaims, { roles: ["tester"] });
    assert.equal(user.password, made.password);
  }
  // A password asked for is used as it is.
  const own = await create(auth, {
    email: "solo@example.com",
    password: "letmein-123",
  });
  assert.equal(own.password, "letmein-123");
  assert.equal(auth.users.get(own.testers[0].uid).password, "letmein-123");
});

test("bad requests and taken addresses make no accounts", async () => {
  const auth = fakeAuth([{ uid: "real", email: "qa2@example.com" }]);
  await rejects(
    create(auth, { email: "qa@example.com", count: 3 }),
    "email-already-in-use",
  );
  await rejects(create(auth, { email: "not an email" }), "invalid-request");
  await rejects(
    create(auth, { email: "qa@example.com", count: 0 }),
    "invalid-request",
  );
  await rejects(
    create(auth, { email: "qa@example.com", count: MAX_TESTERS + 1 }),
    "invalid-request",
  );
  await rejects(
    create(auth, { email: "qa@example.com", password: "short" }),
    "weak-password",
  );
  assert.deepEqual([...auth.users.keys()], ["real"]);
});

test("only test accounts are listed, given new passwords or deleted", async () => {
  const auth = fakeAuth([
    { uid: "ada", email: "ada@dingn.com", customClaims: { admin: true } },
    { uid: "qa", email: "qa@example.com", customClaims: { tester: true } },
  ]);
  const { testers: list } = await testers(
    "/api/admin/testers",
    {},
    auth,
    "ada",
  );
  assert.deepEqual(
    list.map((t) => t.uid),
    ["qa"],
  );

  const update = (body) =>
    testers("/api/admin/testers/update", body, auth, "ada");
  const reset = await update({ action: "password", uid: "qa" });
  assert.equal(auth.users.get("qa").password, reset.password);
  // Sessions signed in with the old password end.
  assert.equal(auth.users.get("qa").revoked, true);
  await rejects(update({ action: "password", uid: "ada" }), "not-a-tester");
  await rejects(update({ action: "delete", uid: "ada" }), "not-a-tester");
  await rejects(update({ action: "delete", uid: "gone" }), "user-not-found");
  assert.ok(auth.users.has("ada"));

  assert.deepEqual(await update({ action: "delete", uid: "qa" }), {
    uid: "qa",
  });
  assert.deepEqual([...auth.users.keys()], ["ada"]);
  await rejects(update({ action: "rename", uid: "qa" }), "invalid-request");
});

test("test accounts and deleted accounts stay off the leaderboard", async () => {
  const auth = fakeAuth([
    { uid: "ada", email: "ada@dingn.com" },
    { uid: "qa", email: "qa@example.com", customClaims: { tester: true } },
  ]);
  assert.deepEqual(
    [...(await notOnBoard(auth, ["ada", "qa", "gone"]))].sort(),
    ["gone", "qa"],
  );
  // If Firebase can't be asked, nobody is left out.
  const broken = { getUsers: async () => Promise.reject(new Error("down")) };
  assert.equal((await notOnBoard(broken, ["ada"])).size, 0);
});

test("passwords never reach the server's logs", async () => {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const auth = fakeAuth();
    const made = await create(auth, {
      email: "qa@example.com",
      password: "visible-secret-1",
    });
    const reset = await testers(
      "/api/admin/testers/update",
      { action: "password", uid: made.testers[0].uid },
      auth,
      "admin",
    );
    assert.ok(lines.length >= 2);
    for (const line of lines) {
      assert.ok(!line.includes("visible-secret-1"), line);
      assert.ok(!line.includes(reset.password), line);
      assert.ok(!line.includes("qa@example.com"), line);
    }
  } finally {
    console.log = log;
  }
});

test("a test account made an admin can't delete itself", async () => {
  const auth = fakeAuth([
    {
      uid: "qa",
      email: "qa@example.com",
      customClaims: { tester: true, admin: true },
    },
  ]);
  await rejects(
    testers(
      "/api/admin/testers/update",
      { action: "delete", uid: "qa" },
      auth,
      "qa",
    ),
    "cannot-remove-self",
  );
  assert.ok(auth.users.has("qa"));
});

test("an account whose tester claim can't be set is removed again", async () => {
  const auth = fakeAuth();
  auth.setCustomUserClaims = async () => {
    throw new Error("auth unavailable");
  };
  await assert.rejects(create(auth, { email: "qa@example.com", count: 2 }));
  assert.equal(auth.users.size, 0);
});
