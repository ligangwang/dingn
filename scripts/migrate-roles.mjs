#!/usr/bin/env node
// Moves every dingn account to a full list of roles (scripts/roles.mjs):
// the old `admin: true`, `developer: true` and `tester: true` claims become
// one `roles` list, every account but a test account gets the player role,
// and every other claim (such as `developerBlocked`) is kept.
//
// Run it with Firebase Authentication admin rights, as for set-admin.py: in
// Cloud Shell as the project owner (or after `gcloud auth application-default
// login`), from the repository folder after `npm ci`:
//
//   node scripts/migrate-roles.mjs --drop-flags            # dry run
//   node scripts/migrate-roles.mjs --apply --drop-flags    # change accounts
//
// --drop-flags removes the old flags; leave it out to keep them beside the
// list, which only matters while a website from before 2.3.0 still runs.
// Safe to run again: an account already done is left as it is. Changed
// claims reach an account's ID token within the hour.
import { pathToFileURL } from "node:url";
import { migratedClaims } from "./roles.mjs";

export { migratedClaims };
const PROJECT = process.env.FIREBASE_PROJECT_ID || "dingn-193716";

/**
 * Moves every account (`users` is the Admin SDK's auth) and returns what it
 * changed, as { uid, email, roles } for each; with `apply` false it only
 * reports.
 */
export async function migrateRoles(
  users,
  { apply = false, dropFlags = false } = {},
) {
  const changed = [];
  let pageToken;
  do {
    const page = await users.listUsers(1000, pageToken);
    for (const user of page.users) {
      const next = migratedClaims(user.customClaims, { dropFlags });
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
  const dropFlags = process.argv.includes("--drop-flags");
  const { initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const users = getAuth(initializeApp({ projectId: PROJECT }));
  const changed = await migrateRoles(users, { apply, dropFlags });
  for (const c of changed)
    console.log(`${c.email || c.uid}: roles ${c.roles.join(", ") || "(none)"}`);
  const what = dropFlags ? "old flags removed" : "roles added, old flags kept";
  console.log(
    apply
      ? `${changed.length} account(s) changed: ${what}.`
      : `${changed.length} account(s) would change (${what}). Dry run: add --apply.`,
  );
}
