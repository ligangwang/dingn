// The picture a challenge link shows where it is shared (WhatsApp, X,
// WeChat, Discord, …): who to beat, their score and the game, drawn fresh for
// each challenge, so the preview is the invitation itself and not only the
// game's cover.
//
//   GET /share/challenge/<id>.png[?l=<language>&s=<score>] → a 1200×630 PNG
//
// The link preview of a challenge names it as its picture
// (scripts/game-seo.mjs). `s` is only there so the address changes when the
// score to beat does, and apps that keep pictures fetch the new one.
//
// Like a challenge's words (src/data/challenge.mjs), everything on the card
// comes from the saved, checked challenge and the game's own title, never
// from the address. The card is an SVG put together here and turned into a
// PNG by resvg. Text is drawn with the fonts the server has: Open Sans
// (public/fonts) for Latin text, and the system's fonts for Chinese,
// Japanese and Korean (the image installs Noto Sans CJK, see the
// Dockerfile). If the picture can't be drawn, the request goes to the
// game's cover instead, so a preview always has one.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, throttle } from "./api.mjs";
import { findChallenge } from "./challenges.mjs";
import { bucket, cachedRecord, localDir } from "./game-registry.mjs";
import { indexableGame } from "./game-seo.mjs";
import { CHALLENGE_ID, roundText, scoreText } from "../src/data/challenge.mjs";
import { avatarPresets } from "../src/data/avatars.mjs";
import { isLocale, pick, translate } from "./i18n.mjs";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const CARD_PATH = /^\/share\/challenge\/([A-Za-z0-9_-]{12})\.png$/;
export const isShareCardPath = (pathname) => CARD_PATH.test(pathname);

/** The address of a challenge's picture, in a language. */
export const shareCardUrl = (site, challenge, locale) =>
  `${site}/share/challenge/${challenge.id}.png?l=${encodeURIComponent(locale)}&s=${challenge.score}`;

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Text as the card can draw it: no emoji or other pictures (the server's
 * fonts have none, and would draw empty boxes) and single spaces.
 */
export const drawable = (text) =>
  String(text ?? "")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}‍️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * About how wide `text` is at a font size, in pixels. The server has no
 * font measurements to hand, so this goes by the kind of character, a little
 * on the wide side: text that fits by this fits when drawn.
 */
export function widthOf(text, size) {
  let ems = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0x1100 && !(code >= 0x2000 && code < 0x2e80))
      ems += 1; // Chinese, Japanese, Korean and full-width forms
    else if (ch === " ") ems += 0.3;
    else if (/[iljI.,:;'!|()[\]]/.test(ch)) ems += 0.34;
    else if (/[mwMW@%]/.test(ch)) ems += 0.92;
    else if (/[A-Z0-9]/.test(ch)) ems += 0.68;
    else ems += 0.6;
  }
  return ems * size;
}

/**
 * `text` at the largest size up to `max` that fits `width`; at the smallest
 * size, text still too long is cut short with "…".
 */
export function fit(text, width, max, min) {
  for (let size = max; size > min; size -= 2)
    if (widthOf(text, size) <= width) return { text, size };
  let cut = [...text];
  while (cut.length > 1 && widthOf(cut.join("") + "…", min) > width) cut.pop();
  return {
    text: cut.length < [...text].length ? cut.join("").trimEnd() + "…" : text,
    size: min,
  };
}

const INK = "#151923";
const LIME = "#D5FF58";
const FONTS = "Open Sans, Noto Sans CJK SC, Noto Sans CJK JP, sans-serif";

/**
 * A challenge's card as SVG. `challenge` is findChallenge()'s (its score is
 * the one to beat, its name the player's nickname or null), `title` the
 * game's title in the language, and `cover` the game's cover as a data:
 * address, or null to draw the card without one.
 */
