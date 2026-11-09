# dingn

A website-first memory practice app built with Next.js, React, and TypeScript. Uses the existing `dingn-193716` Firebase project for Google sign-in and Firestore data. The site itself runs on Cloud Run.

## Local development

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3001. The public Firebase configuration defaults to the existing dingn project. Optional overrides are in `.env.example`; never put service-account keys in browser configuration. Google sign-in on a preview requires its hostname to be in Firebase Authentication's authorized domains.

## Validation and production preview

```sh
npm run verify
npm run preview
```

`verify` checks TypeScript, migration compatibility and component behavior, then exports the production website to `out/`. `preview` serves that export on port 3001. The component tests mock Firebase reads/writes and never modify production data. Browser review covers homepage, navigation, sign-in entry, responsive layouts, and direct route loading. Real Google sign-in and Firestore permissions should be checked on the authorized Firebase preview before the first production cutover.

## Existing behavior and data

The homepage feedback link opens `/feedback/`. Signed-in users can submit up to 5,000 characters to the `feedback` Firestore collection. Each record contains the authenticated `uid`, message, server `createdAt`, and `status: new`. Ordinary users can create submissions but cannot read, edit, or delete them. The read-only inbox at `/admin/feedback/` requires a boolean `admin: true` Firebase custom token claim. Administrators can also review submissions in Firebase Console using Google Cloud IAM.

Deploy `firestore.rules` with `firebase deploy --only firestore:rules --project dingn-193716` before releasing the form. These rules preserve legacy collection access but exclude feedback from the old catch-all permission. Test with `npm run test:rules` in an environment with Firebase CLI and Java 21; the tests use only the `demo-dingn-feedback` emulator project.

- `/word/`: random words, previous/next history, exact word search, pronunciation, definitions, and Major System numbers.
- `/number/`: one- through four-digit groups, paginated browsing, exact number search, and saved favorite word associations.
- `/card/`: all 52 original card mappings and images, reveal, previous/next, shuffle, reset, and favorite words.
- `/account/`: player display name, game items and purchase history, a link to the games, and sign-out. Legacy practice pages start with answers hidden; there is no account-level mode selector.
- `/signin/`: Google sign-in with a validated return destination.

The existing `accounts/{uid}`, `numbers/{number}`, `words/{word}`, and `number_favorites/{uid}-{number}` collections and field names are preserved. Writes merge only the supported fields. User accounts do not need to be imported or recreated. Security remains enforced by the existing Firebase Authentication and Firestore rules; no rules or indexes were changed by the migration.

## One-time game item purchases (Stripe)

The account page contains an English/Chinese item shop and account purchase history.
There is no Premium subscription, recurring charge, virtual currency or randomized
reward. This first version supports non-consumable items (one permanent ownership
record per account and item). It does not support consumable bundles.

**The catalog ships empty. No unfinished cosmetics are offered for sale.**
`src/data/shop-items.json` is the server's release allowlist. Before adding an active
item, finish the asset, implement and test its equip/use path in the named game,
and have the game check `shopInventory/{uid}/items/{itemId}` server-side for
`status: owned`. Do not trust a browser's local storage or a return URL for access.
No equip UI or paid game content is included in this PR.

### Checkout and ownership

- POST `/api/billing/items`, `/inventory`, `/checkout` require the existing session,
  verified Firebase identity, and same-origin request headers. The client sends
  an item ID and locale, never an amount, price ID or account ID.
- The server reads active one-time Stripe prices. A Firestore transaction creates
  an immutable `shopOrders` record and reserves the account/item. Repeat attempts
  reuse the same order and Stripe idempotency key until Stripe reports expiry.
- `/api/billing/webhook` verifies Stripe's signature against the raw request body.
  It retrieves the Checkout Session from Stripe, validates the account, item,
  price, quantity, currency and amount, then atomically marks the order and
  inventory owned. Merely returning from Checkout never grants ownership.
- Duplicate payment events are harmless. Any refund (including partial refunds)
  or dispute revokes that order's entitlement; late success cannot restore it.
  A refund of an old order does not revoke a newer purchase. Dispute resolution
  does not automatically restore access; handle reinstatement manually after review.
- Expired sessions are marked expired by webhook. Webhook failures return non-2xx
  for Stripe retries. Monitor and replay failed events before allowing purchases.
