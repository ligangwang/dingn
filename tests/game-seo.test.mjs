import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryPageHtml,
  fillSlot,
  gamePageHtml,
  homePageHtml,
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
  '<meta property="og:image" content="https://dingn.com/og.jpg"/>',
  '<meta property="og:image:width" content="1200"/>',
  '<meta property="og:image:height" content="630"/>',
  '<meta property="og:image:alt" content="dingn"/>',
  '<meta name="twitter:title" content="Play"/>',
  '<meta name="twitter:description" content="Discover games on dingn."/>',
  '<meta name="twitter:image" content="https://dingn.com/og.jpg"/>',
  "</head><body>",
  '<div class="game-about" data-fill="game"></div>',
  "</body>",
].join("");

const version = {
  title: { en: "Crowd Rush", zh: "人潮突击" },
  description: { en: 'Grow your "squad" <fast>', zh: "壮大队伍" },
  entry: "index.html",
  cover: "cover.jpg",
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
  assert.match(en, /<title>Crowd Rush – Play free online · dingn<\/title>/);
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
  assert.match(zh, /<title>人潮突击 - 免费在线玩 · dingn<\/title>/);
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
  assert.match(out, /<lastmod>2026-11-09T00:00:00.000Z<\/lastmod>/);
  assert.doesNotMatch(out, /hidden/);
  assert.ok(out.endsWith("</urlset>"));
  assert.equal(sitemapWithGames(xml, []), xml);
});

const catalogGame = (id, category, extra = {}) => ({
  id,
  category,
  title: { en: id.toUpperCase(), zh: `中${id}` },
  description: { en: `About ${id}`, zh: `关于${id}` },
  cover: `/g/${id}/1.0.0/cover.jpg`,
  plays: { week: 0, month: 0 },
  ...extra,
});
const games = [
  catalogGame("crowdrush", "casual"),
  catalogGame("gemsurge", "casual", { plays: { week: 5, month: 9 } }),
  catalogGame("rubikscube", "puzzle", { cover: null }),
];
const ldOf = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .flatMap((d) => d["@graph"]);

test("a game page shares its cover and describes itself to search engines", () => {
  const en = gamePageHtml(page, game(), false, games);
  assert.match(
    en,
    /og:image" content="https:\/\/dingn.com\/g\/crowdrush\/1.0.0\/cover.jpg"/,
  );
  assert.match(en, /twitter:image" content="https:\/\/dingn.com\/g\/crowdrush/);
  assert.doesNotMatch(en, /og:image:width/);
  assert.match(en, /twitter:title" content="Crowd Rush"/);
  const [videoGame, crumbs] = ldOf(en);
  assert.equal(videoGame["@type"], "VideoGame");
  assert.equal(videoGame.url, "https://dingn.com/play/crowdrush/");
  assert.equal(videoGame.genre, "Casual");
  assert.deepEqual(
    crumbs.itemListElement.map((c) => c.item),
    [
      "https://dingn.com/",
      "https://dingn.com/casual/",
      "https://dingn.com/play/crowdrush/",
    ],
  );
  // The page lists the category's other games as plain links.
  assert.match(en, /<h1>Crowd Rush<\/h1>/);
  assert.match(en, /href="\/play\/gemsurge\/"/);
  assert.doesNotMatch(en, /href="\/play\/rubikscube\/"/);
  const zh = gamePageHtml(page, game(), true, games);
  assert.match(zh, /href="\/zh\/casual\/">休闲游戏/);
  assert.match(zh, /href="\/zh\/play\/gemsurge\/"/);
});

test("text from a game can't break out of the page or its JSON-LD", () => {
  const evil = game({
    versions: {
      "1.0.0": {
        ...version,
        title: { en: "</script><script>alert(1)</script>", zh: "x" },
      },
    },
  });
  const html = gamePageHtml(page, evil, false, games);
  assert.doesNotMatch(html, /<script>alert/);
  assert.equal(ldOf(html)[0].name, "</script><script>alert(1)</script>");
  // `$` patterns in a title are text, not replacement tokens.
  const dollar = game({
    versions: {
      "1.0.0": { ...version, title: { en: "Dollar $' $` $& Game", zh: "x" } },
    },
  });
  const out = gamePageHtml(page, dollar, false, games);
  assert.match(out, /<title>Dollar \$' \$` \$&amp; Game – Play/);
  assert.equal(ldOf(out)[0].name, "Dollar $' $` $& Game");
});

test("category pages list their games, most played first", () => {
  const html = categoryPageHtml(
    '<head></head><div class="game-grid" data-fill="games"></div>',
    games,
    "casual",
    true,
  );
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["/zh/play/gemsurge/", "/zh/play/crowdrush/"]);
  const [collection, crumbs] = ldOf(html);
  assert.equal(collection.mainEntity.numberOfItems, 2);
  assert.equal(
    collection.mainEntity.itemListElement[0].url,
    "https://dingn.com/zh/play/gemsurge/",
  );
  assert.equal(crumbs.itemListElement[1].name, "休闲游戏");
});

test("the home page fills each category's top games", () => {
  const html = homePageHtml(
    '<ul data-fill="top-casual"></ul><ul data-fill="top-memory"></ul><ul class="arena-games" data-fill="top-puzzle"></ul>',
    games,
    false,
  );
  assert.match(html, /data-fill="top-casual"><li><a href="\/play\/gemsurge\/"/);
  assert.match(html, /data-fill="top-memory"><\/ul>/);
  assert.match(html, /href="\/play\/rubikscube\/" title="RUBIKSCUBE"/);
  // Only an empty slot is filled, and a page without one is unchanged.
  assert.equal(fillSlot("<p>hi</p>", "games", "x"), "<p>hi</p>");
});

test("a challenge link's preview shows the saved score to beat", () => {
  const saved = {
    id: "Xq3v9TzK1bWm",
    game: "crowdrush",
    mode: "run",
    seed: "2026-11-16",
    score: 42,
    unit: "points",
  };
  const en = gamePageHtml(page, game(), false, [], saved);
  assert.match(
    en,
    /og:title" content="A friend reached 42 points in Crowd Rush. Can you beat it\?"/,
  );
  assert.match(en, /twitter:title" content="A friend reached 42 points/);
  assert.match(
    en,
    /og:description" content="Play the same challenge free on dingn/,
  );
  assert.match(
    en,
    /og:url" content="https:\/\/dingn.com\/play\/crowdrush\/\?c=Xq3v9TzK1bWm"/,
  );
  // The page itself is still the game's page.
  assert.match(
    en,
    /rel="canonical" href="https:\/\/dingn.com\/play\/crowdrush\/"/,
  );
  const zh = gamePageHtml(page, game(), true, [], saved);
  assert.match(
    zh,
    /og:title" content="朋友在「人潮突击」中达到了 42 分，你能超过吗？"/,
  );
  // With the maker's nickname when they were signed in.
  assert.match(
    gamePageHtml(page, game(), false, [], { ...saved, name: "Ada" }),
    /og:title" content="Ada reached 42 points in Crowd Rush/,
  );
  // Another game's challenge, or none, leaves the normal preview.
  for (const other of [{ ...saved, game: "memory" }, null])
    assert.match(
      gamePageHtml(page, game(), false, [], other),
      /og:title" content="Crowd Rush"/,
    );
});
