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

## Search engines

Every game plays on the one exported page, `/play/index.html`, which says noindex. When the server sends `/play/<id>/` for a game that is **listed** and whose live version is reviewed (or belongs to dingn), it fills in that game's title and description from `game.json`, plus its own canonical, hreflang and Open Graph addresses, and switches it to `index, follow` (`scripts/game-seo.mjs`). `/sitemap.xml` gets the same games added in both languages. Hidden, previewed and taken-down games stay noindex. If the registry can't be read within two seconds, the page goes out as exported.

## Trying it locally

```sh
npm run publish:game -- hello --local          # writes .games-local/
npm run build
npm run preview -- --local-games               # http://127.0.0.1:3001/play/hello/
```

## Outside developers

`developer.dingn.com` and `dev.dingn.com` redirect to these pages
(`developerRedirect` in `scripts/locale-redirect.mjs`) once the domain is
mapped to the `dingn-web` Cloud Run service (Cloud Run → Manage custom
domains → Add mapping, then the DNS record it shows).

The SDK is public at `https://dingn.com/sdk/v1/dingn-sdk.js`, readable from
any origin and cached for an hour. `/developers/` is the guide, with a
starter game to download (`/sdk/v1/starter.zip`, from
`packages/game-sdk/starter/`) and the SDK reference. `/developers/playground/`
runs a game from any http(s) address, such as a developer's
`http://localhost:5173/`, in the same sandbox as `/play/<id>/`. It answers
SDK calls through the same bridge, with a test player and storage that lasts
until the page closes, and logs every call.

### Signing up

Anyone signed in with a verified email (a Google account, for example) can
become a developer on `/developers/games/` by accepting the developer
agreement (`/developers/agreement/`). That sets the `developer: true` claim
and records the acceptance in Firestore `developers/{uid}` (agreement
version and time). Admins can also add a developer by email on
`/admin/games/` (Developers). Removing one there sets `developerBlocked`, so
they cannot sign up again by themselves.

The agreement's version is `AGREEMENT_VERSION` in both
`scripts/developer-games.mjs` and `src/components/developer-agreement.tsx`;
change both together (a test checks they match). The text is plain-language
terms, not reviewed by a lawyer.

### Uploads

The developer uploads a zip of their built game on `/developers/games/`
(`scripts/developer-games.mjs`):

1. The zip is checked: at most 20 MB zipped, 50 MB unpacked and 1000 files;
   `game.json` and the entry page at the top (or inside one folder); only web
   file types (`types` in `scripts/game-registry.mjs`) and safe names.
2. The id and version are reserved in the registry. A game belongs to the
   developer who first uploads its id (`owner`), so nobody else can upload to
   it, and dingn's own games (no owner) cannot be uploaded to.
3. The files are stored at `games/<id>/<version>/` like any published version,
   and the version becomes the game's beta.

A developer can also upload from a script or CI with an **upload key**
(`scripts/upload-keys.mjs`). They create one on `/developers/games/` (up to 5,
each shown once; only a SHA-256 hash is stored in `developers/{uid}.keys`) and
send the zip to `/api/developer/games/upload` with
`Authorization: Bearer dgk.<uid>.<id>.<secret>`. Such a request has no session
and skips the browser origin check. Every use reads the account's current
claims, so removing or blocking a developer stops their keys at once. The
upload then follows the same steps, limits and review as one from the page.

An upload is a preview until an admin makes it live (`reviewedAt` on the
version): `/play/<id>/` shows a "not reviewed yet" notice on previews, and a
new game has no live version, so only its `?v=` links play it. Game pages
opened directly at `/g/…` redirect to the player, so a game always appears
inside dingn's player with its notices.

Limits (`LIMITS`): a developer can own 10 games and upload 20 versions in
24 hours. Admins have no limits.

### Moving a game to its own repository

dingn's own games (no owner) are published from this repository by CI. To
publish one the same way as an outside developer, from its own repository,
an admin uses **Transfer to a developer** on its card in `/admin/games/` and
enters the email of a developer account (it must have signed up). The game
then belongs to that account: its existing versions stay reviewed and keep
playing, and new versions are uploaded on `/developers/games/` and approved
in the review queue like any other game. Remove its folder from `games/`
afterwards so CI stops publishing it.

