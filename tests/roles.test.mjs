// Roles on accounts (scripts/roles.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRole, rolesOf, withRole, withRoles } from "../scripts/roles.mjs";

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