export function cardSvg({ challenge, title, locale = "en", cover = null }) {
  const t = (text) => translate(text, locale);
  // With a cover the words keep to the left; without, they have the card.
  const room = cover ? 560 : 1072;
  const name = drawable(challenge.name) || t("A player");
  const who = fit(name, room - 84, 40, 28);
  const score = fit(scoreText(challenge, locale, t), room, 124, 56);
  const round = roundText(challenge, t);
  const game = fit(
    drawable(round ? `${title} (${round})` : title),
    room,
    44,
    28,
  );
  const ask = fit(t("Can you beat it?"), room - 72, 38, 26);
  const askWidth = Math.ceil(widthOf(ask.text, ask.size)) + 72;
  const preset = avatarPresets.find((a) => a.id === challenge.avatar);
  const initials = [...(drawable(challenge.name) || "?")]
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // A second outline in the text's own colour stands in for a bold weight,
  // which the server's fonts don't all have.
  const bold = (colour, width) =>
    `stroke="${colour}" stroke-width="${width}" stroke-linejoin="round"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="${FONTS}">` +
    `<defs>` +
    `<radialGradient id="glow" cx="0.12" cy="0.1" r="0.9"><stop offset="0" stop-color="#2b3550"/><stop offset="1" stop-color="${INK}"/></radialGradient>` +
    `<clipPath id="frame"><rect x="664" y="150" width="472" height="295" rx="28"/></clipPath>` +
    `</defs>` +
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow)"/>` +
    `<rect y="${CARD_HEIGHT - 10}" width="${CARD_WIDTH}" height="10" fill="${LIME}"/>` +
    // dingn's mark (public/dingn-mark.svg) and name.
    `<g transform="translate(64 52) scale(0.6)">` +
    `<path d="M18 12h31c25 0 39 15 39 37 0 19-12 34-30 37L47 73 35 86 24 73 12 82V24a12 12 0 0 1 6-12Z" fill="${LIME}"/>` +
    `<rect x="29" y="33" width="12" height="23" rx="6" fill="${INK}"/>` +
    `<rect x="54" y="29" width="12" height="23" rx="6" fill="${INK}"/>` +
    `<path d="m67 8 4-7 4 7 8 3-8 3-4 7-4-7-8-3 8-3Z" fill="${LIME}"/>` +
    `</g>` +
    `<text x="134" y="96" font-size="40" fill="#ffffff" ${bold("#ffffff", 1.5)}>dingn</text>` +
    // Who to beat.
    `<circle cx="96" cy="212" r="32" fill="${preset?.color ?? "#74b9ff"}"/>` +
    `<text x="96" y="223" font-size="30" text-anchor="middle" fill="${INK}" ${bold(INK, 1.2)}>${escape(initials)}</text>` +
    `<text x="148" y="${212 + who.size * 0.34}" font-size="${who.size}" fill="#ffffff">${escape(who.text)}</text>` +
    // Their score, the biggest thing on the card.
    `<text x="62" y="372" font-size="${score.size}" fill="${LIME}" ${bold(LIME, Math.max(2, score.size / 34))}>${escape(score.text)}</text>` +
    `<text x="64" y="440" font-size="${game.size}" fill="#ffffff" fill-opacity="0.82">${escape(game.text)}</text>` +
    // The invitation.
    `<rect x="64" y="486" width="${askWidth}" height="76" rx="38" fill="${LIME}"/>` +
    `<text x="${64 + askWidth / 2}" y="${524 + ask.size * 0.35}" font-size="${ask.size}" text-anchor="middle" fill="${INK}" ${bold(INK, 1.2)}>${escape(ask.text)}</text>` +
    (cover
      ? `<rect x="656" y="142" width="488" height="311" rx="34" fill="#ffffff" fill-opacity="0.14"/>` +
        `<image x="664" y="150" width="472" height="295" preserveAspectRatio="xMidYMid slice" clip-path="url(#frame)" xlink:href="${escape(cover)}"/>`
      : "") +
    `</svg>`
  );
}

/**
 * Picture types the card can draw, by a cover's extension. (resvg reads no
 * WebP or AVIF: a game with such a cover gets a card of words alone.)
 */
const COVER_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};
/** The largest cover the card reads: bigger ones are left off it. */
const MAX_COVER_BYTES = 3_000_000;

// Things kept a while, newest last; the oldest goes when a map is full.
function keep(map, key, value, most) {
  map.delete(key);
  map.set(key, value);
  if (map.size > most) map.delete(map.keys().next().value);
  return value;
}
const covers = new Map();
const cards = new Map();
/** Forgets the kept covers and cards (between tests). */
export function forgetShareCards() {
  covers.clear();
  cards.clear();
}

