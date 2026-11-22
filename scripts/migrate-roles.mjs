#!/usr/bin/env node
// One-time move of every dingn account to roles (scripts/roles.mjs): the old
// `admin: true`, `developer: true` and `tester: true` claims become one
// `roles` list, keeping every other claim (such as `developerBlocked`).
//
// Run it with Firebase Authentication admin rights, as for set-admin.py: in
// Cloud Shell as the project owner (or after `gcloud auth application-default
// login`), from the repository folder after `npm ci`:
//
//   node scripts/migrate-roles.mjs           # dry run: what would change
//   node scripts/migrate-roles.mjs --apply   # change the accounts
//
// It is safe to run again: an account already on roles is left as it is.
// The website accepts both forms meanwhile, so nobody loses access while it
// runs. Changed claims reach an account's ID token within the hour.
import { pathToFileURL } from "node:url";
import { rolesOf, withRoles } from "./roles.mjs";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";
const LEGACY = ["admin", "developer", "tester"];

/** The account's claims on roles, or null when they need no change. */
export function migratedClaims(claims) {
  if (!claims || !LEGACY.some((role) => role in claims)) return null;
  return withRoles(claims, rolesOf(claims));
}

/**
 * Moves every account (`users` is the Admin SDK's auth) and returns what it
 * changed, as { uid, email, roles } for each; with `apply` false it only
 * reports.
 */
export async function migrateRoles(users, { apply = false } = {}) {
  const changed = [];
  let pageToken;
  do {
    const page = await users.listUsers(1000, pageToken);
    for (const user of page.users) {
      const next = migratedClaims(user.customClaims);
      if (!next) continue;
      if (apply) await users.setCustomUserClaims(user.uid, next);
      changed.push({
        uid: user.uid,
        email: user.email ?? "",
        roles: next.roles ?? [],
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return changed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const apply = process.argv.includes("--apply");
  const { initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const users = getAuth(initializeApp({ projectId: PROJECT }));
  const changed = await migrateRoles(users, { apply });
  for (const c of changed)
    console.log(`${c.email || c.uid}: roles ${c.roles.join(", ") || "(none)"}`);
  console.log(
    `${changed.length} account(s) ${apply ? "moved to roles" : "would move to roles (dry run; add --apply)"}.`,
  );
}
