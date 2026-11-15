// One-time move of players' Major System favorites into the Memory game's
// progress. The Number and Card labs used to save a favorite word per number
// in Firestore `number_favorites/{uid}-{number}` ({uid, number, favoriteWord}).
// The Memory game (ligangwang/memory) now keeps them in its dingn progress,
// `accounts/{uid}.game_progress_memory`, as {"favorites": {"07": "sock"}}.
// A favorite the game already saved is never replaced, and running it twice
// changes nothing the second time. `number_favorites` is kept as a backup.
//
//   node scripts/migrate-memory-favorites.mjs          # dry run: counts only
//   node scripts/migrate-memory-favorites.mjs --apply  # writes
//
// Production runs it from the Website workflow (Run workflow, migration).
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";

export const FIELD = "game_progress_memory";
const PAGE = 500;
/** dingn's limit on one game's saved progress. */
const MAX_BYTES = 16 * 1024;

/**
 * The progress to write for one account given its favorites, or null when
 * nothing would change.
 */
export function mergedProgress(saved, favorites) {
  let progress = {};
  if (typeof saved === "string")
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        progress = parsed;
    } catch {}
  const have =
    progress.favorites && typeof progress.favorites === "object"
      ? progress.favorites
      : {};
  const added = Object.fromEntries(
    Object.entries(favorites).filter(([number]) => !(number in have)),
  );
  if (!Object.keys(added).length) return null;
  const value = JSON.stringify({
    ...progress,
    favorites: { ...added, ...have },
  });
  return Buffer.byteLength(value) <= MAX_BYTES ? value : null;
}

/** Favorites per player from `number_favorites`. */
export async function readFavorites(db) {
  const byUid = new Map();
  let last = null;
  for (;;) {
    let query = db
      .collection("number_favorites")
      .orderBy("__name__")
      .limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    for (const snap of page.docs) {
      const { uid, number, favoriteWord } = snap.data() ?? {};
      if (
        typeof uid !== "string" ||
        !uid ||
        !/^\d{1,4}$/.test(String(number)) ||
        typeof favoriteWord !== "string" ||
        !favoriteWord.trim()
      )
        continue;
      if (!byUid.has(uid)) byUid.set(uid, {});
      byUid.get(uid)[String(number)] = favoriteWord;
    }
    last = page.docs.at(-1);
  }
  return byUid;
}

/** Firestore's failed update-time precondition (gRPC code 9). */
const changedMeanwhile = (error) =>
  error?.code === 9 || error?.code === "failed-precondition";

export async function migrate(db, { apply = false, log = console.log } = {}) {
  const counts = { players: 0, migrate: 0, written: 0, changed: 0 };
  for (const [uid, favorites] of await readFavorites(db)) {
    counts.players += 1;
    const ref = db.collection("accounts").doc(uid);
    const snap = await ref.get();
    const value = mergedProgress(snap.data()?.[FIELD], favorites);
    if (value == null) continue;
    counts.migrate += 1;
    if (!apply) continue;
    try {
      if (snap.exists)
        await ref.update(
          { [FIELD]: value },
          { lastUpdateTime: snap.updateTime },
        );
      else await ref.create({ [FIELD]: value });
      counts.written += 1;
    } catch (error) {
      // Changed since it was read (or created meanwhile, gRPC 6): the next
      // run picks it up. Any other failure stops the run.
      if (!changedMeanwhile(error) && error?.code !== 6) throw error;
      counts.changed += 1;
    }
  }
  log(
    `${apply ? "Migrated" : "Would migrate"} favorites for ${counts.migrate} of ${counts.players} players` +
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
  process.exit(0);
}
