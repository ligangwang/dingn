import assert from "node:assert/strict";
import test from "node:test";
import {
  deck,
  favoriteRecord,
  numberFromData,
  profileFromData,
  profileRecord,
  safeDestination,
  shuffle,
  wordFromData,
} from "../src/lib/models";

test("all 52 legacy card IDs keep the original Major System numbers", () => {
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => c.id)).size, 52);
  assert.equal(new Set(deck.map((c) => c.number)).size, 52);
  for (const [id, number] of Object.entries({
    C2: "72",
    C10: "710",
    CJ: "767",
    CQ: "772",
    CK: "777",
    CA: "70",
    DJ: "167",
    HA: "40",
    S2: "02",
    SA: "00",
  }))
    assert.equal(deck.find((c) => c.id === id)?.number, number);
});
test("favorites retain leading zeroes and legacy document shape", () => {
  assert.deepEqual(favoriteRecord("existing-user", "02", "sun"), {
    id: "existing-user-02",
    data: { uid: "existing-user", number: "02", favoriteWord: "sun" },
  });
  assert.throws(() => favoriteRecord("", "02", "sun"));
  assert.throws(() => favoriteRecord("u", "../../x", "sun"));
});
test("existing account preferences survive migration", () => {
  assert.deepEqual(
    profileFromData({ user_name: "Lee", card_side: "TwoSides" }),
    { userName: "Lee", cardSide: "TwoSides" },
  );
  assert.deepEqual(profileFromData(), { userName: "", cardSide: "OneSide" });
  assert.deepEqual(profileRecord({ userName: " Lee ", cardSide: "TwoSides" }), {
    user_name: "Lee",
    card_side: "TwoSides",
  });
});
test("legacy number and word records retain fields and tolerate absent optional fields", () => {
  assert.deepEqual(
    numberFromData("02", { words: ["sun", "son"], most_favorite_word: "sun" }),
    { number: "02", words: ["sun", "son"], favorite: "sun" },
  );
  assert.deepEqual(
    wordFromData("name", {
      number: "23",
      ipa: "neɪm",
      "ipa-lang": "en",
      pos: { noun: ["A word used to identify a person."] },
    }),
    {
      word: "name",
      number: "23",
      ipa: "neɪm",
      language: "en",
      definitions: { noun: ["A word used to identify a person."] },
    },
  );
  assert.equal(wordFromData("zero", { number: 0 }).number, "0");
  assert.deepEqual(numberFromData("00", {}).words, []);
});
test("shuffling neither mutates nor drops cards", () => {
  const original = deck.map((c) => c.id),
    mixed = shuffle(deck, () => 0);
  assert.deepEqual(
    deck.map((c) => c.id),
    original,
  );
  assert.deepEqual(mixed.map((c) => c.id).sort(), [...original].sort());
  assert.notDeepEqual(
    mixed.map((c) => c.id),
    original,
  );
});
test("sign-in returns only to supported local pages", () => {
  assert.equal(safeDestination("/number/"), "/number/");
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    null,
  ])
    assert.equal(safeDestination(bad), "/");
});