### Review queue

`/admin/games/` lists uploads waiting for review. **Approve** makes the
version live (and marks it reviewed); **Send back** asks for a reason, clears
the beta and shows the reason to the developer on `/developers/games/`.

### Reports and take-down

Signed-in players can report a game from its player page (reason and
optional details, 10 reports an hour per account), stored in Firestore
`gameReports`. Open reports appear on `/admin/games/`, where an admin
dismisses one or takes the game down. **Take down** (also on each game's
card) asks for a reason and sets the game's status to `removed`: its player
page, API and files answer 404 and it cannot be uploaded to. **Restore**
brings it back, unlisted.

### Play counts

The player page counts a play each time a game opens
(`POST /api/game-plays`). Each server instance adds them up and writes them to
Firestore `gameStats/{id}` (a total and a count per UTC day) about once a
minute. Developers see the last 7 days, 30 days and total on
`/developers/games/`, and admins on `/admin/games/`.

### Emails

Developers get an email when a version is approved, sent back, taken down or
restored, and reviewers get one for every upload and report. Emails are
queued in Firestore `mail` in the format of Firebase's **Trigger Email from
Firestore** extension, which sends them once it is installed with an SMTP
account (Firebase console → Extensions). Until then they stay queued.
Reviewers are the addresses in the `REVIEW_EMAIL` setting (comma-separated),
set once on the Cloud Run service; deploys keep it:

```sh
gcloud run services update dingn-web --region us-central1 \
  --update-env-vars REVIEW_EMAIL=you@example.com
```

The new Firestore collections (`developers`, `gameReports`, `gameStats`,
`mail`) are server-only: `firestore.rules` denies browsers every read and
write, so deploy the rules with `firebase deploy --only firestore:rules`.

The website's runtime account needs two extra roles for uploads, granted
once:

```sh
gcloud storage buckets add-iam-policy-binding gs://dingn-193716-games \
  --member=serviceAccount:dingn-web-runtime@dingn-193716.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
gcloud projects add-iam-policy-binding dingn-193716 \
  --member=serviceAccount:dingn-web-runtime@dingn-193716.iam.gserviceaccount.com \
  --role=roles/firebaseauth.admin
```

The first lets the server store uploaded files. The second lets admins grant
developer access, including self sign-up. Writing the registry and the
platform's other collections uses the account's existing Firestore access.

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
await dingn.rewards.unlock("level-10"); // a badge from game.json
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

## Badges and coins

Players earn dingn coins and badges for passing levels. Coins are one balance
for the whole site, shown next to the player's avatar; badges show on the
game's page and the player's account page. A game lists the badges it can
award in `game.json`:

```json
"badges": [
  { "id": "level-10", "tier": "silver", "level": 10,
    "title": { "en": "Clear level 10", "zh": "通过第 10 关" } },
  { "id": "trex", "tier": "gold", "icon": "boss",
    "title": { "en": "Beat the T-Rex", "zh": "打败霸王龙" } }
]
```

- `tier` is `bronze`, `silver`, `gold` or `diamond`. dingn draws the medal:
  a level badge shows its `level` number, and any other badge shows an `icon`
  (`boss`, `stars`, `star`, `squad`, `trophy`, `crown`, `bolt`, `heart`,
  `target` or `clock`).
- dingn, not the game, sets what a badge pays, by tier and the same in every
  game: bronze 10 coins, silver 25, gold 50, diamond 100 (`TIER_COINS`).
  Review checks that a badge's tier matches how hard it is to earn.
- Up to 50 badges, paying at most 1,000 coins in all.
- The game calls `dingn.rewards.unlock(id)` when the player earns one. dingn
  shows a "Badge earned" popup over the game and returns `{ new, coins }`;
  `new` is false when the player already had it.
- Each badge also adds account XP, twice what its tier pays in coins
  (`BADGE_XP` in `src/data/kingdom.mjs`: bronze 20, silver 50, gold 100,
  diamond 200), so players of every game level up their dingn account. The
  XP goes to `players/{uid}`, where the brain games keep theirs.

