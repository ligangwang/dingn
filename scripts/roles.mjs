// Roles: what an account may do on dingn.
//
//   administrator  runs dingn: the admin pages, any account's access, reviews
//   developer      uploads games on /developers/games/ and makes upload keys
//   player         a real person playing
//   tester         a test account an administrator made
//                  (scripts/test-accounts.mjs): kept off the leaderboard,
//                  statistics and referrals; never a player
//
// An account's roles are the `roles` list in its Firebase custom claims (so
// they ride in its ID token and Firestore rules can read them), and that list
// is exactly what it holds: an administrator who plays is
// ["administrator", "player"]. An account with no list yet (a new sign-up,
// whose roles were never changed) is a player, or a tester if an old flag
// says so; its list is written the first time its roles change. Read and
// change roles only through this file. `developerBlocked` is not a role but a
// restriction: a developer an administrator removed can't sign up again by
// itself.
//
// Accounts made before roles carry `admin: true`, `developer: true` or
// `tester: true` instead. Those still count until scripts/migrate-roles.mjs
// has moved every account to a full `roles` list; any change made here moves
// the account.

export const ROLES = ["administrator", "developer", "player", "tester"];
/** The flags accounts carried before roles, and the role each one is. */
export const LEGACY_FLAGS = {
  admin: "administrator",
  developer: "developer",
  tester: "tester",
};

/** The account's roles, in ROLES order, from its claims (or decoded ID token). */
export function rolesOf(claims) {
  const listed = Array.isArray(claims?.roles);
  const held = new Set(
    listed ? claims.roles.filter((role) => ROLES.includes(role)) : [],
  );
  for (const [flag, role] of Object.entries(LEGACY_FLAGS))
    if (claims?.[flag] === true) held.add(role);
  // No list yet: a player, unless it is a test account.
  if (!listed) held.add("player");
  return onlyRoles([...held]);
}

/** Whether the account holds `role`. */
export const hasRole = (claims, role) => rolesOf(claims).includes(role);

/**
 * The account's claims with `role` given (`on`) or taken away, its whole list
 * of roles written out: other claims are kept, old flags dropped.
 */
export function withRole(claims, role, on = true) {
  if (!ROLES.includes(role)) throw new Error(`unknown role: ${role}`);
  const held = new Set(rolesOf(claims));
  if (on) held.add(role);
  else held.delete(role);
  return withRoles(claims, [...held]);
}

/**
 * The known roles of `roles`, in ROLES order. A tester is never a player:
 * with both, tester wins.
 */
function onlyRoles(roles) {
  const tester = roles.includes("tester");
  return ROLES.filter(
    (role) => roles.includes(role) && !(tester && role === "player"),
  );
}

/**
 * The account's claims holding exactly `roles` (a tester never a player);
 * other claims are kept.
 */
export function withRoles(claims, roles) {
  const rest = { ...(claims ?? {}) };
  for (const flag of Object.keys(LEGACY_FLAGS)) delete rest[flag];
  delete rest.roles;
  return { ...rest, roles: onlyRoles(roles) };
}

/**
 * The account's claims moved to a full list of roles, or null when they need
 * no change. Every account that isn't a test account gets the player role.
 * With `dropFlags` false (safe while websites from before roles still run)
 * the old flags are kept beside the list; with it true they are removed.
 */
export function migratedClaims(claims, { dropFlags = false } = {}) {
  const held = new Set(rolesOf(claims));
  if (!held.has("tester")) held.add("player");
  const roles = ROLES.filter((role) => held.has(role));
  const stored = Array.isArray(claims?.roles) ? claims.roles : null;
  const listed =
    stored !== null &&
    stored.length === roles.length &&
    roles.every((role) => stored.includes(role));
  const flags = Object.keys(LEGACY_FLAGS).some(
    (flag) => flag in (claims ?? {}),
  );
  if (dropFlags) return listed && !flags ? null : withRoles(claims, roles);
  return listed ? null : { ...(claims ?? {}), roles };
}
