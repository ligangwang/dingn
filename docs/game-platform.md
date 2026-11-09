# dingn game platform

Games are published on their own, without deploying the website. Each game is
a folder under `games/<id>/` that builds to static files. Publishing uploads
those files to a storage bucket at a path that never changes, then moves a
pointer in the game registry. The website reads the registry when a page
loads, so a release, a beta or a rollback reaches players within about 30
seconds and the website never redeploys.

```
games/<id>/          ── npm run publish:game ──▶  gs://dingn-193716-games/games/<id>/<version>/
                                                  Firestore games/<id>: { live, beta, versions }
dingn.com/play/<id>/ ── /api/games/<id> ──▶ live version ──▶ sandboxed frame /g/<id>/<version>/index.html
```

## Parts

| Part                     | Where                                               | What it does                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game                     | `games/<id>/`                                       | `game.json` plus the game's files, or a `package.json` whose `build` script writes `dist/`                                                                                                                                |
| Game SDK                 | `packages/game-sdk/`                                | The only way a game talks to dingn: locale, player, storage, progress, sign-in                                                                                                                                            |
| Publisher                | `scripts/publish-game.mjs`                          | Builds, checks, uploads and updates the registry                                                                                                                                                                          |
| Registry and file server | `scripts/game-registry.mjs`                         | `GET /api/games`, `GET /api/games/<id>?v=`, and game files at `/g/<id>/<version>/…`                                                                                                                                       |
| Player page              | `src/components/game-host.tsx`, `/play/<id>/`       | Runs the game in a sandboxed frame and answers its SDK requests (`src/lib/game-bridge.ts`)                                                                                                                                |
| CI                       | `.github/workflows/website.yml` (Publish games job) | Publishes changed games on merge to main, plus manual beta and rollback. It shares the website's workflow because Google Cloud accepts deploys only from that workflow; a change to games alone skips the website deploy. |

## game.json

```json
{
  "id": "hello",
  "version": "1.0.0",
  "title": { "en": "Star Tap", "zh": "点星星" },
  "description": { "en": "…", "zh": "…" },
  "entry": "index.html"
}
```

`id` is lowercase letters and digits and matches the folder name. Every
publish needs a new `version`, because published versions are never
overwritten.

## Publishing

```sh
npm run publish:game -- hello                 # build, upload, make live
npm run publish:game -- hello --beta          # upload as beta: /play/hello/?v=beta
npm run publish:game -- hello --set-live 1.1.0   # release the beta
npm run publish:game -- hello --set-live 1.0.0   # roll back
npm run publish:game -- hello --listed        # show it in the catalog (--unlisted hides it)
npm run publish:game -- hello --dry-run       # build and check only
```

New games are unlisted: they play at `/play/<id>/` but are not in
`GET /api/games`. Any published version can be opened with
`/play/<id>/?v=<version>`, which helps when testing.

In CI, merging a change to `games/<id>/` with a new version publishes it as
live. To ship a beta or roll back without a local `gcloud`, go to Actions →
Website → Run workflow, and fill in the game id and action.

Admins can also do this on the website at `/admin/games/` (accounts with the
`admin: true` claim, like the feedback inbox). The page lists every published
version of each game, with buttons to make a version live (release or roll
back), set or clear the beta, and show or hide a game in the catalog. It
cannot upload new versions: those always come from the repository through CI.

## Trying it locally

```sh
npm run publish:game -- hello --local          # writes .games-local/
npm run build
npm run preview -- --local-games               # http://127.0.0.1:3001/play/hello/
```

## Writing a game

A static game imports `./dingn-sdk.js`, which the publisher adds next to it.
A built game imports `packages/game-sdk/dingn-sdk.js` and bundles it.

```js
import { connect } from "./dingn-sdk.js";
const dingn = await connect();
dingn.locale; // "en" | "zh-CN"
dingn.player; // { signedIn, name, avatar }
await dingn.storage.set("best", 12); // this device
await dingn.progress.save({ level: 3 }); // the player's account (signed in only)
dingn.requestSignIn();
dingn.ready(); // hides the loading screen
```

The game runs in a sandboxed frame with its own opaque origin, both in the
`sandbox` attribute and in the `Content-Security-Policy: sandbox` header on
its pages. It cannot read the website's cookies, storage or page. Use
`dingn.storage`, not `localStorage`, which the sandbox blocks. Everything a
game sends is checked by `src/lib/game-bridge.ts`. Keys and sizes are
limited, and a game can reach only its own storage
(`dingn.game.<id>.<key>`) and progress (`accounts/{uid}.game_progress_<id>`).

## One-time Google Cloud setup

Run these once with an owner account before the first publish:

```sh
# The bucket. Published games are public, so it is publicly readable.
gcloud storage buckets create gs://dingn-193716-games \
  --project dingn-193716 --location us-central1 --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://dingn-193716-games \
  --member=allUsers --role=roles/storage.objectViewer

# Let the GitHub deploy account upload games and write the registry.
gcloud storage buckets add-iam-policy-binding gs://dingn-193716-games \
  --member=serviceAccount:dingn-github-deploy@dingn-193716.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
gcloud projects add-iam-policy-binding dingn-193716 \
  --member=serviceAccount:dingn-github-deploy@dingn-193716.iam.gserviceaccount.com \
  --role=roles/datastore.user

# Block browser access to the registry.
firebase deploy --only firestore:rules --project dingn-193716
```

The website's runtime account already reads Firestore, so it needs no change.
If an organization policy blocks public buckets, give `allUsers` access some
other way or serve through a signed proxy instead. Ask before changing it.
