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
  let count = 0;
  for (const version of gone) {
    const [objects] = await files.getFiles({
      prefix: `games/${id}/${version}/`,
    });
    count += objects.length;
    log(`  ${version}: ${objects.length} files`);
  }
  log(
    `${apply ? "Deleting" : "Would delete"} ${gone.length} old versions of ${id} (${count} files), keeping ${kept}.`,
  );
  if (!apply || !gone.length) return { versions: gone, files: count };
  // The registry first: a version no page can ask for, then its files.
  await db.runTransaction(async (tx) => {
    const now = (await tx.get(ref)).data();
    // Only versions still older than live and not beta, should a release
    // or a rollback have moved a channel meanwhile.
    const still = prunable(now).filter((version) => gone.includes(version));
    tx.set(ref, pruned(now, still));
  });
  const after = (await ref.get()).data();
  for (const version of gone) {
    if (after.versions?.[version]) continue;
    await files.deleteFiles({ prefix: `games/${id}/${version}/` });
  }
  log(`Deleted. ${id} now has: ${Object.keys(after.versions).join(", ")}.`);
  return { versions: gone, files: count };
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
