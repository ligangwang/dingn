// Roles on accounts (scripts/roles.mjs) and the move to full role lists
// (scripts/migrate-roles.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRole, rolesOf, withRole, withRoles } from "../scripts/roles.mjs";
import { migrateRoles, migratedClaims } from "../scripts/migrate-roles.mjs";

test("an account's roles are its list; with no list it is a player", () => {
  assert.deepEqual(rolesOf(undefined), ["player"]);
  assert.deepEqual(rolesOf({}), ["player"]);
  assert.deepEqual(rolesOf({ roles: ["player", "administrator"] }), [
    "administrator",
    "player",
  ]);
  assert.deepEqual(rolesOf({ roles: ["tester"] }), ["tester"]);
  // A list is exactly what the account holds.
  assert.deepEqual(rolesOf({ roles: ["administrator"] }), ["administrator"]);
  assert.deepEqual(rolesOf({ roles: [] }), []);
  // Unknown roles and a list that isn't one are ignored.
  assert.deepEqual(rolesOf({ roles: ["owner", "developer"] }), ["developer"]);
  assert.deepEqual(rolesOf({ roles: "administrator" }), ["player"]);
  assert.equal(hasRole({}, "player"), true);
  assert.equal(hasRole({ roles: ["tester"] }, "player"), false);
  assert.equal(hasRole({ roles: ["developer"] }, "administrator"), false);
});

test("old flags still count", () => {
  assert.deepEqual(rolesOf({ admin: true, developer: true }), [
    "administrator",
    "developer",
    "player",
  ]);
  assert.deepEqual(rolesOf({ tester: true }), ["tester"]);
  assert.deepEqual(rolesOf({ admin: true, roles: ["developer", "player"] }), [
    "administrator",
    "developer",
    "player",
  ]);
  assert.deepEqual(rolesOf({ admin: "true", developer: 1 }), ["player"]);
});

test("changing a role writes the whole list, keeps other claims and drops old flags", () => {
  assert.deepEqual(withRole({}, "developer"), {
    roles: ["developer", "player"],
  });
  assert.deepEqual(
    withRole({ admin: true, developerBlocked: true }, "developer"),
    {
      developerBlocked: true,
      roles: ["administrator", "developer", "player"],
    },
  );
  assert.deepEqual(
    withRole({ roles: ["administrator", "player"] }, "administrator", false),
    { roles: ["player"] },
  );
  // player can be taken away like any role.
  assert.deepEqual(withRole({ roles: ["player"] }, "player", false), {
    roles: [],
  });
  assert.deepEqual(withRoles({ tester: true, x: 1 }, ["tester"]), {
    x: 1,
    roles: ["tester"],
  });
  assert.throws(() => withRole({}, "owner"));
});

test("a tester is never a player, whichever way roles change", () => {
  // Making an account a tester takes player away.
  assert.deepEqual(withRole({}, "tester"), { roles: ["tester"] });
  assert.deepEqual(withRole({ roles: ["administrator", "player"] }, "tester"), {
    roles: ["administrator", "tester"],
  });
  // Giving a tester player changes nothing; removing tester makes a player.
  assert.deepEqual(withRole({ roles: ["tester"] }, "player"), {
    roles: ["tester"],
  });
  assert.deepEqual(withRole({ roles: ["tester"] }, "tester", false), {
    roles: [],
  });
  assert.deepEqual(withRoles({}, ["player", "tester"]), { roles: ["tester"] });
  // A list holding both is read as a tester.
  assert.deepEqual(rolesOf({ roles: ["player", "tester"] }), ["tester"]);
});

test("the migration writes every account's full list, player included", () => {
  assert.deepEqual(migratedClaims(undefined), { roles: ["player"] });
  assert.deepEqual(migratedClaims({}), { roles: ["player"] });
  assert.equal(migratedClaims({ roles: ["player"] }), null);
  assert.equal(migratedClaims({ roles: ["tester"] }), null);
  // Accounts given a list before player was stored get it added.
  assert.deepEqual(migratedClaims({ roles: ["administrator", "developer"] }), {
    roles: ["administrator", "developer", "player"],
  });
  // Without --drop-flags, old flags stay beside the list.
  assert.deepEqual(migratedClaims({ admin: true, developerBlocked: true }), {
    admin: true,
    developerBlocked: true,
    roles: ["administrator", "player"],
  });
  assert.equal(
    migratedClaims({ admin: true, roles: ["administrator", "player"] }),
    null,
  );
  // With it, they go.
  const drop = { dropFlags: true };
  assert.deepEqual(
    migratedClaims({ admin: true, roles: ["administrator", "player"] }, drop),
    { roles: ["administrator", "player"] },
  );
  assert.deepEqual(migratedClaims({ tester: true }, drop), {
    roles: ["tester"],
  });
  assert.equal(migratedClaims({ roles: ["tester"] }, drop), null);
});

test("the migration changes accounts only with --apply, and is safe to rerun", async () => {
  const accounts = {
    a: { admin: true, developer: true, roles: ["administrator", "developer"] },
    b: { roles: ["tester"] },
    c: undefined,
    d: { tester: true, developerBlocked: true },
    e: { roles: ["player"] },
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
  const options = { dropFlags: true };
  const dry = await migrateRoles(users, options);
  assert.deepEqual(
    dry.map((c) => [c.uid, c.roles]),
    [
      ["a", ["administrator", "developer", "player"]],
      ["c", ["player"]],
      ["d", ["tester"]],
    ],
  );
  assert.equal(accounts.c, undefined);

  await migrateRoles(users, { ...options, apply: true });
  assert.deepEqual(accounts.a, {
    roles: ["administrator", "developer", "player"],
  });
  assert.deepEqual(accounts.c, { roles: ["player"] });
  assert.deepEqual(accounts.d, { developerBlocked: true, roles: ["tester"] });
  assert.deepEqual(accounts.b, { roles: ["tester"] });
  assert.deepEqual(accounts.e, { roles: ["player"] });
  // Running it again changes nothing.
  assert.deepEqual(await migrateRoles(users, { ...options, apply: true }), []);
});
