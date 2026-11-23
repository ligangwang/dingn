// One-time tidy of saved challenges (scripts/challenges.mjs), now that a
// challenge keeps its players by uid alone and a level has one challenge.
// Challenges and results from before that hold the player's nickname, public
// number and avatar of the time, and one level could have many challenges.
// This:
//   - finds the uid of any player kept without one, from the name kept:
//     a default name ("Player" or "Tester" and their public number) through
//     playerNumbers/{number}, otherwise through the nickname register
//     (nicknames/{key});
//   - drops the kept name, number and avatar from every challenge and result
//     whose player has a uid (a player whose uid can't be found keeps their
//     name, so nothing is lost);
//   - merges the open challenges of one level (a game's round under its
//     rules) into the first one made, whose maker owns the level's
//     challenge: every player keeps their best score under it, and the
//     others are deleted as a player would delete them (kept, but shown
//     nowhere) with `mergedInto` naming the one they went into, so their
//     links still open it;
//   - names each level's challenge (challengeRounds) and writes each game's
//     list of open challenges (challengeBoards) again.
// Running it twice changes nothing the second time.
//
//   node scripts/migrate-challenge-uids.mjs          # dry run: counts only
//   node scripts/migrate-challenge-uids.mjs --apply  # writes
import { pathToFileURL } from "node:url";
import {
  MAX_RESULTS,
  byScore,
  listed,
  resultsOf,
  roundKey,
} from "./challenges.mjs";
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
 * The open challenges that share a level, merged: for each level with a
 * signed-in player's listed challenge, `keep` is the first one made, with
 * everyone's best score under it, `gone` the ids of the others, and `bests`
 * each player's best ({ uid, score, at }).
 */
export function merged(challenges) {
  const levels = new Map();
  for (const c of challenges) {
    // Only challenges that share their level: a signed-in player's, open.
    if (typeof c.uid !== "string" || c.public !== true) continue;
    if (c.deleted === true || c.closed === true) continue;
    const key = roundKey(c.game, c);
    levels.set(key, [...(levels.get(key) ?? []), c]);
  }
  return [...levels].map(([key, group]) => {
    // The first one made owns the level.
    const [first, ...rest] = [...group].sort((a, b) =>
      String(a.createdAt) < String(b.createdAt) ? -1 : 1,
    );
    const best = new Map();
    const unnamed = [];
    for (const c of [first, ...rest])
      for (const r of resultsOf(c)) {
        if (typeof r.uid !== "string") unnamed.push(r);
        else if (byScore(r, best.get(r.uid) ?? { score: -1, at: "" }) < 0)
          best.set(r.uid, r);
      }
    const everyone = [...best.values(), ...unnamed].sort(byScore);
    return {
      key,
      keep: {
        ...first,
        results: everyone.slice(0, MAX_RESULTS),
        players: everyone.length,
      },
      gone: rest.map((c) => c.id),
      bests: [...best.values()],
    };
  });
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
    levels: 0,
    merged: 0,
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
  const after = new Map();
  for (const { id, ...doc } of all) {
    counts.challenges += 1;
    const next = migrated(doc, uids);
    after.set(id, { id, ...next });
    if (same(next, doc)) continue;
    counts.changed += 1;
    // Changed inside the write, from the document as it is then, so a result
    // posted meanwhile is kept.
    if (apply)
      await updateDoc("challenges", id, (fresh) =>
        fresh ? migrated(fresh, uids) : next,
      );
  }
  // One challenge for each level.
  for (const { key, keep, gone, bests } of merged([...after.values()])) {
    counts.levels += 1;
    counts.merged += gone.length;
    const { id, ...kept } = keep;
    const named = await getDoc("challengeRounds", key);
    if (!gone.length && named?.id === id) continue;
    after.set(id, keep);
    for (const other of gone)
      after.set(other, { ...after.get(other), deleted: true });
    if (!apply) continue;
    if (gone.length) {
      await updateDoc("challenges", id, (fresh) => ({
        ...fresh,
        results: kept.results,
        players: kept.players,
      }));
      for (const best of bests)
        await updateDoc("challengeResults", `${id}_${best.uid}`, () => ({
          challenge: id,
          uid: best.uid,
          score: best.score,
          at: best.at,
        }));
      for (const other of gone)
        await updateDoc("challenges", other, (fresh) => ({
          ...fresh,
          deleted: true,
          deletedAt: fresh.deletedAt ?? now,
          mergedInto: id,
        }));
    }
    await updateDoc("challengeRounds", key, () => ({ id }));
  }
  // Each game's list again, from its challenges as they are now.
  for (const { id: game, threads } of await listDocs("challengeBoards")) {
    const lines = (threads ?? []).flatMap((thread) => {
      const doc = after.get(thread.id);
      // A line whose challenge is gone, closed or merged leaves the list.
      return doc && !doc.deleted && !doc.closed ? [listed(thread.id, doc)] : [];
    });
    if (same(lines, threads ?? [])) continue;
    counts.lists += 1;
    if (apply)
      await updateDoc("challengeBoards", game, () => ({ threads: lines }));
  }
  log(
    `${apply ? "Moved" : "Would move"} ${counts.changed} of ${counts.challenges} challenges to uids ` +
      `(${counts.found} names matched to a player, ${counts.lost} not), ` +
      `${apply ? "merged" : "would merge"} ${counts.merged} challenges into the ${counts.levels} levels' own and ` +
      `${apply ? "rewrote" : "would rewrite"} ${counts.lists} lists`,
  );
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await migrate({ apply: process.argv.includes("--apply") });
  // The Admin SDK keeps its connection open; the work is done.
  process.exit(0);
}
