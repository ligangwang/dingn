"use client";
// The developer guide at /developers/: how to build a game for dingn with
// the game SDK. The SDK and starter are served from /sdk/v1/
// (scripts/build-sdk.mjs).
import Link from "next/link";
import { useLocale } from "./locale";

const IMPORT = `import { connect } from "https://dingn.com/sdk/v1/dingn-sdk.js";

const dingn = await connect();`;

const MANIFEST = `{
  "id": "mygame",
  "version": "1.0.0",
  "title": { "en": "My Game", "zh": "我的游戏" },
  "description": { "en": "…", "zh": "…" },
  "entry": "index.html"
}`;

const REFERENCE: [string, string][] = [
  [
    "dingn.locale",
    'The player\'s language, "en" or "zh-CN". Show your game in it.',
  ],
  [
    "dingn.player",
    "{ signedIn, name, avatar }. Never an email address or account id.",
  ],
  [
    "dingn.onPlayer(fn)",
    "Called when the player signs in or out. Returns a function that stops listening.",
  ],
  [
    "dingn.storage.get(key)\ndingn.storage.set(key, value)",
    "Saves JSON on this device only. Keys are up to 64 letters, digits, dots, dashes or underscores. Values are up to 16 KB.",
  ],
  [
    "dingn.progress.load()\ndingn.progress.save(data)",
    'Saves JSON to the signed-in player\'s account, so it follows them to any device. Up to 16 KB. save() fails with the code "signed_out" when no one is signed in.',
  ],
  [
    "dingn.requestSignIn()",
    "Sends the player to sign in. They come back to your game afterwards.",
  ],
  [
    "dingn.navigate(path)",
    'Leaves your game for a dingn page, such as "/" for the game list.',
  ],
  [
    "dingn.ready()",
    "Hides dingn's loading screen. Call it once your game can be played.",
  ],
];

const SANDBOX_RULES = [
  "Your game runs in its own isolated origin. It cannot read dingn's pages, cookies or the player's account.",
  "localStorage, sessionStorage, IndexedDB and cookies are blocked. Use dingn.storage and dingn.progress instead.",
  "Load your own files with relative paths, such as img/hero.png. Each version of a game is served from its own folder.",
  "Full screen, sound, game controllers and pointer lock work. Links open in a new tab.",
  "Requests to other servers need CORS, because your game's origin is opaque.",
];

/** A link to the developer guide in the current language, for the footer. */
export function DevelopersLink() {
  const { t, href } = useLocale();
  return <Link href={href("/developers/")}>{t("Developers")}</Link>;
}

export function Developers() {
  const { t, href } = useLocale();
  return (
    <div className="container dev-page">
      <p className="eyebrow">{t("FOR GAME DEVELOPERS")}</p>
      <h1>{t("Make a game for dingn")}</h1>
      <p className="dev-lead">
        {t(
          "dingn games are web pages: HTML, CSS and JavaScript, made with any engine or framework that builds static files. They run in a secure frame on dingn.com and use the dingn game SDK for the player's language and name, saved progress and sign-in.",
        )}
      </p>
      <p className="dev-actions">
        <a className="button" href="/sdk/v1/starter.zip" download>
          {t("Download the starter game")}
        </a>
        <Link
          className="button secondary"
          href={href("/developers/playground/")}
        >
          {t("Open the playground")}
        </Link>
      </p>

      <h2>{t("Get started in three steps")}</h2>
      <ol className="dev-steps">
        <li>{t("Download the starter game and unzip it.")}</li>
        <li>
          {t("Serve the folder on your computer:")}
          <pre>
            <code>npx serve --cors -l 5173 dingn-starter</code>
          </pre>
          {t(
            "Your server must allow other origins (CORS), because dingn runs games in a sandbox. With Vite, set server.cors to true.",
          )}
        </li>
        <li>
          {t(
            "Open the playground, enter http://localhost:5173/ and press Load. Edit the files, then press Reload game to see your changes.",
          )}
        </li>
      </ol>

      <h2>{t("Add the SDK to your game")}</h2>
      <p>
        {t(
          "Import it from dingn. It works in any modern browser, with or without a bundler.",
        )}
      </p>
      <pre>
        <code>{IMPORT}</code>
      </pre>
      <p>
        {t("Using TypeScript? Download the type definitions:")}{" "}
        <a href="/sdk/v1/dingn-sdk.d.ts" download>
          dingn-sdk.d.ts
        </a>
      </p>
      <p>
        {t(
          "Opened outside dingn, connect() still works: signed out, in the browser's language, with storage that lasts until the page closes.",
        )}
      </p>

      <h2>{t("SDK reference")}</h2>
      <div className="dev-table-wrap">
        <table className="dev-table">
          <thead>
            <tr>
              <th scope="col">{t("Call")}</th>
              <th scope="col">{t("What it does")}</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCE.map(([call, text]) => (
              <tr key={call}>
                <td>
                  <code>{call}</code>
                </td>
                <td>{t(text)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("Rules of the sandbox")}</h2>
      <ul>
        {SANDBOX_RULES.map((rule) => (
          <li key={rule}>{t(rule)}</li>
        ))}
      </ul>

      <h2>game.json</h2>
      <p>
        {t(
          "Every game has a game.json next to its index.html. It names the game in English and Chinese:",
        )}
      </p>
      <pre>
        <code>{MANIFEST}</code>
      </pre>
      <p>
        {t(
          "The id is 2 to 31 lowercase letters and digits, starting with a letter. Every release needs a new version, because published versions never change.",
        )}
      </p>

      <h2>{t("Publishing on dingn")}</h2>
      <p>
        {t(
          "Publishing for outside developers is coming soon: you will upload your game on dingn, and it goes live after a review. To be among the first, tell us about your game.",
        )}
      </p>
      <p>
        <Link href={href("/feedback/")}>{t("Tell us about your game →")}</Link>
      </p>
    </div>
  );
}
