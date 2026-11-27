#!/usr/bin/env node
// Packs a dingn game for itch.io (or any site that wants an uploaded HTML5
// build rather than a link).
//
//   npm run package:itch -- <game id> [--lang ja] [--out dist-itch]
//
// itch.io plays a zip that has an index.html. This writes one whose page is
// nothing but dingn's embedded player of the game (/embed/<id>/, see
// "Embedding a game in another website" in docs/game-platform.md), so the
// game on itch.io is always dingn's live version, played as a guest, with
// "Play on dingn" leading back. Next to the zip it leaves the game's cover
// and a listing.txt with the text and settings to enter on itch.io.
//
// It reads the game from dingn.com's public API, so it needs no credentials
// and packs only a game that is listed and reviewed. Uploading is done by
// hand on itch.io, under your own account.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ID } from "./game-registry.mjs";
import { isLocale, localeInfo, pick } from "./i18n.mjs";
import { zip } from "./zip.mjs";

const SITE = "https://dingn.com";
/** What the frame may do: as the play page's "Embed this game" code. */
const ALLOW =
  "fullscreen; autoplay; gamepad; accelerometer; gyroscope; clipboard-write; web-share";
/** The size itch.io is told to show the game at. */
export const ITCH_SIZE = { width: 960, height: 600 };

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** The embedded player's address of a game, in a language. */
export const embedAddress = (id, locale = "en") =>
  `${SITE}${localeInfo(locale).path}/embed/${id}/`;

/** The uploaded page: the embedded player, filling the frame itch.io gives it. */
export function itchPage(game, locale = "en") {
  const title = escape(pick(game.title, locale) || game.id);
  const src = embedAddress(game.id, locale);
  const play = `${SITE}${localeInfo(locale).path}/play/${game.id}/?ref=itch`;
  return `<!doctype html>
<html lang="${escape(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body { height: 100%; margin: 0; background: #151923; }
      iframe { display: block; width: 100%; height: 100%; border: 0; }
      a { color: #d5ff58; font: 16px sans-serif; }
    </style>
  </head>
  <body>
    <iframe src="${src}" title="${title}" allow="${ALLOW}" allowfullscreen>
      <a href="${play}">${title}</a>
    </iframe>
  </body>
</html>
`;
}

/** What to type into itch.io's "Create a new project" page. */
export function itchListing(game, locale = "en") {
  const title = pick(game.title, locale) || game.id;
  const description =
    (game.description && pick(game.description, locale)) || "";
  const play = `${SITE}${localeInfo(locale).path}/play/${game.id}/?ref=itch`;
  return `${title}: itch.io listing

Title
  ${title}

Short description or tagline
  ${description}

Kind of project
  HTML

Uploads
  ${game.id}-itch.zip, with "This file will be played in the browser" ticked

Embed options
  Viewport dimensions: ${ITCH_SIZE.width} x ${ITCH_SIZE.height}
  Tick "Mobile friendly" and "Fullscreen button"

Cover image
  The cover file in this folder (itch.io asks for 630 x 500 or larger, and
  crops other shapes)

Description (suggested)
  ${description}

  Play in your browser, free. Challenge friends to beat your score, earn
  coins and badges, and find more games on dingn: ${play}

Notes
  - The game on itch.io is dingn's live version: publishing a new version on
    dingn updates it there with no new upload.
  - Players on itch.io are guests. Signing in and saved scores are on dingn.
  - itch.io's quality guidelines apply to your account, so list a game there
    only with its developer's agreement.
`;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const fail = (message) => {
    console.error(`\n✗ ${message}\n`);
    process.exit(1);
  };
  const id = args.find(
    (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"),
  );
  const locale = option("--lang") ?? "en";
  if (!id || !ID.test(id))
    fail(
      "Usage: npm run package:itch -- <game id> [--lang ja] [--out dist-itch]",
    );
  if (!isLocale(locale)) fail(`dingn has no language "${locale}".`);

  const response = await fetch(`${SITE}/api/games/${id}`).catch(() => null);
  if (!response) fail("dingn.com could not be reached.");
  if (response.status === 404) fail(`dingn has no game "${id}".`);
  if (!response.ok) fail(`dingn.com answered ${response.status}.`);
  const game = await response.json();
  // The embedded player plays only a reviewed version.
  if (game.preview)
    fail(`"${id}" has no reviewed live version yet, so it can't be embedded.`);

  const out = path.resolve(option("--out") ?? "dist-itch", id);
  mkdirSync(out, { recursive: true });
  const archive = path.join(out, `${id}-itch.zip`);
  writeFileSync(archive, zip({ "index.html": itchPage(game, locale) }));
  writeFileSync(path.join(out, "listing.txt"), itchListing(game, locale));
  const made = [archive, path.join(out, "listing.txt")];
  if (game.cover) {
    const cover = await fetch(SITE + game.cover).catch(() => null);
    if (cover?.ok) {
      const file = path.join(out, `cover${path.extname(game.cover)}`);
      writeFileSync(file, Buffer.from(await cover.arrayBuffer()));
      made.push(file);
    }
  }
  console.log(
    `Packed ${pick(game.title, locale)} ${game.version} for itch.io:\n` +
      made.map((file) => `  ${path.relative(process.cwd(), file)}`).join("\n") +
      `\nUpload the zip at https://itch.io/game/new and follow listing.txt.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
