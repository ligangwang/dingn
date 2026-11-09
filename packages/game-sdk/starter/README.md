# dingn starter game

A complete game for [dingn](https://dingn.com) in three files. It uses the
dingn game SDK for the player's language, name, saved scores and sign-in.

## Try it

1. Serve this folder on your computer, for example:

   ```sh
   npx serve --cors -l 5173 .
   ```

   The server must allow other origins (CORS), because dingn runs games in a
   sandbox with no origin of their own. With Vite, set `server.cors: true`.

2. Open <https://dingn.com/developers/playground/> in Chrome or Firefox,
   enter `http://localhost:5173/` and press **Load**. The playground runs your
   game the way dingn will, and lets you switch language and sign a test
   player in or out.

Opened directly at `http://localhost:5173/`, the game also works on its own:
signed out, and scores last until the page closes.

## Make it yours

- Change `game.json`: `id` (lowercase letters and digits), `title`,
  `description` and `version`. Every new release needs a new version.
- Use relative paths (`style.css`, `img/hero.png`) for your files. Your game
  is served from its own folder, not the site root.
- Save with `dingn.storage` and `dingn.progress`, not `localStorage` or
  cookies, which the dingn sandbox blocks.
- Award badges and dingn coins: list them under `badges` in `game.json` and
  call `dingn.rewards.unlock(id)` when a player earns one, for example after
  passing a level. Each badge pays once per player.
- Call `dingn.ready()` once the game can be played.

The full guide and SDK reference: <https://dingn.com/developers/>.
