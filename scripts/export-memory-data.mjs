// One-time export of the Major System library (Firestore `numbers` and
// `words`) for the Memory game, which moved to its own repository
// (ligangwang/memory) and bundles this data instead of reading Firestore.
//
//   node scripts/export-memory-data.mjs OUT_DIR
//
// Writes OUT_DIR/numbers.json ({"07": {"w": [words], "f": favorite}}) and
// OUT_DIR/words/<a-z or _>.json ({word: [ipa, language, number, pos]}), plus
// OUT_DIR/index.json with counts. Production runs it from the Website
// workflow (Run workflow, migration memory-export).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { firestore } from "./game-registry.mjs";

const PAGE = 2000;

/** One `numbers` document in the export's shape, or null to skip it. */
export function exportNumber(id, data) {
  const number = String(data?.number ?? id);
  if (!/^\d{1,4}$/.test(number)) return null;
  const words = Array.isArray(data?.words) ? data.words.map(String) : [];
  const entry = { w: words };
  if (typeof data?.most_favorite_word === "string")
    entry.f = data.most_favorite_word;
  return [number, entry];
}

/** One `words` document in the export's shape, or null to skip it. */
export function exportWord(id, data) {
  const word = String(data?.word ?? id).trim();
  if (!word) return null;
  const pos = {};
  if (data?.pos && typeof data.pos === "object")
    for (const [key, value] of Object.entries(data.pos))
      pos[key] = Array.isArray(value) ? value.map(String) : [String(value)];
  return [
    word,
    [
      String(data?.ipa ?? ""),
      String(data?.["ipa-lang"] ?? ""),
      String(data?.number ?? ""),
      pos,
    ],
  ];
}

/** The file a word goes in: its first letter, or "_" for anything else. */
export const wordShard = (word) => {
  const first = word[0]?.toLowerCase() ?? "";
  return /^[a-z]$/.test(first) ? first : "_";
};

async function* every(db, name) {
  let last = null;
  for (;;) {
    let query = db.collection(name).orderBy("__name__").limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) return;
    yield* page.docs;
    last = page.docs.at(-1);
  }
}

export async function exportAll(db, out, log = console.log) {
  const numbers = {};
  for await (const snap of every(db, "numbers")) {
    const entry = exportNumber(snap.id, snap.data());
    if (entry) numbers[entry[0]] = entry[1];
  }
  const shards = {};
  let words = 0;
  for await (const snap of every(db, "words")) {
    const entry = exportWord(snap.id, snap.data());
    if (!entry) continue;
    (shards[wordShard(entry[0])] ??= {})[entry[0]] = entry[1];
    words += 1;
  }
  mkdirSync(path.join(out, "words"), { recursive: true });
  writeFileSync(path.join(out, "numbers.json"), JSON.stringify(numbers));
  const counts = {};
  for (const [shard, entries] of Object.entries(shards)) {
    counts[shard] = Object.keys(entries).length;
    writeFileSync(
      path.join(out, "words", `${shard}.json`),
      JSON.stringify(entries),
    );
  }
  const index = { numbers: Object.keys(numbers).length, words: counts };
  writeFileSync(path.join(out, "index.json"), JSON.stringify(index));
  log(`Exported ${index.numbers} numbers and ${words} words.`);
  return index;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = process.argv[2];
  if (!out) {
    console.error("Usage: node scripts/export-memory-data.mjs OUT_DIR");
    process.exit(1);
  }
  await exportAll(await firestore(), out);
  process.exit(0);
}
