// Site-wide switches an admin flips from the admin pages. Stored in Firestore
// at site/settings, or `<GAMES_LOCAL_DIR>/settings.json` when running locally.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { firestore, localDir } from "./game-registry.mjs";

/** Every setting, with its value until an admin changes it. */
export const DEFAULTS = Object.freeze({
  /** The home page leaderboard: admins only until an admin makes it public. */
  leaderboardPublic: false,
});

/** Keeps known boolean settings only, filling in defaults. */
export function cleanSettings(value) {
  const settings = { ...DEFAULTS };
  if (value && typeof value === "object")
    for (const key of Object.keys(DEFAULTS))
      if (typeof value[key] === "boolean") settings[key] = value[key];
  return settings;
}

const localFile = () => path.join(localDir(), "settings.json");
let cache = { at: 0, value: null };

export async function readSettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < 30_000)
    return cache.value;
  let stored = null;
  if (localDir()) {
    try {
      stored = JSON.parse(await readFile(localFile(), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  } else {
    const snap = await (
      await firestore()
    )
      .collection("site")
      .doc("settings")
      .get();
    stored = snap.exists ? snap.data() : null;
  }
  const value = cleanSettings(stored);
  cache = { at: Date.now(), value };
  return value;
}

/** Changes the settings named in `change`; unknown keys are ignored. */
export async function updateSettings(change) {
  const next = cleanSettings({
    ...(await readSettings({ fresh: true })),
    ...change,
  });
  if (localDir()) {
    await mkdir(localDir(), { recursive: true });
    await writeFile(localFile(), JSON.stringify(next, null, 2) + "\n");
  } else {
    await (await firestore()).collection("site").doc("settings").set(next);
  }
  cache = { at: Date.now(), value: next };
  return next;
}
