// Players' sign-in photos, as other players see them.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  photoOf,
  safePhoto,
  setPhotoLookup,
  showsPhoto,
} from "../scripts/player-photos.mjs";

after(() => setPhotoLookup(null));
const google = "https://lh3.googleusercontent.com/a/ACg8ocK-abc_123=s96-c";

test("only a Google profile picture is passed on", () => {
  assert.equal(safePhoto(google), google);
  for (const bad of [
    "https://evil.example/a.png",
    "http://lh3.googleusercontent.com/a/x",
    "https://lh3.googleusercontent.com.evil.example/a",
    'https://lh3.googleusercontent.com/a"onerror=x',
    "",
    null,
  ])
    assert.equal(safePhoto(bad), null, String(bad));
});

test("a player's photo shows unless they chose an avatar or their initials", async () => {
  let asked = 0;
  setPhotoLookup(async (uid) => {
    asked++;
    if (uid === "gone") throw new Error("no such account");
    return uid === "odd" ? "https://evil.example/a.png" : google;
  });
  assert.equal(showsPhoto(""), true);
  assert.equal(showsPhoto(undefined), true);
  assert.equal(showsPhoto("fox"), false);
  assert.equal(showsPhoto("initials"), false);
  assert.equal(await photoOf("ada", ""), google);
  // Kept for a while: asked once.
  assert.equal(await photoOf("ada", undefined), google);
  assert.equal(asked, 1);
  assert.equal(await photoOf("ada", "fox"), null);
  assert.equal(await photoOf("ada", "initials"), null);
  assert.equal(await photoOf("odd", ""), null);
  assert.equal(await photoOf("gone", ""), null);
  assert.equal(await photoOf(null, ""), null);
});
