// Roles: what an account may do on dingn.
//
//   administrator  runs dingn: the admin pages, any account's access, reviews
//   developer      uploads games on /developers/games/ and makes upload keys
//   player         a real person playing: every account that isn't a tester
//   tester         a test account an administrator made
//                  (scripts/test-accounts.mjs): kept off the leaderboard,
//                  statistics and referrals
//
// administrator, developer and tester are granted, and kept as the `roles`
// custom claim on the account's Firebase account (so they ride in its ID
// token and Firestore rules can read them). player is never stored: every
// account holds it unless it is a tester. An account holds any number of
// roles; an administrator or developer is a player too. Read and change them
// only through this file. `developerBlocked` is not a role but a restriction:
// a developer an administrator removed can't sign up again by itself.
//
// Accounts made before roles carry `admin: true`, `developer: true` or
// `tester: true` instead. Those still count until scripts/migrate-roles.mjs
// has moved every account to `roles`; any change made here moves the account.

export const ROLES = ["administrator", "developer", "player", "tester"];
/** The roles kept on the account; player follows from not being a tester. */
export const GRANTED = ["administrator", "developer", "tester"];
/** The flags accounts carried before roles, and the role each one is. */
export const LEGACY_FLAGS = {
  admin: "administrator",
  developer: "developer",
  tester: "tester",
};

/** The account's granted roles, in ROLES order, from its claims. */
function grantedOf(claims) {
  const held = new Set(
    Array.isArray(claims?.roles)
      ? claims.roles.filter((role) => GRANTED.includes(role))
      : [],
  );
  for (const [flag, role] of Object.entries(LEGACY_FLAGS))
    if (claims?.[flag] === true) held.add(role);
  return GRANTED.filter((role) => held.has(role));
}

/** The account's roles, in ROLES order, from its claims (or decoded ID token). */
export function rolesOf(claims) {
  const held = grantedOf(claims);
  if (!held.includes("tester")) held.push("player");
  return ROLES.filter((role) => held.includes(role));
}

/** Whether the account holds `role`. */
export const hasRole = (claims, role) => rolesOf(claims).includes(role);

/**
 * The account's claims with `role` granted (`on`) or taken away, and every
 * granted role in the `roles` list: other claims are kept, old flags dropped.
 * player can't be granted: it follows from not being a tester.
 */
export function withRole(claims, role, on = true) {
  if (!GRANTED.includes(role)) throw new Error(`not a granted role: ${role}`);
  const held = new Set(grantedOf(claims));
  if (on) held.add(role);
  else held.delete(role);
  return withRoles(claims, [...held]);
}

/** The account's claims granting exactly `roles`; other claims are kept. */
export function withRoles(claims, roles) {
  const rest = { ...(claims ?? {}) };
  for (const flag of Object.keys(LEGACY_FLAGS)) delete rest[flag];
  delete rest.roles;
  const list = GRANTED.filter((role) => roles.includes(role));
  return list.length ? { ...rest, roles: list } : rest;
}

/** The account's claims on roles, or null when they need no change. */
export function migratedClaims(claims) {
  if (!claims || !Object.keys(LEGACY_FLAGS).some((flag) => flag in claims))
    return null;
  return withRoles(claims, grantedOf(claims));
}