- Browsers cannot read/write billing collections directly, including legacy
  `customers` and `products`. The server filters purchase history by verified UID.

### Setup before selling

1. Deploy `firestore.rules` before exposing billing or adding real items. The
   runtime service account needs Firestore data access, as it does for XP.
2. Create Stripe **one-time** prices for finished items. Put the Stripe secret key
   and webhook signing secret in Google Secret Manager and bind them to Cloud Run
   as `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Never use `NEXT_PUBLIC_` or
   commit keys. This uses the Stripe SDK directly; no Firebase Stripe extension
   or Premium custom claim is needed.
3. Configure `https://dingn.com/api/billing/webhook` for
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`.
4. Add a released item to `src/data/shop-items.json`, for example (placeholder,
   **not a real item or price**):

   ```json
   [
     {
       "id": "finished-cape",
       "game": "morrowglint",
       "active": false,
       "priceId": "price_REPLACE",
       "name": { "en": "Cape", "zh-CN": "披风" },
       "description": {
         "en": "Describe the finished item and where to use it.",
         "zh-CN": "说明已完成的道具及其使用位置。"
       }
     }
   ]
   ```

5. Run `npm run verify` and `npm run test:rules` (Firebase CLI + Java 21).
   In Stripe test mode, verify payment, webhook delay/replay, another account,
   repeat checkout, expiry, refund and dispute, plus actual in-game equip/use.
   Only then enable the item and production keys. Checkout currently accepts
   cards, quantity one, and the fixed price without discounts or automatic tax;
   configure required pricing/tax behavior before launch.

Missing Stripe configuration or an empty release allowlist produces an empty shop.
The production secrets, Stripe products/webhook, and real payment smoke test are
external setup steps; adding this code alone does not activate sales.

## Hosting and cutover

`dingn.com` is mapped straight to the `dingn-web` Cloud Run service in `us-central1`, which serves the whole site, including the Firebase authentication helper under `/__/auth/` (see below). Firebase Hosting is no longer used, so `firebase.json` only configures the Firestore rules and emulator. Every GitHub deployment updates `dingn.com` automatically.

The cutover includes a retirement worker at the old `flutter_service_worker.js` path. It clears only Flutter's three named caches, unregisters itself, and refreshes controlled windows to avoid leaving returning visitors on the old app. Old `/#/word` and similar Flutter links forward to the corresponding new page.

No live deployment is performed by `npm run build` or the preview command.

## Google Analytics

The existing GA4 property `dingn` (168897915), web stream `dingn-web` (1727160566), uses measurement ID `G-QDV6QLR932`. View reports at https://analytics.google.com/analytics/web/#/p168897915/.

Analytics loads only after a visitor allows it through the footer preferences, and only on `dingn.com` or `www.dingn.com`. Declining stops collection and clears Analytics cookies. Local previews and Cloud Run URLs do not collect visits. Public home, practice, sign-in, and feedback page views use fixed titles and paths without query strings or fragments. Account and admin pages are excluded; names, emails, user IDs, searches, and feedback contents are never included in event parameters. Advertising signals are disabled. Enhanced measurement is disabled in the stream to avoid duplicate history events and automatic form/search collection.

Analytics runs by default with no consent banner. After deployment, open GA's Realtime report to verify page views. Counts cover visitors who have not opted out and whose browsers allow Analytics.

## Flutter reference and rollback

The earlier Flutter app and visual refresh remain in `lib/`, `web/`, `android/`, and `ios/` as a migration reference. They are not bundled into the new website. The retained Flutter source can be rebuilt if needed. Do not remove the old implementation until the website cutover has been verified.

## Cloud Run deployment

GitHub Actions in `.github/workflows/website.yml` validates every PR into `main` with TypeScript, tests, and a production build. A merge (or any push) to `main` validates again, builds and pushes an image tagged with the commit SHA, and deploys its immutable digest to `dingn-web`. Deployments run one at a time. Manual runs are supported on `main`; PR runs never receive cloud credentials. The deployed routes are checked over HTTPS and the URL appears in the workflow summary.

