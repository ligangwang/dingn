// Test accounts: real dingn accounts for testing, made by an admin on the
// Users page without the sign-up form or an inbox.
//
// Each one is an email-and-password account whose address is marked as
// confirmed when it is made, so Firebase sends no activation email and it can
// sign in on /signin/ at once. It carries the `tester: true` claim, which
// keeps it out of what real players see and earn: it is never on the
// leaderboard (scripts/game-api.mjs) and never brings a friend for referral
// coins (scripts/referrals.mjs). Everything else works as for a player.
//
// Firebase allows one password account per address, so several test accounts
// need several addresses: made with a count, `you+qa@gmail.com` becomes
// you+qa1@gmail.com, you+qa2@gmail.com, … which Gmail and most mail services
// deliver to one inbox. Nothing is ever emailed to them by this page.
//
// Only test accounts can be changed or deleted here, never anyone else's.
//
//   POST /api/admin/testers                         → { testers }
//   POST /api/admin/testers/update
//     { action: "create", email, count?, name?, password? }
//                                                   → { testers, password }
//     { action: "password", uid, password? }        → { tester, password }
//     { action: "delete", uid }                     → { uid }
//
// A password left out is made up here and returned once, for the admin to
// copy; dingn keeps no copy of it and never logs it. Only signed-in admins on
// the website reach this (scripts/games-admin.mjs), never a review key, and
// replies are never cached.
import { randomBytes } from "node:crypto";
import { ApiError } from "./api.mjs";

/** The most test accounts one request may make. */
export const MAX_TESTERS = 20;
/** A password's length limits, as on the sign-up form. */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const MAX_NAME = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isTester = (user) => user?.customClaims?.tester === true;

const dateOrNull = (value) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

/** What the Users page shows for a test account. */
export const tester = (user) => ({
  uid: user.uid,
  email: user.email ?? "",
  name: user.displayName ?? "",
  disabled: user.disabled === true,
  admin: user.customClaims?.admin === true,
  createdAt: dateOrNull(user.metadata?.creationTime),
  lastActive: dateOrNull(
    user.metadata?.lastRefreshTime ?? user.metadata?.lastSignInTime,
  ),
});

/** A new password: 16 letters, digits, `-` and `_`. */
export const newPassword = () => randomBytes(12).toString("base64url");

/**
 * The addresses for `count` test accounts from one: the address itself for
 * one, else a number after its name (qa@x.com → qa1@x.com, qa2@x.com, …).
 */
export function testerEmails(email, count = 1) {
  if (count === 1) return [email];
  const at = email.lastIndexOf("@");
  return Array.from(
    { length: count },
    (_, i) => `${email.slice(0, at)}${i + 1}${email.slice(at)}`,
  );
}

/** The password asked for, or a new one. Throws ApiError. */
function passwordOf(value) {
  if (value === undefined || value === null || value === "")
    return newPassword();
  if (
    typeof value !== "string" ||
    value.length < MIN_PASSWORD ||
    value.length > MAX_PASSWORD
  )
    throw new ApiError(400, "weak-password");
  return value;
}

/** The test account `uid`; never anyone else's. Throws ApiError. */
async function testerById(users, uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128)
    throw new ApiError(400, "invalid-request");
  let user;
  try {
    user = await users.getUser(uid);
  } catch {
    throw new ApiError(404, "user-not-found");
  }
  if (!isTester(user)) throw new ApiError(403, "not-a-tester");
  return user;
}

/** Every test account, by email. */
export async function listTesters(users) {
  const list = [];
  let pageToken;
  do {
    const page = await users.listUsers(1000, pageToken);
    for (const user of page.users) if (isTester(user)) list.push(tester(user));
    pageToken = page.pageToken;
  } while (pageToken);
  return list.sort((a, b) => a.email.localeCompare(b.email));
}

/** Makes test accounts. Throws ApiError, before making any, for a bad request. */
async function createTesters(users, body, by) {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const count = body.count ?? 1;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (
    !EMAIL.test(email) ||
    email.length > 254 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_TESTERS ||
    name.length > MAX_NAME
  )
    throw new ApiError(400, "invalid-request");
  const password = passwordOf(body.password);
  const emails = testerEmails(email, count);
  // Every address must be free: a test account never takes over a real one.
  const { users: taken } = await users.getUsers(
    emails.map((e) => ({ email: e })),
  );
  if (taken.length) throw new ApiError(400, "email-already-in-use");
  const made = [];
  for (const [i, address] of emails.entries()) {
    const user = await users.createUser({
      email: address,
      password,
      emailVerified: true,
      ...(name ? { displayName: count > 1 ? `${name} ${i + 1}` : name } : {}),
    });
    try {
      await users.setCustomUserClaims(user.uid, { tester: true });
    } catch (error) {
      // Never leave an ordinary account this page can't see or remove.
      await users
        .deleteUser(user.uid)
        .catch((e) =>
          console.error("test account", "undo create", user.uid, e),
        );
      throw error;
    }
    made.push(tester({ ...user, customClaims: { tester: true } }));
    console.log("test account", "create", user.uid, "by", by);
  }
  return { testers: made, password };
}

/** The admin API for test accounts (see the top of this file). */
export async function testers(pathname, body, users, by) {
  if (pathname === "/api/admin/testers")
    return { testers: await listTesters(users) };
  if (body.action === "create") return createTesters(users, body, by);
  if (body.action === "password") {
    const user = await testerById(users, body.uid);
    const password = passwordOf(body.password);
    await users.updateUser(user.uid, { password });
    // Whoever had the old password is signed out everywhere.
    await users.revokeRefreshTokens(user.uid);
    console.log("test account", "password", user.uid, "by", by);
    return { tester: tester(user), password };
  }
  if (body.action === "delete") {
    const user = await testerById(users, body.uid);
    // A test account made an admin can't delete itself, as admins can't
    // remove their own access (so dingn always keeps an admin).
    if (user.uid === by) throw new ApiError(400, "cannot-remove-self");
    await users.deleteUser(user.uid);
    console.log("test account", "delete", user.uid, "by", by);
    return { uid: user.uid };
  }
  throw new ApiError(400, "invalid-request");
}
