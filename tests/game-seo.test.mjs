import assert from "node:assert/strict";
import test from "node:test";
import {
  gamePageHtml,
  indexableGame,
  sitemapWithGames,
} from "../scripts/game-seo.mjs";

const page = [
  "<title>Play · dingn</title>",
  '<meta name="description" content="Discover games on dingn."/>',
  '<meta name="robots" content="noindex, nofollow"/>',
  '<link rel="canonical" href="https://dingn.com/play/"/>',
  '<link rel="alternate" hrefLang="en" href="https://dingn.com/play/"/>',
  '<link rel="alternate" hrefLang="zh-CN" href="https://dingn.com/zh/play/"/>',
  '<link rel="alternate" hrefLang="x-default" href="https://dingn.com/play/"/>',
  '<meta property="og:title" content="Play"/>',
  '<meta property="og:description" content="Discover games on dingn."/>',
  '<meta property="og:url" content="https://dingn.com/play/"/>',
].join("");

const version = {
  title: { en: "Crowd Rush", zh: "人潮突击" },
  description: { en: 'Grow your "squad" <fast>', zh: "壮大队伍" },
  entry: "index.html",
  reviewedAt: "2026-11-09T00:00:00Z",
};
const game = (extra = {}) => ({
  id: "crowdrush",
  owner: "uid1",
  status: "listed",
  live: "1.0.0",
  versions: { "1.0.0": version },
  ...extra,
});

test("a listed, reviewed game gets its own title, description and addresses", () => {
  const en = gamePageHtml(page, game(), false);
  assert.match(en, /<title>Crowd Rush · dingn<\/title>/);
  assert.match(en, /content="index, follow"/);
  assert.match(
    en,
    /rel="canonical" href="https:\/\/dingn.com\/play\/crowdrush\/"/,
  );
  assert.match(
    en,
    /hrefLang="zh-CN" href="https:\/\/dingn.com\/zh\/play\/crowdrush\/"/,
  );
  assert.match(
    en,
    /name="description" content="Grow your &quot;squad&quot; &lt;fast&gt;"/,
  );
  assert.match(en, /og:title" content="Crowd Rush"/);
  const zh = gamePageHtml(page, game(), true);
  assert.match(zh, /<title>人潮突击 · dingn<\/title>/);
  assert.match(
    zh,
    /rel="canonical" href="https:\/\/dingn.com\/zh\/play\/crowdrush\/"/,
  );
  assert.match(zh, /og:description" content="壮大队伍"/);
});

test("hidden, unreviewed, taken-down and missing games stay noindex", () => {
  for (const record of [
    null,
    game({ status: "unlisted" }),
    game({ status: "removed" }),
    game({ live: null }),
    game({ versions: { "1.0.0": { ...version, reviewedAt: undefined } } }),
  ]) {
    assert.equal(gamePageHtml(page, record, false), page);
    assert.equal(indexableGame(record), null);
  }
  // dingn's own games (no owner) need no review
  assert.ok(
    indexableGame(
      game({
        owner: null,
        versions: { "1.0.0": { ...version, reviewedAt: undefined } },
      }),
    ),
  );
});

test("the sitemap lists every indexable game in both languages", () => {
  const xml =
    '<?xml version="1.0"?><urlset><url><loc>https://dingn.com/</loc></url></urlset>';
  const out = sitemapWithGames(xml, [
    game(),
    game({ id: "hidden", status: "unlisted" }),
  ]);
  assert.match(out, /<loc>https:\/\/dingn.com\/play\/crowdrush\/<\/loc>/);
  assert.match(out, /<loc>https:\/\/dingn.com\/zh\/play\/crowdrush\/<\/loc>/);
  assert.doesNotMatch(out, /hidden/);
  assert.ok(out.endsWith("</urlset>"));
  assert.equal(sitemapWithGames(xml, []), xml);
});