One-time setup: upload the website source to Cloud Shell and run `bash scripts/setup-cloud-run.sh` as the project owner. This enables the required APIs, creates the Docker registry and dedicated service accounts, deploys the initial website, and configures Workload Identity Federation. The provider admits only repository ID `227018999`, owner ID `6968989`, and this exact workflow on `main` for push/manual events. CI can write only the `dingn-web` image repository, update only the `dingn-web` service, and act as only its dedicated runtime account. The runtime account has no project roles. No service-account key or GitHub secret is needed.

Configure branch protection to require `Validate website` if merges must be blocked until validation passes. The workflow itself always requires validation before deploying. To roll back, send traffic to a previous healthy Cloud Run revision from the console; the next successful deployment sends traffic to the newest revision again.

The `Dockerfile` builds the static export and serves it from a minimal Node.js container as a non-root user, binding to `0.0.0.0:$PORT`. Cloud Build uploads only the files allowed by `.gcloudignore`; local environment files, Flutter source, tests, and Git history are excluded.

Prerequisites: link a billing account to `dingn-193716`, install/authenticate the Google Cloud CLI, and grant the deployer the required Cloud Run source-deployment and build permissions. The deployment command enables required APIs if prompted. No billing account is selected automatically.

```powershell
npm run deploy:cloud-run
```

Default service: `dingn-web`, region: `us-central1`, request-based billing, minimum instances: 0, maximum instances: 2, memory: 256 MiB, CPU: 1. Instance limits reduce scaling but are not a spending cap. Builds and image storage can also incur charges.

After deployment, authorize the exact returned `run.app` hostname in Firebase Authentication and verify Google sign-in and data access. `dingn.com` is mapped straight to this service.

## Admin access

In authenticated Cloud Shell, run `python3 scripts/set-admin.py EMAIL --grant` (or `--revoke`) for an explicitly approved existing account. This uses the project-owner credentials, preserves other custom claims, and verifies the change. The script is excluded from the website container. Never store admin access in editable account documents. After a change, sign out and back in; existing tokens can retain their claims until expiry (up to an hour). The admin navigation link appears only after the token claim is confirmed; Firestore independently enforces access.

## Mind arcade and authentication domain

Memory Sprint, Logic Lab (`/logic/`), and Decision Room (`/decisions/`) are public games. Logic and decision rounds explain each answer, lock each submitted choice, and reset scores when replayed. No game score is persisted. Existing memory practice, account, feedback, and admin features remain available.

Production uses Cloud Run. `scripts/preview.mjs` transparently forwards GET/POST/HEAD requests under `/__/auth/` to the fixed Firebase Authentication helper host with HTTPS verification, while the client retains `authDomain: dingn.com`. Google OAuth must authorize `https://dingn.com/__/auth/handler`. Firebase Hosting stays disabled; reserved authentication helper endpoints still work.

Visit `/opt-out/` to persist analytics denial in that browser. There is no consent banner and no footer analytics-preferences link.

Make production changes on a branch and open a PR against `main` (the repository’s main/default branch). The Website workflow validates PRs. Merging to `main` runs validation and deploys an immutable container image to `dingn-web` through GitHub OIDC. Do not deploy local source directly as the normal release workflow.

## Email/password authentication

The production Node server (`scripts/preview.mjs` + `scripts/api.mjs`) handles
same-origin `/api/auth/*` and `/api/data` requests. Email/password signup, login,
session restore/renewal, and Firestore access never initialize the browser Firebase
SDK. The SDK is dynamically loaded only after an explicit Google sign-in click.
Google sign-in still requires Google access.

Firebase remains the backend identity and data provider. The server exchanges
passwords and refresh tokens with Firebase over TLS. A seven-day rolling,
HttpOnly, Secure, SameSite=Lax, host-only cookie holds the refresh token in
production; tokens are not returned to browser JavaScript or stored in localStorage.
All API calls require POST, an allowlisted Origin, JSON, and a custom header.
Requests are size-limited and upstream calls time out. Auth has a per-instance
burst cap in addition to Firebase account/project quotas; it is not a distributed
rate limiter. Firestore receives the user's ID token, not a service-account token,
so existing Firestore rules continue to apply, including private admin feedback.
No new runtime IAM permissions or service-account keys are needed.

