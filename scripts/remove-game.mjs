// Deletes a game from dingn for good: its registry record (`games/{id}`), its
// play counts (`gameStats/{id}`) and every published file in the games bucket
// (`games/<id>/`). Only a game an admin already took down can be removed.
// Players keep what they earned in it (badges, coins, XP, saved progress).
//
//   node scripts/remove-game.mjs <id>          # dry run: shows what would go
//   node scripts/remove-game.mjs <id> --apply  # deletes
//
// Production runs it from the Website workflow (Run workflow, migration).
import { pathToFileURL } from "node:url";
import { bucket, firestore, ID } from "./game-registry.mjs";

/** Why a game can't be removed, or null when it can. */
export function refusal(id, record) {
  if (!ID.test(id ?? "")) return "not a game id";
  if (!record) return "no such game";
  if (record.status !== "removed")
    return "take it down on the Games admin page first";
  return null;
}

export async function removeGame(
  id,
  { db, files, apply = false, log = console.log },
) {
  const ref = db.collection("games").doc(id);
  const snap = await ref.get();
  const problem = refusal(id, snap.exists ? snap.data() : null);
  if (problem) throw new Error(`Can't remove ${id}: ${problem}.`);
  const [objects] = await files.getFiles({ prefix: `games/${id}/` });
  log(
    `${apply ? "Removing" : "Would remove"} ${id}: its registry record, play counts and ${objects.length} files.`,
  );
  if (!apply) return { files: objects.length };
  await files.deleteFiles({ prefix: `games/${id}/` });
  await db.collection("gameStats").doc(id).delete();
  await ref.delete();
  log(`Removed ${id}.`);
  return { files: objects.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { getStorage } = await import("firebase-admin/storage");
  const { getApps } = await import("firebase-admin/app");
  const db = await firestore();
  const app = getApps().find((a) => a.name === "dingn-games");
  await removeGame(process.argv[2], {
    db,
    files: getStorage(app).bucket(bucket()),
    apply: process.argv.includes("--apply"),
  });
  process.exit(0);
}
