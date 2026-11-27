// Deletes a game's old versions from dingn for good: every published version
// older than its live one (but never its beta). A newer upload still waiting
// for review is left alone.
// Their files leave the games bucket (`games/<id>/<version>/`) and their
// entries leave the registry record (`games/{id}.versions`), so a link that
// pins one (`?v=1.2.0`) stops working. The record keeps their numbers in
// `pruned`, and a pruned number can never be published again
// (addVersion in scripts/game-registry.mjs): a version still never changes.
//
// Use it when old versions hold something that must go, such as files whose
// licence the game no longer follows. A rollback to a pruned version is no
// longer possible.
//
//   node scripts/prune-game-versions.mjs <id>          # dry run: shows what would go
//   node scripts/prune-game-versions.mjs <id> --apply  # deletes
//
// Production runs it from the Website workflow (Run workflow: the game's id
// and migration prune-game-versions-dry-run or prune-game-versions).
import { pathToFileURL } from "node:url";
import {
  bucket,
  compareVersions,
  firestore,
  ID,
  VERSION,
} from "./game-registry.mjs";

/** The versions of a record that would go: those older than its live one, but never its beta. */
export function prunable(record) {
  const live = record?.live;
  if (!live || !VERSION.test(live)) return [];
  return Object.keys(record?.versions ?? {})
    .filter(
      (version) =>
        VERSION.test(version) &&
        version !== record.beta &&
        compareVersions(version, live) < 0,
    )
    .sort(compareVersions);
}

/** Why a game's versions can't be pruned, or null when they can. */
export function refusal(id, record) {
  if (!ID.test(id ?? "")) return "not a game id";
  if (!record) return "no such game";
  // Without a live version there is nothing safe to keep.
  if (!record.live || !record.versions?.[record.live])
    return "it has no live version to keep";
  return null;
}

/** The record without `gone`, their numbers kept in `pruned`. */
export function pruned(record, gone, now = new Date().toISOString()) {
  const versions = { ...record.versions };
  for (const version of gone) delete versions[version];
  return {
    ...record,
    versions,
    pruned: [...new Set([...(record.pruned ?? []), ...gone])].sort(
      compareVersions,
    ),
    updatedAt: now,
  };
}

/**
 * Versions already taken out of the record whose files may still be in the
 * bucket: a run that stopped after the registry changed, before every file
 * was deleted. The next run finishes them.
 */
export const leftovers = (record) =>
  (record?.pruned ?? []).filter(
    (version) => VERSION.test(version) && !record.versions?.[version],
  );

export async function pruneGameVersions(
  id,
  { db, files, apply = false, log = console.log },
) {
  const ref = db.collection("games").doc(id);
  const snap = await ref.get();
  const record = snap.exists ? snap.data() : null;
  const problem = refusal(id, record);
  if (problem) throw new Error(`Can't prune ${id}: ${problem}.`);
  const gone = prunable(record);
  const kept = Object.keys(record.versions)
    .filter((version) => !gone.includes(version))
    .sort(compareVersions)
    .join(", ");
  const filesOf = async (version) =>
    (await files.getFiles({ prefix: `games/${id}/${version}/` }))[0].length;
  let count = 0;
  for (const version of gone) {
    const n = await filesOf(version);
    count += n;
    log(`  ${version}: ${n} files`);
  }
  // Files an earlier, interrupted run left behind.
  const unfinished = [];
  for (const version of leftovers(record)) {
    const n = await filesOf(version);
    if (!n) continue;
    unfinished.push(version);
    count += n;
    log(`  ${version}: ${n} files left from an earlier run`);
  }
  log(
    `${apply ? "Deleting" : "Would delete"} ${gone.length} old versions of ${id} (${count} files), keeping ${kept}.`,
  );
  const result = { versions: gone, unfinished, files: count };
  if (!apply || (!gone.length && !unfinished.length)) return result;
  // The registry first: a version no page can ask for, then its files. If
  // the files' deletion stops part way, the versions stay in `pruned` and
  // the next run deletes what is left.
  if (gone.length)
    await db.runTransaction(async (tx) => {
      const now = (await tx.get(ref)).data();
      // Only versions still older than live and not beta, should a release
      // or a rollback have moved a channel meanwhile.
      const still = prunable(now).filter((version) => gone.includes(version));
      tx.set(ref, pruned(now, still));
    });
  const after = (await ref.get()).data();
  // (Only what this run listed, and only what the record no longer has.)
  const listed = new Set([...gone, ...unfinished]);
  for (const version of leftovers(after))
    if (listed.has(version))
      await files.deleteFiles({ prefix: `games/${id}/${version}/` });
  log(`Deleted. ${id} now has: ${Object.keys(after.versions).join(", ")}.`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { getStorage } = await import("firebase-admin/storage");
  const { getApps } = await import("firebase-admin/app");
  const db = await firestore();
  const app = getApps().find((a) => a.name === "dingn-games");
  await pruneGameVersions(process.argv[2], {
    db,
    files: getStorage(app).bucket(bucket()),
    apply: process.argv.includes("--apply"),
  });
  process.exit(0);
}
