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
administrator role, like the feedback inbox; see "Roles" in the README). The page lists every published
version of each game, with buttons to make a version live (release or roll
back), set or clear the beta, and show or hide a game in the catalog. It
cannot upload new versions: those always come from the repository through CI.

## Search engines

Every game plays on the one exported page, `/play/index.html`, which says noindex. When the server sends `/play/<id>/` for a game that is **listed** and whose live version is reviewed (or belongs to dingn), it fills in that game's title and description from `game.json`, plus its own canonical, hreflang and Open Graph addresses, and switches it to `index, follow` (`scripts/game-seo.mjs`). `/sitemap.xml` gets the same games added in every language. Hidden, previewed and taken-down games stay noindex. If the registry can't be read within two seconds, the page goes out as exported.

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
agreement (`/developers/agreement/`). That gives the account the `developer` role
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

An admin can also review from a script or an assistant with a **review key**,
created and revoked under "Review keys" at the bottom of `/admin/games/` (at
most 5 per admin, shown once, stored as a hash in `developers/{uid}`
`adminKeys`). Send it as `Authorization: Bearer dak.<uid>.<id>.<secret>` in a
JSON POST; it needs no session or website origin:

```bash
# Every game and its versions; `reviewed: false` and no `rejected` = waiting.
curl -sX POST https://dingn.com/api/admin/games \
  -H "Authorization: Bearer $DINGN_REVIEW_KEY" -H "Content-Type: application/json"
# Approve: make the version live.
curl -sX POST https://dingn.com/api/admin/games/update \
  -H "Authorization: Bearer $DINGN_REVIEW_KEY" -H "Content-Type: application/json" \
  -d '{"id":"gemsurge","action":"set-live","version":"1.3.1"}'
# Send back, with the reason the developer receives.
curl -sX POST https://dingn.com/api/admin/games/update \
  -H "Authorization: Bearer $DINGN_REVIEW_KEY" -H "Content-Type: application/json" \
  -d '{"id":"gemsurge","action":"reject","version":"1.3.1","reason":"…"}'
```

