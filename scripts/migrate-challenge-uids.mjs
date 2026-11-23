// One-time tidy of saved challenges (scripts/challenges.mjs), now that a
// challenge keeps its players by uid alone and is made once. Challenges and
// results from before that hold the player's nickname, public number and
// avatar of the time, and the same score could be posted as a challenge
// again and again. This:
//   - finds the uid of any player kept without one, from the name kept:
//     a default name ("Player" or "Tester" and their public number) through
//     playerNumbers/{number}, otherwise through the nickname register
//     (nicknames/{key});
//   - drops the kept name, number and avatar from every challenge and result
//     whose player has a uid (a player whose uid can't be found keeps their
//     name, so nothing is lost);
//   - deletes (as a player would: kept, but shown nowhere) the repeats of an
//     open challenge that nobody else has played, keeping the one most
//     players took, or the first;
//   - writes each game's list of open challenges (challengeBoards) again from
//     its challenges.
// Running it twice changes nothing the second time.
//
//   node scripts/migrate-challenge-uids.mjs          # dry run: counts only
//   node scripts/migrate-challenge-uids.mjs --apply  # writes
import { pathToFileURL } from "node:url";
import { listed, resultsOf, sameRound } from "./challenges.mjs";
import { nicknameKey } from "./game-api.mjs";
import { getDoc, listDocs, updateDoc } from "./platform-store.mjs";

/** A default nickname: "Player" or "Tester" and the player's public number. */
const DEFAULT_NAME = /^(?:Player|Tester)([1-9]\d{9})$/;

/** The uid of the player who goes, or went, by `name`; null when unknown. */
export async function uidForName(name, read = getDoc) {
  if (typeof name !== "string" || !name.trim()) return null;
  const number = DEFAULT_NAME.exec(name.trim())?.[1];
  const byNumber = number ? await read("playerNumbers", number) : null;
  if (typeof byNumber?.uid === "string") return byNumber.uid;
  const held = await read("nicknames", nicknameKey(name));
  return typeof held?.uid === "string" ? held.uid : null;
}

/** The names a saved challenge keeps without a uid: its maker's and its results'. */
const namesWithoutUid = (doc) =>
  [doc, ...(Array.isArray(doc.results) ? doc.results : [])]
    .filter((p) => typeof p.uid !== "string" && typeof p.name === "string")
    .map((p) => p.name);

/**
 * A player as a challenge keeps them now: their uid (from `uids`, by the name
 * kept, when it was missing), and the name, number and avatar of the time
 * dropped once there is a uid. A name with no player is left as it is.
 */
function byUid(entry, uids) {
  const { name, number: _number, avatar: _avatar, ...rest } = entry;
  if (typeof entry.uid === "string") return rest;
  const uid = typeof name === "string" ? uids.get(name) : null;
  if (uid) return { ...rest, uid };
  // A guest's has no name to keep; a name nobody holds stays.
  return typeof name === "string" ? entry : rest;
}

/** A saved challenge with its players kept by uid. */
export function migrated(doc, uids = new Map()) {
  const next = byUid(doc, uids);
  return Array.isArray(doc.results)
    ? { ...next, results: doc.results.map((r) => byUid(r, uids)) }
    : next;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Of open challenges, the ids of the repeats to delete: the same player's
 * same round and score again, which nobody else has played. Of each set the
 * one most players took is kept, or the first made.
 */
export function repeats(challenges) {
  const open = challenges.filter(
    (c) => typeof c.uid === "string" && c.deleted !== true && c.closed !== true,
  );
  const kept = [];
  const gone = [];
  const players = (c) =>
    typeof c.players === "number" ? c.players : resultsOf(c).length;
  // The one to keep comes first: most players, then the earliest.
  open.sort(
    (a, b) =>
      players(b) - players(a) ||
      (String(a.createdAt) < String(b.createdAt) ? -1 : 1),
  );
  for (const c of open) {
    const twin = kept.find(
      (k) => k.uid === c.uid && k.game === c.game && sameRound(k, c),
    );
    if (twin && players(c) <= 1) gone.push(c.id);
    else kept.push(c);
  }
  return gone;
}

export async function migrate({
  apply = false,
  log = console.log,
  now = new Date().toISOString(),
} = {}) {
  const counts = {
    challenges: 0,
    changed: 0,
    found: 0,
    lost: 0,
    repeats: 0,
    lists: 0,
  };
  const all = await listDocs("challenges");
  // Every name kept without a uid, looked up once.
  const uids = new Map();
  for (const name of new Set(all.flatMap(namesWithoutUid))) {
    const uid = await uidForName(name);
    uids.set(name, uid);
    counts[uid ? "found" : "lost"] += 1;
  }
  const after = [];
  for (const { id, ...doc } of all) {
    counts.challenges += 1;
    const next = migrated(doc, uids);
    after.push({ id, ...next });
    if (same(next, doc)) continue;
    counts.changed += 1;
    // Changed inside the write, from the document as it is then, so a result
    // posted meanwhile is kept.
    if (apply)
      await updateDoc("challenges", id, (fresh) =>
        fresh ? migrated(fresh, uids) : next,
      );
  }
  const gone = new Set(repeats(after));
  counts.repeats = gone.size;
  if (apply)
    for (const id of gone)
      await updateDoc("challenges", id, (fresh) => ({
        ...fresh,
        deleted: true,
        deletedAt: fresh.deletedAt ?? now,
      }));
  // Each game's list again, from its challenges as they are now.
  const byId = new Map(after.map((c) => [c.id, c]));
  for (const { id: game, threads } of await listDocs("challengeBoards")) {
    const lines = (threads ?? []).flatMap((thread) => {
      const doc = byId.get(thread.id);
      // A line whose challenge is gone, closed or a repeat leaves the list.
      return doc && !gone.has(thread.id) && !doc.deleted && !doc.closed
        ? [listed(thread.id, doc)]
        : [];
    });
    if (same(lines, threads ?? [])) continue;
    counts.lists += 1;
    if (apply)
      await updateDoc("challengeBoards", game, () => ({ threads: lines }));
  }
  log(
    `${apply ? "Moved" : "Would move"} ${counts.changed} of ${counts.challenges} challenges to uids ` +
      `(${counts.found} names matched to a player, ${counts.lost} not), ` +
      `${apply ? "deleted" : "would delete"} ${counts.repeats} repeats and ` +
      `${apply ? "rewrote" : "would rewrite"} ${counts.lists} lists`,
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await migrate({ apply: process.argv.includes("--apply") });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
