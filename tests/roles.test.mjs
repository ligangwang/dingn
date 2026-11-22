// Roles on accounts (scripts/roles.mjs) and the one-time move to them
// (scripts/migrate-roles.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRole, rolesOf, withRole, withRoles } from "../scripts/roles.mjs";
import { migrateRoles, migratedClaims } from "../scripts/migrate-roles.mjs";

test("roles come from the roles list and from old flags, in one order", () => {
  assert.deepEqual(rolesOf(undefined), []);
  assert.deepEqual(rolesOf({}), []);
  assert.deepEqual(rolesOf({ roles: ["tester", "admin"] }), [
    "admin",
    "tester",
  ]);
  assert.deepEqual(rolesOf({ admin: true, developer: true }), [
    "admin",
    "developer",
  ]);
  assert.deepEqual(rolesOf({ roles: ["developer"], admin: true }), [
    "admin",
    "developer",
  ]);
  // Only true flags and known roles count.
  assert.deepEqual(
    rolesOf({ admin: "true", developer: 1, roles: ["owner", "tester"] }),
    ["tester"],
  );
  assert.deepEqual(rolesOf({ roles: "admin" }), []);
  assert.equal(hasRole({ roles: ["admin"] }, "admin"), true);
  assert.equal(hasRole({ roles: ["developer"] }, "admin"), false);
});

test("changing a role keeps other claims and drops old flags", () => {
  assert.deepEqual(withRole({}, "tester"), { roles: ["tester"] });
  assert.deepEqual(
    withRole({ admin: true, developerBlocked: true }, "developer"),
    { developerBlocked: true, roles: ["admin", "developer"] },
  );
  assert.deepEqual(withRole({ roles: ["admin"] }, "admin", false), {});
  assert.deepEqual(withRoles({ tester: true, x: 1 }, ["tester"]), {
    x: 1,
    roles: ["tester"],
  });
  assert.throws(() => withRole({}, "owner"));
});

test("the move to roles changes only accounts with old flags, and only with --apply", async () => {
  assert.equal(migratedClaims(undefined), null);
  assert.equal(migratedClaims({ roles: ["admin"] }), null);
  assert.deepEqual(migratedClaims({ admin: true, developerBlocked: true }), {
    developerBlocked: true,
    roles: ["admin"],
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
      ["a", ["admin", "developer"]],
      ["d", ["tester"]],
    ],
  );
  assert.deepEqual(accounts.a, { admin: true, developer: true });

  await migrateRoles(users, { apply: true });
  assert.deepEqual(accounts.a, { roles: ["admin", "developer"] });
  assert.deepEqual(accounts.d, { developerBlocked: true, roles: ["tester"] });
  assert.deepEqual(accounts.b, { roles: ["tester"] });
  // Running it again changes nothing.
  assert.deepEqual(await migrateRoles(users, { apply: true }), []);
});