A review key can do only those three things; anything else answers 403
`not-allowed-with-key`. It stops working when it is revoked or its account
loses the `administrator` role. Upload keys (`dgk.…`) can never review, so a game's
CI secret cannot approve its own uploads.

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
dingn.locale; // the player's language, one your game.json lists
dingn.onLanguage((locale) => {}); // the player switched language
dingn.player; // { signedIn, name, avatar, tester }: tester is an admin's test account
await dingn.storage.set("best", 12); // this device
await dingn.progress.save({ level: 3 }); // the player's account (signed in only)
await dingn.rewards.unlock("level-10"); // a badge from game.json
dingn.requestSignIn();
dingn.ready(); // hides the loading screen
dingn.roundEnded(); // a round was played to the end (play statistics)
```

### Asking the player to sign in

Every sign-in prompt over a game is dingn's. A game draws no "Sign in to
save your score" text, link or button of its own: it only decides when the
prompt shows.

```js
// On the result of a round, for a signed-out player:
if (!dingn.player.signedIn) dingn.showSignIn(["score", "rewards"]);
// When the next round starts:
dingn.hideSignIn();
```

`showSignIn(reasons)` puts dingn's sign-in box along the bottom of the game,
in the player's language: one line for each reason, a "Sign in free" button
and a button that puts the box away. The reasons say what this player would
gain: `"score"` (their score saved and ranked), `"rewards"` (coins and
badges) and `"progress"` (their progress saved); with none, the box says so
in general words. After `challengeResult` for a signed-out player, dingn
adds that the score will be posted under the challenge, so one box covers
everything. Nothing shows for a signed-in player. Keep the bottom of your
result screen clear of buttons, since the box lies over it.

`requestSignIn()` is still there for a button of the game's own that needs an
account to work (a shop, a "join this challenge"): it sends the player
straight to the sign-in page.

### Languages

dingn speaks English (its own language, at the original URLs) and every
language that has a pack in `locales/` (see "Language packs" below). A game
lists the languages it speaks in `game.json`, and may give its title and
description in each:

```json
"title": { "en": "Sky Hop", "zh": "跳跳云", "es": "Salto al cielo" },
"languages": ["en", "zh-CN", "es"]
```

`languages` must include `"en"`. A game that lists none speaks English and
Chinese, as every game did before. dingn gives the game the player's language
as `dingn.locale` when the game lists it, and English otherwise, so a game
only ever receives a language it has. When the player switches language while
playing, the page changes in place and calls `dingn.onLanguage(fn)` with the
new one: the game shows its text and pictures in it and keeps the player's
game going. A game that doesn't listen shows the new language on the next
load. A game's own text, pictures and sounds are the game's: keep one file
of text per language (the same shape dingn uses works well) and pick by
`dingn.locale`.

### Challenge links

After a round, a game can ask for a link that challenges a friend to beat
the score on the same round:

```js
const url = await dingn.challengeLink({
  mode: "ladder", // which game mode (1-24 lowercase letters, digits, dashes)
  seed: "2026-11-16", // which round, so the friend plays the same one
  score: 10, // a whole number
  unit: "digits", // points, digits, cards, levels, stars, words or coins
  rules: "u0-0-0-0-0-0", // optional: the round's rules, in the game's terms
});
// → https://dingn.com/play/memory/?c=Xq3v9TzK1bWm
```

The game shares the link itself (`navigator.share` or the clipboard; the
frame allows both). Whoever opens it sees "A friend reached 10 digits in
Memory. Can you beat it?" (with the player's nickname instead of "A friend"
when they are signed in) above the game and in the link preview, and the
game gets the challenge as `dingn.challenge` (null otherwise) to start that
round and compare at the end. When the player opening the link made it themselves (signed in to the
same account, or in the same browser), `dingn.challenge.mine` is true and
the banner says "Your score to beat: 10 digits in Memory." Show it as their
own score to beat rather than a friend's. `rules` (1-64 letters, digits, dots, dashes
or underscores) is for whatever else makes a round fair to compare, such as
the upgrades or helpers the player had: dingn saves it and gives it back
unchanged, and the game plays the friend's round under the same rules. The
words come from dingn
(`src/data/challenge.mjs`), never from the link. Visits through a challenge
link count as "referred" in the funnel.

dingn saves each challenge when the link is made (`scripts/challenges.mjs`,
`POST /api/challenges`), and the link carries only its id, so nobody can
change the score by editing the address. The record is server-only Firestore
`challenges/{id}`: the game, mode, seed, score, unit and rules, the signed-in
player's uid (null for a guest), when it was made, and `public`. A player is
kept only as their uid, on the challenge and on each result: their nickname,
public number and avatar are read from their account when a challenge is
shown, so a player who changes their nickname is renamed everywhere. The link
and its preview name the player ("Ada reached 10 digits in Memory"), or say
"A friend" for a guest. Opening one (`GET /api/challenges/<id>`) shows
nicknames but never a uid.

A level has one challenge. A level is a game's round: the game, `mode`,
`seed` and unit (`challengeRounds/{key}` names the challenge open for it),
whatever `rules` it was played with. Rules are the challenger's own, so the
level's challenge keeps its owner's, and whoever opens it plays under them. The first signed-in player to challenge a level owns
its challenge and can close or delete it. A player who challenges a level
that already has one joins it: their score is posted under it, the link they
get is that challenge's, and dingn tells them their place above the game.
Once it is closed or deleted, the next challenge of the level starts a new
one.

A game can find out first, without posting anything
(`POST /api/challenges/standing`):

```js
const open = await dingn.challengeStanding({ mode, seed, score, unit });
// null, or { name, score, mine, rank, players }
```

It is null when the level has no open challenge (and for a test account,
whose challenges stay its own). Otherwise it names the challenge's owner and
their score to beat, and gives the place this score would take (the
player's best there counts if it is higher) and how many players there would
be. Ask at the end of a round played outside a challenge: with none, offer
"Challenge anyone"; with one, say whose it is and the place, and offer to
join it. Either button calls `challengeLink`, which is what posts the score.
Only a signed-in player joins a level's challenge: a visitor is told the
standing too, as what signing in would bring, but a visitor's
`challengeLink` makes an unlisted challenge of their own. Offer a visitor
`requestSignIn()` there, not "join".

A game that uses `mode: "level"` with the level's number as `seed` gets
the level named ("Level 28") on its challenge cards; a `seed` that is a date
is shown as that day. Links in the old form (`?challenge=…&score=…`) open the game
without a challenge. The score is still the one the game reports: dingn can't
tell if a game in the browser was played fairly, but a saved score can't be
changed afterwards.

### Challenge anyone: results under a challenge

A challenge is open to anyone, and it is a thread: its maker's score comes
first, and everyone who takes it posts their result under it. When the
player finishes the round of `dingn.challenge`, tell dingn their score:

```js
if (dingn.challenge) {
  const { beat, posted, rank, players } = await dingn.challengeResult(12);
}
```

dingn shows the player whether they won, above the game, and lists the
challenge's results there, highest score first (of equal scores, the one made
first). A signed-in player's result is posted (`posted: true`); each player
keeps their best, so playing again can only raise it. A signed-out player is
told the outcome too and invited to sign in, and the score they made is
posted when they come back signed in. A test account's result is checked but
not saved (`test: true`). A game that never calls `challengeResult` still
works as before; its challenges just get no results.

A signed-in player's challenge is listed: on the Challenges page
(`/challenges/`, grouped by game) and, the newest one, at the top of the home
page. A guest's, a test account's and every challenge from before threads
stay unlisted: only their link opens them. So a game's button should say
"Challenge anyone", not "Challenge a friend".

The player who made a challenge (signed in) can close it or delete it, from
its results on the game's page. A closed challenge can still be opened and
played by its link, but takes no more results and leaves the lists. A deleted
one is kept on the server (`deleted`, a soft delete) but nothing shows it:
its link opens the game without a challenge. An admin can do both to any
challenge. Games need do nothing for either.

On the server (`scripts/challenges.mjs`): `POST /api/challenges/<id>/results
{ score }` posts a result; a thread keeps its best 50 in the challenge's own
document (`results`, with `players` counting everyone who posted). `GET
/api/challenges[?game=<id>]` lists the open ones, read from one small
document per game (`challengeBoards/{game}`, the newest 20). `POST
/api/challenges/<id>/close` and `…/delete` are the maker's (or an admin's). Results pay no
coins or XP: the scores are the ones games report.

### Referral coins

A visitor who opens a signed-in player's challenge link, makes a new dingn
account (email confirmed) and opens a game gets 100 coins, and so does
the player who sent the challenge. When the new player comes back and
opens a game on another day, the sender gets 100 more. Every friend
counts, with dingn badges and bonus coins at 3, 10, 25 and 50 friends (100,
300, 750 and 1,500). Existing members swapping links earn nothing, and a
sender is paid for at most 10 new friends a day (more still count toward
the badges). Games need do nothing: the player page notes the challenge a
visitor arrived through and claims as soon as they are signed in with a game
open, without waiting on the game; `scripts/referrals.mjs` checks and pays.

The friend belongs to whoever shared the link, not only the challenge's
maker. Every challenge link a signed-in player copies or shares (from a
game's `challengeLink`, or a challenge card's "Copy link" and "Share") ends
with `&r=` and their public player number, the one in their page's address,
never their uid:

```
https://dingn.com/zh/play/gemsurge/?c=855EEFGoPtxQ&r=1234567890
```

Whoever joins dingn through it is that player's friend. A link without `r`
(a guest's, or an older one) is its challenge maker's, as before. A link
with `r` works for any game page, with or without a challenge.

### The funnel

`/admin/funnel/` shows where players come from and how far they get: visits,
game starts, finished rounds (from `dingn.roundEnded()`), return visits,
players back within a week, challenge links sent and the friends they
brought, by source (`utm_source` or `ref` in the address, a challenge link,
or the referring site). The browser keeps only the day of its first visit
and its source (`src/lib/funnel.ts`), sends counts without an id, and sends
nothing after /opt-out. `scripts/funnel.mjs` adds them up per day in
Firestore `funnelStats/{YYYY-MM-DD}`.

The game runs in a sandboxed frame with its own opaque origin, both in the
`sandbox` attribute and in the `Content-Security-Policy: sandbox` header on
its pages. It cannot read the website's cookies, storage or page. Use
`dingn.storage`, not `localStorage`, which the sandbox blocks. Everything a
game sends is checked by `src/lib/game-bridge.ts`. Keys and sizes are
limited, and a game can reach only its own storage
(`dingn.game.<id>.<key>`) and progress (`accounts/{uid}.game_progress_<id>`).

## Language packs

The website's text in every language but English is a pack in `locales/`,
one file per language:

```json
{
  "name": "Español",
  "lang": "es",
  "path": "/es",
  "strings": { "Play": "Jugar", "Level {0}": "Nivel {0}" }
}
```

Keys are the English text; `{0}`-style placeholders carry numbers and
names. Adding a language is adding a pack: `scripts/build-locales.mjs` (run
before every build and dev server) checks it, lists it in
`src/data/locales.gen.mjs` and copies its text to `/locales/<lang>.json`.
Its pages are built under its `path` (`src/app/[lang]/`), each page carrying
only its own language's text; the language picker, the server's game and
category pages, redirects and `sitemap.xml` (with hreflang for every
language) follow the list. Text a pack lacks shows in English. Page titles
and descriptions (`src/lib/seo.ts`) are translated by the packs too. Coin
prices stay in US dollars in every language.

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

The hall stands on the 3 x 3 tiles around 0,0 (`HALL_RADIUS`) and grows from
a campfire into a village hall, great hall, keep, castle and palace; the land
around it is 5 x 5 tiles at the camp and 10 x 10 at the capital. The buildings
come from the kingdom plugin (`ligangwang/kingdom`, its
`assets/kingdom/` and `CREDITS.md`), served from the live version at
`/rewards/kingdom/<version>/`. Add a model there, in the kingdom repo.

Badges earned before badges gave XP are paid when the player next earns a
badge or opens the kingdom, or all at once by the Website workflow's
`badge-xp` migration (`scripts/backfill-badge-xp.mjs`). `xpPaid` in
`rewards/{uid}` records what was paid, so nothing is paid twice.

### Coins for play

Badges pay once, so a game can also pay a few coins for play itself, such as
a failed level that still got somewhere: `dingn.rewards.earn(coins)`.

- 1 to 10 coins a call (`MAX_EARN`), and at most 500 coins a day from each game
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
  `cancelled`, `not_enough_coins`, `requires` or `signed_out`. A
  `not_enough_coins` error also carries `balance`, the player's coins, so the
  game can show how many more are needed.
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
