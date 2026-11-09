// Search engines and link previews for published games. Every game plays on
// the one exported page, /play/index.html, whose title and links are the
// generic "Play" ones and which says noindex. For a game that is listed and
// has a reviewed live version, the server fills in that game's own title,
// description and addresses before sending the page, and adds the game to
// the sitemap. Hidden, previewed and taken-down games stay noindex.
import { isPreview, resolveVersion } from "./game-registry.mjs";

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

/**
 * The play page for one game: `html` with that game's title, description,
 * robots and addresses when it may be indexed, otherwise `html` unchanged.
 */
export function gamePageHtml(html, record, zh) {
  const live = indexableGame(record);
  if (!live) return html;
  const id = record.id;
  const lang = zh ? "zh" : "en";
  const title = escape(live.title?.[lang] || live.title?.en || id);
  const description = live.description?.[lang] || live.description?.en;
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title} · dingn</title>`],
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
    );
  return swaps.reduce((page, [from, to]) => page.replace(from, to), html);
}

/** The exported sitemap with every indexable game added, in both languages. */
export function sitemapWithGames(xml, records) {
  const ids = records
    .filter(indexableGame)
    .map((r) => r.id)
    .sort();
  if (!ids.length) return xml;
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
        (zh) => `<url>\n<loc>${pageUrl(id, zh)}</loc>\n${links(id)}\n</url>`,
      ),
    )
    .join("\n");
  return xml.replace("</urlset>", `${entries}\n</urlset>`);
}
