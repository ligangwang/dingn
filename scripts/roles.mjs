// Roles: what an account may do on dingn, kept as the `roles` custom claim on
// its Firebase account (so they ride in its ID token and Firestore rules can
// read them):
//
//   admin      runs dingn: the admin pages, any account's access, reviews
//   developer  uploads games on /developers/games/ and makes upload keys
//   tester     a test account an admin made (scripts/test-accounts.mjs):
//              kept off the leaderboard, statistics and referrals
//
// An account holds any number of them, or none (a player). Read and change
// them only through this file. `developerBlocked` is not a role but a
// restriction: a developer an admin removed can't sign up again by itself.
//
// Accounts made before roles carry `admin: true`, `developer: true` or
// `tester: true` instead. Those still count until scripts/migrate-roles.mjs
// has moved every account to `roles`; any change made here moves the account.

export const ROLES = ["admin", "developer", "tester"];
const LEGACY = new Set(ROLES);

/** The account's roles, in ROLES order, from its claims (or decoded ID token). */
export function rolesOf(claims) {
  const held = new Set(
    Array.isArray(claims?.roles)
      ? claims.roles.filter((role) => LEGACY.has(role))
      : [],
  );
  for (const role of ROLES) if (claims?.[role] === true) held.add(role);
  return ROLES.filter((role) => held.has(role));
}

/** Whether the account holds `role`. */
export const hasRole = (claims, role) => rolesOf(claims).includes(role);

/**
 * The account's claims with `role` given (`on`) or taken away, and every
 * role in the `roles` list: other claims are kept, old role flags dropped.
 */
export function withRole(claims, role, on = true) {
  if (!LEGACY.has(role)) throw new Error(`unknown role: ${role}`);
  const held = new Set(rolesOf(claims));
  if (on) held.add(role);
  else held.delete(role);
  return withRoles(
    claims,
    ROLES.filter((r) => held.has(r)),
  );
}

/** The account's claims holding exactly `roles`; other claims are kept. */
export function withRoles(claims, roles) {
  const rest = { ...(claims ?? {}) };
  for (const role of ROLES) delete rest[role];
  delete rest.roles;
  const list = ROLES.filter((role) => roles.includes(role));
  return list.length ? { ...rest, roles: list } : rest;
}
