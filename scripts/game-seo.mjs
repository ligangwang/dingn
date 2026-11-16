// Search engines and link previews for published games. Every game plays on
// the one exported page, /play/index.html, whose title and links are the
// generic "Play" ones and which says noindex. For a game that is listed and
// has a reviewed live version, the server fills in that game's own title,
// description and addresses before sending the page, and adds the game to
// the sitemap. Hidden, previewed and taken-down games stay noindex.
//
// The category pages and the home page list games the browser fetches from
// /api/games, so their exported HTML has no games in it. For crawlers that
// don't run scripts (and for a faster first paint), the server fills each
// page's empty `data-fill` slots (src/components/server-fill.tsx) with plain
// links to the games, and adds schema.org data (JSON-LD) to the <head>.
import { categoryOf, isPreview, resolveVersion } from "./game-registry.mjs";

const SITE = "https://dingn.com";

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** The live version of a game search engines may show, or null. */
export function indexableGame(record) {
  if (!record || record.status !== "listed") return null;
  const live = resolveVersion(record, "");
  if (!live || isPreview(record, live)) return null;
  return live;
}

const pageUrl = (id, zh) => `${SITE}${zh ? "/zh" : ""}/play/${id}/`;
const sitePath = (path, zh) => (zh ? "/zh" : "") + path;

/** Each category's page and name, in both languages. */
const CATEGORY_NAMES = {
  casual: { en: "Casual games", zh: "休闲游戏" },
  memory: { en: "Memory games", zh: "记忆游戏" },
  puzzle: { en: "Puzzle games", zh: "益智游戏" },
};
const MORE = {
  casual: { en: "More casual games", zh: "更多休闲游戏" },
  memory: { en: "More memory games", zh: "更多记忆游戏" },
  puzzle: { en: "More puzzle games", zh: "更多益智游戏" },
};

/** A game's page title (keep in step with src/components/game-host.tsx). */
export const gameTitle = (title, zh) =>
  zh ? `${title} - 免费在线玩` : `${title} – Play free online`;

