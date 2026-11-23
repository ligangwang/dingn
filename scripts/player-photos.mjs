// A player's sign-in photo (their Google picture), for the places other
// players see them: challenge results, the leaderboard, their public page.
// It is the default avatar: shown unless the player chose a preset or
// "initials" in their settings, which is how a player keeps it to themselves.
//
// Read from Firebase Auth and kept for ten minutes. Only Google's own image
// host is passed on: an account's photo address can be set to anything by
// its owner, and dingn won't make other players' browsers load that.
import { localDir } from "./game-registry.mjs";

const PHOTO = /^https:\/\/lh\d\.googleusercontent\.com\/[\w\-./=~%+:@]+$/;
const TTL_MS = 10 * 60_000;
const photos = new Map();

/** The address if it is a Google profile picture, otherwise null. */
export const safePhoto = (url) =>
  typeof url === "string" && url.length <= 512 && PHOTO.test(url) ? url : null;

/** Whether an account's avatar choice leaves the sign-in photo showing. */
export const showsPhoto = (avatar) => avatar == null || avatar === "";

async function fromAuth(uid) {
  // The local store (tests, local play) has no accounts to ask.
  if (localDir()) return null;
  const auth = await (await import("./games-admin.mjs")).firebaseAuth();
  return (await auth.getUser(uid)).photoURL ?? null;
}

let lookup = fromAuth;
/** Replaces the Firebase Auth lookup, in tests. */
export function setPhotoLookup(next) {
  lookup = next ?? fromAuth;
  photos.clear();
}

/**
 * The photo to show for the player `uid`, whose saved avatar choice is
 * `avatar`: null when they chose something else, have none, or it can't be
 * read. Never throws.
 */
export async function photoOf(uid, avatar, now = Date.now()) {
  if (!uid || !showsPhoto(avatar)) return null;
  const kept = photos.get(uid);
  if (kept && now - kept.at < TTL_MS) return kept.photo;
  const photo = safePhoto(await Promise.resolve(lookup(uid)).catch(() => null));
  photos.set(uid, { at: now, photo });
  return photo;
}
