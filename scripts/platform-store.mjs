// Small document store for the game platform's server-only records: developer
// agreements, player reports, play counts and queued emails. Production uses
// Firestore through the Admin SDK (firestore.rules deny browsers every one of
// these collections). With GAMES_LOCAL_DIR set, each collection is a JSON
// file in `<dir>/store/`, for local runs and tests.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { firestore, localDir } from "./game-registry.mjs";

const file = (collection) =>
  path.join(localDir(), "store", `${collection}.json`);

async function readLocal(collection) {
  try {
    return JSON.parse(await readFile(file(collection), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}
async function writeLocal(collection, all) {
  await mkdir(path.dirname(file(collection)), { recursive: true });
  await writeFile(file(collection), JSON.stringify(all, null, 2) + "\n");
}

export async function getDoc(collection, id) {
  if (localDir()) return (await readLocal(collection))[id] ?? null;
  const snap = await (await firestore()).collection(collection).doc(id).get();
  return snap.exists ? snap.data() : null;
}

/** Writes fields into a document, keeping its other fields. */
export async function mergeDoc(collection, id, data) {
  if (localDir()) {
    const all = await readLocal(collection);
    all[id] = { ...all[id], ...data };
    return writeLocal(collection, all);
  }
  await (
    await firestore()
  )
    .collection(collection)
    .doc(id)
    .set(data, { merge: true });
}

/** Adds a document with a new id and returns the id. */
export async function addDoc(collection, data) {
  if (localDir()) {
    const all = await readLocal(collection);
    const id = randomUUID();
    all[id] = data;
    await writeLocal(collection, all);
    return id;
  }
  return (await (await firestore()).collection(collection).add(data)).id;
}

/** Every document in a collection (optionally where `field` == `value`). */
export async function listDocs(collection, where) {
  if (localDir())
    return Object.entries(await readLocal(collection))
      .map(([id, data]) => ({ id, ...data }))
      .filter((d) => !where || d[where[0]] === where[1]);
  let query = (await firestore()).collection(collection);
  if (where) query = query.where(where[0], "==", where[1]);
  return (await query.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Adds to number fields of a document, e.g. { total: 3, "days.2026-11-09": 3 }.
 * Dotted names are nested fields.
 */
export async function incrementDoc(collection, id, counts) {
  if (localDir()) {
    const all = await readLocal(collection);
    const doc = all[id] ?? {};
    for (const [name, n] of Object.entries(counts)) {
      const parts = name.split(".");
      let target = doc;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      const last = parts.at(-1);
      target[last] = (target[last] ?? 0) + n;
    }
    all[id] = doc;
    return writeLocal(collection, all);
  }
  const { FieldValue } = await import("firebase-admin/firestore");
  const update = {};
  for (const [name, n] of Object.entries(counts))
    update[name] = FieldValue.increment(n);
  const ref = (await firestore()).collection(collection).doc(id);
  try {
    await ref.update(update);
  } catch (error) {
    // NOT_FOUND: the first count for this document.
    if (error.code !== 5) throw error;
    const nested = {};
    for (const [name, n] of Object.entries(counts)) {
      const parts = name.split(".");
      let target = nested;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)] = FieldValue.increment(n);
    }
    await ref.set(nested, { merge: true });
  }
}