/** JSON-LD for the <head>: `<` is escaped so no text can end the script. */
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll(
    "<",
    "\\u003c",
  )}</script>`;
// Replacements go through callbacks so a `$` in a game's text stays literal.
const addToHead = (html, extra) =>
  html.replace("</head>", () => `${extra}</head>`);

/** Puts `inner` into the page's empty slot named `name`, if it has one. */
export function fillSlot(html, name, inner) {
  const slot = new RegExp(
    `(<(\\w+)\\b[^>]*\\sdata-fill="${name}"[^>]*>)(</\\2>)`,
  );
  return html.replace(slot, (_, open, _tag, close) => open + inner + close);
}

const breadcrumbJsonLd = (crumbs) => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map(([name, url], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: url,
  })),
});
const breadcrumbHtml = (crumbs) =>
  `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs
    .map(([name, url], i) =>
      i === crumbs.length - 1
        ? `<li aria-current="page">${escape(name)}</li>`
        : `<li><a href="${escape(url.slice(SITE.length))}">${escape(name)}</a></li>`,
    )
    .join("")}</ol></nav>`;

/** A catalog game's text in one language. */
const textOf = (game, zh) => ({
  title: (zh && game.title?.zh) || game.title?.en || game.id,
  description: (zh && game.description?.zh) || game.description?.en || "",
});

/** The games of a category, most played first (as src/lib/catalog.ts). */
export function gamesOf(games, category, zh) {
  return games
    .filter((g) => g.category === category)
    .sort(
      (a, b) =>
        (b.plays?.month ?? 0) - (a.plays?.month ?? 0) ||
        (b.plays?.week ?? 0) - (a.plays?.week ?? 0) ||
        textOf(a, zh).title.localeCompare(
          textOf(b, zh).title,
          zh ? "zh-CN" : "en",
        ),
    );
}

/** A game card, like GameCard in src/components/catalog.tsx. */
function cardHtml(game, zh) {
  const { title, description } = textOf(game, zh);
  const cover = game.cover
    ? `<span class="game-cover"><img src="${escape(game.cover)}" alt="" loading="lazy" decoding="async"/></span>`
    : `<span class="game-cover drawn"><span class="cover-title">${escape(title)}</span></span>`;
  return `<a class="game-card" href="${sitePath(`/play/${game.id}/`, zh)}">${cover}<span class="game-card-body"><strong>${escape(title)}</strong><span class="game-pitch">${escape(description)}</span></span></a>`;
}

/**
 * The play page for one game: `html` with that game's title, description,
 * robots, addresses, share picture and schema.org data when it may be
 * indexed, otherwise `html` unchanged. `games` is the catalog (/api/games),
 * for the links to the category's other games.
 */
export function gamePageHtml(html, record, zh, games = []) {
  const live = indexableGame(record);
  if (!live) return html;
  const id = record.id;
  const lang = zh ? "zh" : "en";
  const name = live.title?.[lang] || live.title?.en || id;
  const title = escape(name);
  const description = live.description?.[lang] || live.description?.en;
  const category = categoryOf(record, live);
  const cover = live.cover
    ? `${SITE}/g/${id}/${live.version}/${live.cover}`
    : null;
  const swaps = [
    [
      /<title>[^<]*<\/title>/,
      `<title>${escape(gameTitle(name, zh))} · dingn</title>`,
    ],
    [
      /<meta name="twitter:title" content="[^"]*"\/>/,
      `<meta name="twitter:title" content="${title}"/>`,
    ],
    [
      /<meta name="robots" content="[^"]*"\/>/,
      '<meta name="robots" content="index, follow"/>',
    ],
    [
      /<link rel="canonical" href="[^"]*"\/>/,
      `<link rel="canonical" href="${pageUrl(id, zh)}"/>`,
    ],
    [
      /<link rel="alternate" hrefLang="en" href="[^"]*"\/>/,
      `<link rel="alternate" hrefLang="en" href="${pageUrl(id, false)}"/>`,
    ],
    [
      /<link rel="alternate" hrefLang="zh-CN" href="[^"]*"\/>/,
      `<link rel="alternate" hrefLang="zh-CN" href="${pageUrl(id, true)}"/>`,
    ],
    [
      /<link rel="alternate" hrefLang="x-default" href="[^"]*"\/>/,
      `<link rel="alternate" hrefLang="x-default" href="${pageUrl(id, false)}"/>`,
    ],
    [
      /<meta property="og:url" content="[^"]*"\/>/,
      `<meta property="og:url" content="${pageUrl(id, zh)}"/>`,
    ],
    [
      /<meta property="og:title" content="[^"]*"\/>/,
      `<meta property="og:title" content="${title}"/>`,
    ],
  ];
  if (description)
    swaps.push(
      [
        /<meta name="description" content="[^"]*"\/>/,
        `<meta name="description" content="${escape(description)}"/>`,
      ],
      [
        /<meta property="og:description" content="[^"]*"\/>/,
        `<meta property="og:description" content="${escape(description)}"/>`,
      ],
      [
        /<meta name="twitter:description" content="[^"]*"\/>/,
        `<meta name="twitter:description" content="${escape(description)}"/>`,
      ],
    );
  if (cover)
    swaps.push(
      [
        /<meta property="og:image" content="[^"]*"\/>/,
        `<meta property="og:image" content="${escape(cover)}"/>`,
      ],
      // The cover's size isn't known; the site picture's would be wrong.
      [/<meta property="og:image:width" content="[^"]*"\/>/, ""],
      [/<meta property="og:image:height" content="[^"]*"\/>/, ""],
      [
        /<meta property="og:image:alt" content="[^"]*"\/>/,
        `<meta property="og:image:alt" content="${title}"/>`,
      ],
      [
        /<meta name="twitter:image" content="[^"]*"\/>/,
        `<meta name="twitter:image" content="${escape(cover)}"/>`,
      ],
    );
  let page = swaps.reduce(
    (out, [from, to]) => out.replace(from, () => to),
    html,
  );

  const url = pageUrl(id, zh);
  const names = CATEGORY_NAMES[category];
  const crumbs = [
    ["dingn", SITE + sitePath("/", zh)],
    [names[lang], SITE + sitePath(`/${category}/`, zh)],
    [name, url],
  ];
  page = addToHead(
    page,
    jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "VideoGame",
          "@id": url + "#game",
          name,
          url,
          ...(description ? { description } : {}),
          ...(cover ? { image: cover } : {}),
          inLanguage: zh ? "zh-CN" : "en",
          genre: names.en.replace(/ games$/, ""),
          gamePlatform: "Web browser",
          applicationCategory: "Game",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
          publisher: {
            "@type": "Organization",
            name: "dingn",
            url: SITE + "/",
          },
        },
        breadcrumbJsonLd(crumbs),
      ],
    }),
  );
  const others = gamesOf(games, category, zh)
    .filter((g) => g.id !== id)
    .slice(0, 4);
  return fillSlot(
    page,
    "game",
    breadcrumbHtml(crumbs) +
      `<h1>${title}</h1>` +
      (description ? `<p class="lede">${escape(description)}</p>` : "") +
      (others.length
        ? `<h2>${MORE[category][lang]}</h2><div class="game-grid">${others
            .map((g) => cardHtml(g, zh))
            .join("")}</div>`
        : ""),
  );
}

/**
 * A category page (/casual/, /zh/puzzle/, …) with its games as links in the
 * page and as a schema.org ItemList.
 */
export function categoryPageHtml(html, games, category, zh) {
  const lang = zh ? "zh" : "en";
  const list = gamesOf(games, category, zh);
  const url = SITE + sitePath(`/${category}/`, zh);
  const name = CATEGORY_NAMES[category][lang];
  const page = addToHead(
    html,
    jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": url,
          url,
          name,
          inLanguage: zh ? "zh-CN" : "en",
          isPartOf: { "@id": SITE + sitePath("/", zh) + "#website" },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: list.length,
            itemListElement: list.map((g, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: pageUrl(g.id, zh),
              name: textOf(g, zh).title,
            })),
          },
        },
        breadcrumbJsonLd([
          ["dingn", SITE + sitePath("/", zh)],
          [name, url],
        ]),
      ],
    }),
  );
  return fillSlot(page, "games", list.map((g) => cardHtml(g, zh)).join(""));
}

/** The home page with each category card's top three games as links. */
export function homePageHtml(html, games, zh) {
  return Object.keys(CATEGORY_NAMES).reduce((page, category) => {
    const top = gamesOf(games, category, zh).slice(0, 3);
    return fillSlot(
      page,
      `top-${category}`,
      top
        .map((g) => {
          const { title } = textOf(g, zh);
          const cover = g.cover
            ? `<span class="game-cover"><img src="${escape(g.cover)}" alt="" loading="lazy" decoding="async"/></span>`
            : `<span class="game-cover drawn"></span>`;
          return `<li><a href="${sitePath(`/play/${g.id}/`, zh)}" title="${escape(title)}">${cover}<span>${escape(title)}</span></a></li>`;
        })
        .join(""),
    );
  }, html);
}

/** The exported sitemap with every indexable game added, in both languages. */
export function sitemapWithGames(xml, records) {
  const live = new Map(
    records
      .map((r) => [r.id, indexableGame(r)])
      .filter(([, version]) => version),
  );
  const ids = [...live.keys()].sort();
  if (!ids.length) return xml;
  // When the live version was approved (or, for dingn's own, published).
  const lastmod = (id) => {
    const at = live.get(id).reviewedAt ?? live.get(id).publishedAt;
    return typeof at === "string" && !Number.isNaN(Date.parse(at))
      ? `\n<lastmod>${new Date(at).toISOString()}</lastmod>`
      : "";
  };
  const links = (id) =>
    [
      ["en", pageUrl(id, false)],
      ["zh-CN", pageUrl(id, true)],
      ["x-default", pageUrl(id, false)],
    ]
      .map(
        ([lang, href]) =>
          `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}" />`,
      )
      .join("\n");
  const entries = ids
    .flatMap((id) =>
      [false, true].map(
        (zh) =>
          `<url>\n<loc>${pageUrl(id, zh)}</loc>${lastmod(id)}\n${links(id)}\n</url>`,
      ),
    )
    .join("\n");
  return xml.replace("</urlset>", `${entries}\n</urlset>`);
}
