// One-time move of signed-in players' Crowd Rush progress from the old `crowd`
// game to `crowdrush`, in Firestore `accounts/{uid}`. For each account that
// has no crowdrush progress yet, it copies `game_progress_crowd`, or the
// pre-platform `crowd_level` and `crowd_best`, into `game_progress_crowdrush`.
// Old fields are kept as a backup. A save crowdrush made itself is never
// overwritten, and running it twice changes nothing the second time.
//
//   node scripts/migrate-crowd-progress.mjs          # dry run: counts only
//   node scripts/migrate-crowd-progress.mjs --apply  # writes
//
// Production runs it from the Website workflow (Run workflow, migration).
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";

export const FROM = "game_progress_crowd";
export const TO = "game_progress_crowdrush";
const PAGE = 300;

/** The crowdrush progress to write for one account, or null for none. */
export function crowdrushProgress(account) {
  if (!account || typeof account[TO] === "string") return null;
  if (typeof account[FROM] === "string") return account[FROM];
  if (account.crowd_level != null)
    return JSON.stringify({
      level: account.crowd_level,
      best: account.crowd_best ?? 0,
    });
  return null;
}

/**
 * Walks every account, page by page. Each write only applies if the account
 * has not changed since it was read, so a player saving at that moment wins.
 */
export async function migrate(db, { apply = false, log = console.log } = {}) {
  const counts = { accounts: 0, migrate: 0, written: 0, changed: 0 };
  let last = null;
  for (;;) {
    let query = db.collection("accounts").orderBy("__name__").limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    for (const snap of page.docs) {
      counts.accounts += 1;
      const value = crowdrushProgress(snap.data());
      if (value == null) continue;
      counts.migrate += 1;
      if (!apply) continue;
      try {
        await snap.ref.update(
          { [TO]: value },
          { lastUpdateTime: snap.updateTime },
        );
        counts.written += 1;
      } catch {
        // Changed since it was read: it is picked up by the next run.
        counts.changed += 1;
      }
    }
    last = page.docs.at(-1);
  }
  log(
    `${apply ? "Migrated" : "Would migrate"} ${counts.migrate} of ${counts.accounts} accounts` +
      (apply
        ? ` (${counts.written} written, ${counts.changed} changed meanwhile)`
        : ""),
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await migrate(await firestore(), {
    apply: process.argv.includes("--apply"),
  });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
