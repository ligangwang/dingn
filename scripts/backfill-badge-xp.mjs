// One-time payment of account XP for badges earned before badges gave XP.
// Walks every rewards document and pays what it owes (badgeXpOwed in
// rewards.mjs) into players/{uid}, in one transaction each. `xpPaid` records
// what was paid, so running it twice pays nothing the second time, and a
// badge earned meanwhile is never paid twice.
//
//   node scripts/backfill-badge-xp.mjs          # dry run: counts only
//   node scripts/backfill-badge-xp.mjs --apply  # writes
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";
import { badgeXpOwed, settleBadgeXp } from "./rewards.mjs";

const PAGE = 300;

export async function backfill(
  db,
  { apply = false, settle = settleBadgeXp, log = console.log } = {},
) {
  const counts = { players: 0, owed: 0, xp: 0 };
  let last = null;
  for (;;) {
    let query = db.collection("rewards").orderBy("__name__").limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    for (const snap of page.docs) {
      counts.players += 1;
      const owed = badgeXpOwed(snap.data());
      if (!owed) continue;
      counts.owed += 1;
      // Settling reads the document again inside its transaction, so it
      // pays what is owed then, not what this page saw.
      counts.xp += apply ? await settle(snap.id) : owed;
    }
    last = page.docs.at(-1);
  }
  log(
    `${apply ? "Paid" : "Would pay"} ${counts.xp} XP to ${counts.owed} of ${counts.players} players`,
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await backfill(await firestore(), {
    apply: process.argv.includes("--apply"),
  });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