/** A live version's cover as a data: address, or null (none, too big, unreadable). */
async function coverOf(id, live) {
  const type =
    typeof live.cover === "string" &&
    COVER_TYPES[path.extname(live.cover).toLowerCase()];
  if (!type) return null;
  const key = `${id}/${live.version}/${live.cover}`;
  if (covers.has(key)) return covers.get(key);
  let bytes = null;
  try {
    if (localDir()) {
      bytes = await readFile(
        path.join(localDir(), "games", id, live.version, live.cover),
      );
    } else {
      const object = ["games", id, live.version, ...live.cover.split("/")]
        .map(encodeURIComponent)
        .join("/");
      const response = await fetch(
        `https://storage.googleapis.com/${bucket()}/${object}`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (response.ok) bytes = Buffer.from(await response.arrayBuffer());
    }
  } catch {
    // The card is drawn without it.
  }
  const data =
    bytes && bytes.length <= MAX_COVER_BYTES
      ? `data:${type};base64,${bytes.toString("base64")}`
      : null;
  // A cover that couldn't be read is asked for again next time.
  return bytes ? keep(covers, key, data, 30) : null;
}

/** The server's own font file, in the exported site or the repository. */
const fontFiles = () =>
  ["out/fonts/OpenSans-Regular.ttf", "public/fonts/OpenSans-Regular.ttf"]
    .map((file) => path.resolve(file))
    .filter((file) => existsSync(file))
    .slice(0, 1);

/** An SVG as PNG bytes. Drawn off the server's main thread. */
export async function pngOf(svg) {
  const { renderAsync } = await import("@resvg/resvg-js");
  const image = await renderAsync(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH },
    font: {
      fontFiles: fontFiles(),
      loadSystemFonts: true,
      defaultFontFamily: "Open Sans",
    },
  });
  return image.asPng();
}

/**
 * The card of the saved challenge `id` as PNG bytes, or null when there is
 * no such challenge or its game isn't one dingn shows. Kept a while, so a
 * link shared in a busy group is drawn once.
 */
export async function shareCard(id, locale, find = findChallenge) {
  const challenge = await find(id);
  if (!challenge) return null;
  const live = indexableGame(await cachedRecord(challenge.game));
  if (!live) return null;
  const title = (live.title && pick(live.title, locale)) || challenge.game;
  const key = JSON.stringify([
    challenge.id,
    locale,
    challenge.score,
    challenge.name,
    challenge.avatar ?? "",
    live.version,
    title,
  ]);
  if (!cards.has(key)) {
    const drawn = (async () =>
      pngOf(
        cardSvg({
          challenge,
          title,
          locale,
          cover: await coverOf(challenge.game, live),
        }),
      ))();
    keep(cards, key, drawn, 60);
    // A failed drawing is tried again by the next request.
    drawn.catch(() => cards.delete(key));
  }
  return { png: await cards.get(key), challenge, live };
}

/** GET /share/challenge/<id>.png */
export async function handleShareCard(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const id = CARD_PATH.exec(pathname)?.[1];
  const asked = new URL(req.url, "http://localhost").searchParams.get("l");
  const locale = asked && isLocale(asked) ? asked : "en";
  let game = null;
  try {
    throttle(req);
    if (!id || !CHALLENGE_ID.test(id)) throw new ApiError(404, "not-found");
    // Known before drawing, for the cover to fall back on.
    game = (await findChallenge(id))?.game ?? null;
    const card = await shareCard(id, locale);
    if (!card) throw new ApiError(404, "not-found");
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": String(card.png.length),
      // The address carries the score, so a changed challenge has a new one.
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    });
    res.end(req.method === "HEAD" ? undefined : card.png);
  } catch (error) {
    if (error instanceof ApiError) {
      res.writeHead(error.status, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
      res.end(error.status === 429 ? "Too many requests" : "Not found");
      return;
    }
    console.error("share card", error);
    // A preview still gets a picture: the game's cover, or dingn's own.
    const live = game
      ? indexableGame(await cachedRecord(game).catch(() => null))
      : null;
    res.writeHead(302, {
      Location: live?.cover
        ? `/g/${game}/${live.version}/${live.cover}`
        : "/og.jpg",
      "Cache-Control": "no-store",
    });
    res.end();
  }
}
