// One-time rename of the default nicknames an old counter handed out
// (Player10001, Player10002, …, kept in `counters/playerNames.next`) to each
// player's own default, "Player<public number>", so every player has one
// number. A player who has since chosen another name is left alone. When
// done, the counter is deleted: nothing uses it any more.
//
//   node scripts/rename-counter-defaults.mjs          # dry run: counts only
//   node scripts/rename-counter-defaults.mjs --apply  # writes
//
// Production runs it from the Website workflow (Run workflow, migration).
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";
import {
  defaultNickname,
  ensurePlayerNumber,
  nicknameKey,
} from "./game-api.mjs";

/** The first number the counter handed out. */
export const FIRST = 10001;

export async function rename(db, { apply = false, log = console.log } = {}) {
  const counterRef = db.collection("counters").doc("playerNames");
  const next = (await counterRef.get()).data()?.next ?? FIRST;
  const counts = { handedOut: Math.max(0, next - FIRST), renamed: 0, kept: 0 };
  for (let n = FIRST; n < next; n++) {
    const old = `Player${n}`;
    const oldKey = nicknameKey(old);
    const uid = (await db.collection("nicknames").doc(oldKey).get()).data()
      ?.uid;
    // Freed already: its player chose another name.
    if (!uid) {
      counts.kept += 1;
      continue;
    }
    const accountRef = db.collection("accounts").doc(uid);
    if ((await accountRef.get()).data()?.user_name !== old) {
      counts.kept += 1;
      continue;
    }
    counts.renamed += 1;
    if (!apply) continue;
    const number = await ensurePlayerNumber(db, uid);
    const name = defaultNickname(number);
    const key = nicknameKey(name);
    const playerRef = db.collection("players").doc(uid);
    await db.runTransaction(async (tx) => {
      const [account, held, player] = await Promise.all([
        tx.get(accountRef),
        tx.get(db.collection("nicknames").doc(key)),
        tx.get(playerRef),
      ]);
      // Changed since it was read, or the new name is somehow taken: skip.
      if (account.data()?.user_name !== old) return;
      if (held.exists && held.data()?.uid !== uid) return;
      tx.delete(db.collection("nicknames").doc(oldKey));
      tx.set(db.collection("nicknames").doc(key), { uid, name });
      tx.set(accountRef, { user_name: name, name_key: key }, { merge: true });
      if (player.exists) tx.set(playerRef, { name }, { merge: true });
    });
  }
  if (apply) await counterRef.delete();
  log(
    `${apply ? "Renamed" : "Would rename"} ${counts.renamed} of ${counts.handedOut} counted default nicknames` +
      ` (${counts.kept} since changed)` +
      (apply ? "; the counter is deleted" : ""),
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await rename(await firestore(), { apply: process.argv.includes("--apply") });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
