import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { copy } from "../copy.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../game.json", import.meta.url), "utf8"),
);

test("the game has matching catalog and interface languages", () => {
  assert.deepEqual([...manifest.languages].sort(), Object.keys(copy).sort());
  for (const lang of manifest.languages) {
    const catalogKey = lang === "zh-CN" ? "zh" : lang;
    assert.ok(manifest.title[catalogKey]);
    assert.ok(manifest.description[catalogKey]);
    for (const key of Object.keys(copy.en)) assert.ok(copy[lang][key], key);
  }
});

test("the release manifest names the game and its runtime entry", async () => {
  assert.match(manifest.id, /^[a-z][a-z0-9]{1,30}$/);
  assert.match(manifest.version, /^\d{1,4}\.\d{1,4}\.\d{1,4}$/);
  for (const file of [manifest.entry, manifest.cover]) {
    assert.ok((await readFile(new URL(`../${file}`, import.meta.url))).length);
  }
});
