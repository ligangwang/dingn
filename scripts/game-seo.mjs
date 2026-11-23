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
import {
  challengeParts,
  challengeText,
  challengeUrl,
  roundText,
  scoreText,
} from "../src/data/challenge.mjs";
import { avatarPresets } from "../src/data/avatars.mjs";
import { LOCALES, localeInfo, pick, translate } from "./i18n.mjs";

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

const pageUrl = (id, locale) => `${SITE}${localeInfo(locale).path}/play/${id}/`;
const sitePath = (path, locale) => localeInfo(locale).path + path;

/** Each category's name: English, Chinese, and the packs for other languages. */
const CATEGORY_NAMES = {
  casual: { en: "Casual games", zh: "休闲游戏" },
  memory: { en: "Memory games", zh: "记忆游戏" },
  puzzle: { en: "Puzzle games", zh: "益智游戏" },
  adventure: { en: "Adventure games", zh: "冒险游戏" },
};
const MORE = {
  casual: { en: "More casual games", zh: "更多休闲游戏" },
  memory: { en: "More memory games", zh: "更多记忆游戏" },
  puzzle: { en: "More puzzle games", zh: "更多益智游戏" },
  adventure: { en: "More adventure games", zh: "更多冒险游戏" },
};

/** A game's page title (keep in step with src/components/game-host.tsx). */
export const gameTitle = (title, locale) =>
  translate(`${title} – Play free online`, locale);

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
const textOf = (game, locale) => ({
  title: (game.title && pick(game.title, locale)) || game.id,
  description: (game.description && pick(game.description, locale)) || "",
});

/** The games of a category, most played first (as src/lib/catalog.ts). */
export function gamesOf(games, category, locale) {
  return games
    .filter((g) => g.category === category)
    .sort(
      (a, b) =>
        (b.plays?.month ?? 0) - (a.plays?.month ?? 0) ||
        (b.plays?.week ?? 0) - (a.plays?.week ?? 0) ||
        textOf(a, locale).title.localeCompare(textOf(b, locale).title, locale),
    );
}

/** A game card, like GameCard in src/components/catalog.tsx. */
function cardHtml(game, locale) {
  const { title, description } = textOf(game, locale);
  const cover = game.cover
    ? `<span class="game-cover"><img src="${escape(game.cover)}" alt="" loading="lazy" decoding="async"/></span>`
    : `<span class="game-cover drawn"><span class="cover-title">${escape(title)}</span></span>`;
  return `<a class="game-card" href="${sitePath(`/play/${game.id}/`, locale)}">${cover}<span class="game-card-body"><strong>${escape(title)}</strong><span class="game-pitch">${escape(description)}</span></span></a>`;
}

/**
 * The play page for one game: `html` with that game's title, description,
 * robots, addresses, share picture and schema.org data when it may be
 * indexed, otherwise `html` unchanged. `games` is the catalog (/api/games),
 * for the links to the category's other games. When the page was opened
 * through a friend's challenge link, `challenge` is the saved challenge
 * (findChallenge in scripts/challenges.mjs) and the link preview shows the
 * score to beat (src/data/challenge.mjs).
 */
