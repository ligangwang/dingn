// Packing a game for itch.io: a page that frames dingn's embedded player.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ITCH_SIZE,
  embedAddress,
  itchListing,
  itchPage,
} from "../scripts/itch-package.mjs";
import { unzip, zip } from "../scripts/zip.mjs";

const game = {
  id: "tilezen",
  version: "1.3.7",
  title: { en: 'Tile "Zen" <1>', zh: "静心麻将" },
  description: { en: "Match the tiles.", zh: "配对麻将牌。" },
};

test("the uploaded page is only the embedded player of the game", () => {
  const page = itchPage(game);
  assert.match(
    page,
    /<iframe src="https:\/\/dingn\.com\/embed\/tilezen\/" title="Tile &quot;Zen&quot; &lt;1&gt;" allow="fullscreen; [^"]*" allowfullscreen>/,
  );
  assert.match(page, /<title>Tile &quot;Zen&quot; &lt;1&gt;<\/title>/);
  // Nothing of its own runs on itch.io: no scripts, and no other addresses.
  assert.doesNotMatch(page, /<script/);
  assert.deepEqual(
    [...new Set(page.match(/https?:\/\/[^"\s<]+/g))],
    [
      "https://dingn.com/embed/tilezen/",
      "https://dingn.com/play/tilezen/?ref=itch",
    ],
  );
  // In another language: that language's player and title.
  const zh = itchPage(game, "zh-CN");
  assert.match(zh, /<html lang="zh-CN">/);
  assert.match(zh, /src="https:\/\/dingn\.com\/zh\/embed\/tilezen\/"/);
  assert.match(zh, /<title>静心麻将<\/title>/);
  assert.equal(
    embedAddress("memory", "pt-BR"),
    "https://dingn.com/pt/embed/memory/",
  );
});

test("the zip itch.io gets has the page as its index.html", () => {
  const files = unzip(zip({ "index.html": itchPage(game) }));
  assert.deepEqual(Object.keys(files), ["index.html"]);
  assert.equal(files["index.html"].toString(), itchPage(game));
});

test("the listing says what to enter on itch.io", () => {
  const listing = itchListing(game);
  assert.match(listing, /Match the tiles\./);
  assert.match(listing, /tilezen-itch\.zip/);
  assert.match(listing, new RegExp(`${ITCH_SIZE.width} x ${ITCH_SIZE.height}`));
  assert.match(listing, /https:\/\/dingn\.com\/play\/tilezen\/\?ref=itch/);
  assert.match(itchListing(game, "zh-CN"), /配对麻将牌。/);
});