Use `npm run build` then `npm run preview` on `http://127.0.0.1:3001` to test
end-to-end auth locally. `next dev` alone serves the UI but not the Node API.
Production uses the Dockerfile and the PR → main → Cloud Run workflow.
Previously persisted Firebase browser sessions require one new sign-in when
switching to this server-session implementation. Accounts that only have Google
credentials still need Google sign-in; this change does not assign them passwords.
Password recovery and email verification screens are not part of this change.

GA4 remains opt-in and independent of authentication. Use `/opt-out/` when testing.
Removing direct browser calls to Google/Firebase does not establish that Cloud Run
itself is reachable from every mainland China network; test that from the target
networks separately.

## XP and leaderboard

Signed-in players earn XP for the warm-up, Logic and Decisions games. The browser never writes XP. Instead, `scripts/game-api.mjs` runs inside the website server and uses the Firebase Admin SDK:

- `POST /api/play/start` reads the player from the dingn session cookie (verified with the Admin SDK) and creates a single-use `plays/{id}` record. The server generates the warm-up digits.
- `POST /api/play/finish` grades the raw answers against the server's own answer key (`src/data/mind-games.json`). Before it awards XP in a transaction, it checks:
  - that the play belongs to this player and hasn't already been scored
  - the minimum play time and the 30-minute expiry
  - the hourly start limit and the daily XP cap
- `POST /api/me` and `POST /api/leaderboard` return a player's level and the top 10. The leaderboard shows nicknames or first names only.

`firestore.rules` denies all browser access to `players` and `plays`. The scoring rules live in `scripts/game-core.mjs` and are covered by `tests/game-core.test.ts`.

One-time setup as the project owner, before the first release that includes XP:

```sh
firebase deploy --only firestore:rules --project dingn-193716
gcloud projects add-iam-policy-binding dingn-193716 \
  --member serviceAccount:dingn-web-runtime@dingn-193716.iam.gserviceaccount.com \
  --role roles/datastore.user
```

Until the IAM binding exists, the games still work, but XP reports "unavailable".

## Memory Ladder

The homepage memory game is a climb from three digits up to 20. Correct answers add a digit; a miss keeps the same length with a fresh sequence and costs one of three lives. The climb ends after the third miss or once 20 digits are recalled. Memorization lasts one second per digit, then recall lasts 15 seconds or 1.5 seconds per digit, whichever is longer. Free play generates fresh sequences. Daily challenges use a shared UTC date seed and allow replays. Personal longest recall is saved on the device; signed-in completed games receive server-graded XP under the existing daily cap. Shared results contain no sequence answers. This is a casual challenge, not a tamper-proof competition: the browser receives the sequence bank to display it.

## Platform brand and languages

dingn is the game platform. Memory Ladder is playable at `/memory-ladder/` and on the homepage; existing practice and game links remain supported.

The shared `LocaleProvider` supports English (`en`) and Simplified Chinese (`zh-CN`). The header selector remembers the choice under `dingn.locale`. On first load, `?lang=` takes priority over a saved preference, followed by the browser language. The document language updates for assistive technology. Language changes do not remount games or reset progress.

All new platform and game UI copy must support both languages. English source strings map to `src/data/zh-CN.json`; dynamic sentences use numbered placeholders and are translated as complete sentences. Keep IDs, answer indexes, server scoring, and stored user content independent of presentation language. The question catalog is shared with server grading; translations change presentation only. Tests verify translated questions and switching language mid-round.

Names, feedback, saved associations, and English dictionary learning material retain their original content. The practice interface explains the English-learning context.

## Crowd Rush (人潮突击)

Crowd Rush, a 3D crowd-runner shooter, is published like any outside developer's game. Its code lives in its own repository, [ligangwang/crowdrush](https://github.com/ligangwang/crowdrush). Merging there uploads it to dingn with an upload key, and an admin approves it. It plays at `/play/crowdrush/`. The old `/crowd/` and `/pop/` addresses redirect there permanently.

Players keep their progress from before the move: until Crowd Rush saves something itself, the game bridge reads the old `crowd` game's saves instead, both the device ones and the signed-in account ones (`MIGRATED_FROM` in `src/lib/game-bridge.ts`). The Polyfork model credits stay at `public/models/crowd/CREDITS.md` for the footer link.

## Game platform

Games can be published on their own, without deploying the website: see
[docs/game-platform.md](docs/game-platform.md).