export function gamePageHtml(
  html,
  record,
  locale,
  games = [],
  challenge = null,
) {
  const live = indexableGame(record);
  if (!live) return html;
  const id = record.id;
  const name = (live.title && pick(live.title, locale)) || id;
  const title = escape(name);
  const description = live.description && pick(live.description, locale);
  const category = categoryOf(record, live);
  const cover = live.cover
    ? `${SITE}/g/${id}/${live.version}/${live.cover}`
    : null;
  const swaps = [
    [
      /<title>[^<]*<\/title>/,
      `<title>${escape(gameTitle(name, locale))} · dingn</title>`,
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
      `<link rel="canonical" href="${pageUrl(id, locale)}"/>`,
    ],
    // Every language's address of this game (x-default is English).
    [
      /<link rel="alternate" hrefLang="([^"]+)" href="[^"]*"\/>/g,
      (_, lang) =>
        `<link rel="alternate" hrefLang="${lang}" href="${pageUrl(id, lang === "x-default" ? "en" : lang)}"/>`,
    ],
    [
      /<meta property="og:url" content="[^"]*"\/>/,
      `<meta property="og:url" content="${pageUrl(id, locale)}"/>`,
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
  // Only this game's challenges: an id from another game's link is ignored.
  if (challenge?.game === id) {
    const said = challengeText(
      challenge,
      name,
      locale,
      challenge.name ?? null,
      (text) => translate(text, locale),
    );
    swaps.push(
      [
        /<meta property="og:url" content="[^"]*"\/>/,
        `<meta property="og:url" content="${escape(challengeUrl(SITE, id, challenge.id, locale))}"/>`,
      ],
      [
        /<meta property="og:title" content="[^"]*"\/>/,
        `<meta property="og:title" content="${escape(said.title)}"/>`,
      ],
      [
        /<meta name="twitter:title" content="[^"]*"\/>/,
        `<meta name="twitter:title" content="${escape(said.title)}"/>`,
      ],
      [
        /<meta property="og:description" content="[^"]*"\/>/,
        `<meta property="og:description" content="${escape(said.description)}"/>`,
      ],
      [
        /<meta name="twitter:description" content="[^"]*"\/>/,
        `<meta name="twitter:description" content="${escape(said.description)}"/>`,
      ],
    );
  }
  let page = swaps.reduce(
    (out, [from, to]) =>
      out.replace(from, typeof to === "function" ? to : () => to),
    html,
  );

  const url = pageUrl(id, locale);
  const names = CATEGORY_NAMES[category];
  const crumbs = [
    ["dingn", SITE + sitePath("/", locale)],
    [pick(names, locale, true), SITE + sitePath(`/${category}/`, locale)],
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
          inLanguage: locale,
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
  const others = gamesOf(games, category, locale)
    .filter((g) => g.id !== id)
    .slice(0, 4);
  return fillSlot(
    page,
    "game",
    breadcrumbHtml(crumbs) +
      `<h1>${title}</h1>` +
      (description ? `<p class="lede">${escape(description)}</p>` : "") +
      (others.length
        ? `<h2>${pick(MORE[category], locale, true)}</h2><div class="game-grid">${others
            .map((g) => cardHtml(g, locale))
            .join("")}</div>`
        : ""),
  );
}

/**
 * A category page (/casual/, /zh/puzzle/, …) with its games as links in the
 * page and as a schema.org ItemList.
 */
export function categoryPageHtml(html, games, category, locale) {
  const list = gamesOf(games, category, locale);
  const url = SITE + sitePath(`/${category}/`, locale);
  const name = pick(CATEGORY_NAMES[category], locale, true);
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
          inLanguage: locale,
          isPartOf: { "@id": SITE + sitePath("/", locale) + "#website" },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: list.length,
            itemListElement: list.map((g, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: pageUrl(g.id, locale),
              name: textOf(g, locale).title,
            })),
          },
        },
        breadcrumbJsonLd([
          ["dingn", SITE + sitePath("/", locale)],
          [name, url],
        ]),
      ],
    }),
  );
  return fillSlot(page, "games", list.map((g) => cardHtml(g, locale)).join(""));
}

/** A player's avatar, like Avatar in src/components/avatar.tsx. */
function avatarHtml(choice, name, photo, size) {
  const box = `width:${size}px;height:${size}px`;
  const preset = avatarPresets.find((a) => a.id === choice);
  if (preset)
    return `<span class="avatar avatar-preset " style="${box};font-size:${size * 0.58}px;background:${preset.color}" aria-hidden="true">${preset.emoji}</span>`;
  if (choice !== "initials" && photo)
    return `<img class="avatar avatar-photo " src="${escape(photo)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer"/>`;
  return `<span class="avatar avatar-initials " style="${box};font-size:${size * 0.4}px" aria-hidden="true">${escape((name || "Me").slice(0, 2).toUpperCase())}</span>`;
}