Games run in the player's browser, so dingn cannot prove a level was really
passed. `scripts/rewards.mjs` limits what cheating can win instead: only
badges in the published `game.json` of the version being played count, each
pays once per player, coins per game are capped, and a version dingn has not
reviewed only answers with `test: true` and saves nothing. Each player's coins
and badges are in Firestore `rewards/{uid}`, which only the server can change.
To switch a game's rewards off, set `rewards: "off"` on its registry record.

### The kingdom

Every account gets a 3D kingdom at `/kingdom/` that grows with the account
level: a camp at level 2, then a village (4), town (6), city (10), kingdom
(15) and capital (20), each with more land. Players spend coins on buildings
and hall upgrades. The rules are in `src/data/kingdom.mjs`, which the page and
the server (`scripts/kingdom.mjs`, `POST /api/kingdom/me|build|move`) both
read; the kingdom is kept in `rewards/{uid}` as `kingdom: { hall, tiles }`, so
a building and its coins are one write. Games need no change to feed it.

Badges earned before badges gave XP are paid when the player next earns a
badge or opens the kingdom, or all at once by the Website workflow's
`badge-xp` migration (`scripts/backfill-badge-xp.mjs`). `xpPaid` in
`rewards/{uid}` records what was paid, so nothing is paid twice.

### Coins for play

Badges pay once, so a game can also pay a few coins for play itself, such as
a failed level that still got somewhere: `dingn.rewards.earn(coins)`.

- 1 to 10 coins a call (`MAX_EARN`), and at most 30 coins a day from each game
  to each player (`DAILY_GAME_COINS`, by UTC day). Past that, `earn()` returns
  `{ coins: 0, left: 0 }`. It returns `{ coins, left }`, where `left` is what
  the game can still pay today.
- This allowance is separate from the 1,000 coins a game's badges can pay.
- dingn shows "+3" over the game. A version dingn has not reviewed only answers
  with `test: true` and pays nothing.
- `rewards/{uid}` keeps today's payouts in `daily: { day, games }`.

### Spending coins on upgrades

Players spend coins on upgrades a game sells, such as a stronger weapon. A
game lists them in `game.json`; each is bought once and kept:

```json
"shop": [
  { "id": "power-1", "price": 60,
    "title": { "en": "Power +1", "zh": "火力 +1" } },
  { "id": "power-2", "price": 150, "requires": "power-1",
    "title": { "en": "Power +2", "zh": "火力 +2" } }
]
```

- Up to 30 items, each priced from 1 to 1,000 coins. `requires` names an item
  listed earlier that must be bought first, for tiers.
- The game calls `dingn.rewards.spend(id)`. dingn itself asks the player
  "Buy Power +1?" over the game, so a game can never spend coins without the
  player pressing Buy. It returns `{ new, coins }`, or fails with the code
  `cancelled`, `not_enough_coins`, `requires` or `signed_out`.
- `dingn.rewards.shop()` lists the items and which ones the player owns. The
  game applies what is owned (for example, more damage).
- The server charges and records a purchase in one Firestore transaction, so
  coins can't go below zero or be spent twice. A version dingn has not
  reviewed only answers with `test: true` and charges nothing.
- `rewards/{uid}` keeps `spent`, so coins earned in all are `coins + spent`;
  spending never lowers what a player has earned.

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

# Let the deploy account upload the Firestore rules: every website deploy
# (the Deploy Cloud Run job) uploads firestore.rules before the new code.
gcloud projects add-iam-policy-binding dingn-193716 \
  --member=serviceAccount:dingn-github-deploy@dingn-193716.iam.gserviceaccount.com \
  --role=roles/firebaserules.admin
gcloud projects add-iam-policy-binding dingn-193716 \
  --member=serviceAccount:dingn-github-deploy@dingn-193716.iam.gserviceaccount.com \
  --role=roles/serviceusage.serviceUsageConsumer
gcloud projects add-iam-policy-binding dingn-193716 \
  --member=serviceAccount:dingn-github-deploy@dingn-193716.iam.gserviceaccount.com \
  --role=roles/serviceusage.serviceUsageViewer
```

The website's runtime account already reads Firestore, so it needs no change.
If an organization policy blocks public buckets, give `allUsers` access some
other way or serve through a signed proxy instead. Ask before changing it.
