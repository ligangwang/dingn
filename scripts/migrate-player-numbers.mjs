// One-time backfill of public player numbers (/player/<number>/). New
// players get theirs on their first visit (ensurePlayerNumber in
// scripts/game-api.mjs); this gives one to every existing player now, so
// links to them work before they come back. It walks every account, every
// player with XP (a player may have XP before they saved a profile) and every
// Firebase sign-in account (someone who signed in once but never played or
// saved anything has neither), and gives a number to each that has none. A
// player who already has one keeps it, so running it twice changes nothing
// the second time.
//
//   node scripts/migrate-player-numbers.mjs          # dry run: counts only
//   node scripts/migrate-player-numbers.mjs --apply  # writes
//
// Production runs it from the Website workflow (Run workflow, migration).
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";
import { ensurePlayerNumber, isPlayerNumber } from "./game-api.mjs";
import { firebaseAuth } from "./games-admin.mjs";

const PAGE = 300;

/** Every document id in a collection, page by page. */
async function* idsIn(db, collection) {
  let last = null;
  for (;;) {
    let query = db.collection(collection).orderBy("__name__").limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) return;
    for (const snap of page.docs) yield snap;
    last = page.docs.at(-1);
  }
}

export async function migrate(
  db,
  {
    apply = false,
    log = console.log,
    ensure = ensurePlayerNumber,
    users = null,
  } = {},
) {
  const counts = { players: 0, had: 0, given: 0 };
  const seen = new Set();
  const visit = async (uid, known) => {
    if (seen.has(uid)) return;
    seen.add(uid);
    counts.players += 1;
    if (isPlayerNumber(known)) {
      counts.had += 1;
      return;
    }
    if (apply) await ensure(db, uid);
    counts.given += 1;
  };
  for await (const snap of idsIn(db, "accounts"))
    await visit(snap.id, snap.data()?.player_no);
  // Players with XP but no account yet: ensurePlayerNumber reads the
  // account itself, so `known` is left to it.
  for await (const snap of idsIn(db, "players")) {
    if (seen.has(snap.id)) continue;
    const account = await db.collection("accounts").doc(snap.id).get();
    await visit(snap.id, account.data()?.player_no);
  }
  // Everyone who has signed in, page by page: those with no Firestore
  // record at all.
  if (users) {
    let pageToken;
    do {
      const page = await users.listUsers(1000, pageToken);
      for (const user of page.users) {
        if (seen.has(user.uid)) continue;
        const account = await db.collection("accounts").doc(user.uid).get();
        await visit(user.uid, account.data()?.player_no);
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }
  log(
    `${apply ? "Gave" : "Would give"} ${counts.given} of ${counts.players} players a public number` +
      ` (${counts.had} had one)`,
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await migrate(await firestore(), {
    apply: process.argv.includes("--apply"),
    users: await firebaseAuth(),
  });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