/**
 * The home page's top spot when players have an open challenge: the latest
 * one as its card, like the hero ChallengeCard in
 * src/components/challenge-card.tsx (keep the two in step), so the page
 * arrives showing it. `challenges` is openChallenges() in
 * scripts/challenges.mjs, newest first; "" when no listed game has one.
 */
export function heroChallengeHtml(games, challenges, locale) {
  const latest = challenges.find((c) => games.some((g) => g.id === c.game));
  if (!latest) return "";
  const game = games.find((g) => g.id === latest.game);
  const t = (text) => translate(text, locale);
  const title = challengeParts(
    latest,
    textOf(game, locale).title,
    locale,
    latest.name,
    t,
  )
    .map((part) =>
      part.kind === "text"
        ? escape(part.text)
        : `<span class="challenge-${part.kind}">${
            part.kind === "name"
              ? avatarHtml(latest.avatar ?? "", part.text, latest.photo, 46)
              : ""
          }${escape(part.text)}</span>`,
    )
    .join("");
  const round = roundText(latest, t);
  const results = latest.results ?? (latest.top ? [latest.top] : []);
  const rows = results
    .map((r, i) => {
      const name = escape(r.name ?? t("A player"));
      const who = r.number
        ? `<a href="${sitePath(`/player/${r.number}/`, locale)}">${name}</a>`
        : name;
      return `<li><span class="rank">${i + 1}</span><span class="name">${avatarHtml(r.avatar ?? "", r.name ?? "?", r.photo, 26)}<span class="who">${who}</span></span><span class="pts">${escape(scoreText({ ...latest, score: r.score }, locale, t))}</span></li>`;
    })
    .join("");
  const to = `${sitePath(`/play/${game.id}/`, locale)}?c=${encodeURIComponent(latest.id)}`;
  return (
    `<p class="eyebrow">${escape(t("LATEST CHALLENGE"))}</p>` +
    `<article class="challenge-card hero">` +
    (round ? `<p class="challenge-round">${escape(round)}</p>` : "") +
    `<div class="challenge-card-head"><h1><a class="challenge-title" href="${escape(to)}">${title}</a></h1>` +
    // The page's own button takes over once its scripts run.
    `<span class="challenge-actions"><button type="button" class="quiet-link challenge-share">${escape(t("Copy link"))}</button></span></div>` +
    (rows ? `<ol class="challenge-rows">${rows}</ol>` : "") +
    `</article>` +
    `<p class="hero-more"><a href="${sitePath("/challenges/", locale)}">${escape(t("All challenges →"))}</a></p>`
  );
}

/**
 * The home page with each category card's top three games as links and,
 * when players have an open challenge, the latest one in its top spot.
 */
export function homePageHtml(html, games, locale, challenges = []) {
  const page = fillSlot(
    html,
    "hero-challenge",
    heroChallengeHtml(games, challenges, locale),
  );
  return Object.keys(CATEGORY_NAMES).reduce((page, category) => {
    const top = gamesOf(games, category, locale).slice(0, 3);
    return fillSlot(
      page,
      `top-${category}`,
      top
        .map((g) => {
          const { title } = textOf(g, locale);
          const cover = g.cover
            ? `<span class="game-cover"><img src="${escape(g.cover)}" alt="" loading="lazy" decoding="async"/></span>`
            : `<span class="game-cover drawn"></span>`;
          return `<li><a href="${sitePath(`/play/${g.id}/`, locale)}" title="${escape(title)}">${cover}<span>${escape(title)}</span></a></li>`;
        })
        .join(""),
    );
  }, page);
}

/** The exported sitemap with every indexable game added, in every language. */
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
      ...LOCALES.map((l) => [l.lang, pageUrl(id, l.lang)]),
      ["x-default", pageUrl(id, "en")],
    ]
      .map(
        ([lang, href]) =>
          `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}" />`,
      )
      .join("\n");
  const entries = ids
    .flatMap((id) =>
      LOCALES.map(
        (l) =>
          `<url>\n<loc>${pageUrl(id, l.lang)}</loc>${lastmod(id)}\n${links(id)}\n</url>`,
      ),
    )
    .join("\n");
  return xml.replace("</urlset>", `${entries}\n</urlset>`);
}
