// Roles on accounts (scripts/roles.mjs) and the one-time move to them
// (scripts/migrate-roles.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRole, rolesOf, withRole, withRoles } from "../scripts/roles.mjs";
import { migrateRoles, migratedClaims } from "../scripts/migrate-roles.mjs";

test("every account is a player unless it is a tester", () => {
  assert.deepEqual(rolesOf(undefined), ["player"]);
  assert.deepEqual(rolesOf({}), ["player"]);
  assert.deepEqual(rolesOf({ roles: ["tester"] }), ["tester"]);
  assert.deepEqual(rolesOf({ roles: ["developer", "administrator"] }), [
    "administrator",
    "developer",
    "player",
  ]);
  assert.deepEqual(rolesOf({ roles: ["tester", "administrator"] }), [
    "administrator",
    "tester",
  ]);
});

test("roles come from the roles list and from old flags", () => {
  assert.deepEqual(rolesOf({ admin: true, developer: true }), [
    "administrator",
    "developer",
    "player",
  ]);
  assert.deepEqual(rolesOf({ roles: ["developer"], admin: true }), [
    "administrator",
    "developer",
    "player",
  ]);
  assert.deepEqual(rolesOf({ tester: true }), ["tester"]);
  // Only true flags and known roles count; player is never read from claims.
  assert.deepEqual(
    rolesOf({ admin: "true", developer: 1, roles: ["owner", "admin"] }),
    ["player"],
  );
  assert.deepEqual(rolesOf({ roles: "administrator" }), ["player"]);
  assert.equal(hasRole({ roles: ["administrator"] }, "administrator"), true);
  assert.equal(hasRole({ roles: ["developer"] }, "administrator"), false);
  assert.equal(hasRole({}, "player"), true);
  assert.equal(hasRole({ roles: ["tester"] }, "player"), false);
});

test("granting a role keeps other claims, drops old flags and never stores player", () => {
  assert.deepEqual(withRole({}, "tester"), { roles: ["tester"] });
  assert.deepEqual(
    withRole({ admin: true, developerBlocked: true }, "developer"),
    { developerBlocked: true, roles: ["administrator", "developer"] },
  );
  assert.deepEqual(
    withRole({ roles: ["administrator"] }, "administrator", false),
    {},
  );
  assert.deepEqual(withRoles({ tester: true, x: 1 }, ["tester", "player"]), {
    x: 1,
    roles: ["tester"],
  });
  assert.throws(() => withRole({}, "player"));
  assert.throws(() => withRole({}, "owner"));
});

test("the move to roles changes only accounts with old flags, and only with --apply", async () => {
  assert.equal(migratedClaims(undefined), null);
  assert.equal(migratedClaims({ roles: ["administrator"] }), null);
  assert.deepEqual(migratedClaims({ admin: true, developerBlocked: true }), {
    developerBlocked: true,
    roles: ["administrator"],
  });
  assert.deepEqual(migratedClaims({ developer: false }), {});

  const accounts = {
    a: { admin: true, developer: true },
    b: { roles: ["tester"] },
    c: undefined,
    d: { tester: true, developerBlocked: true },
  };
  const users = {
    listUsers: async () => ({
      users: Object.entries(accounts).map(([uid, customClaims]) => ({
        uid,
        email: `${uid}@x.com`,
        customClaims,
      })),
    }),
    setCustomUserClaims: async (uid, claims) => (accounts[uid] = claims),
  };
  const dry = await migrateRoles(users);
  assert.deepEqual(
    dry.map((c) => [c.uid, c.roles]),
    [
      ["a", ["administrator", "developer"]],
      ["d", ["tester"]],
    ],
  );
  assert.deepEqual(accounts.a, { admin: true, developer: true });

  await migrateRoles(users, { apply: true });
  assert.deepEqual(accounts.a, { roles: ["administrator", "developer"] });
  assert.deepEqual(accounts.d, { developerBlocked: true, roles: ["tester"] });
  assert.deepEqual(accounts.b, { roles: ["tester"] });
  // Running it again changes nothing.
  assert.deepEqual(await migrateRoles(users, { apply: true }), []);
});
