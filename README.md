# dingn

A website-first memory practice app built with Next.js, React, and TypeScript. Uses the existing `dingn-193716` Firebase project for Google sign-in, Firestore data, and hosting.

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
- `/account/`: display name, training/recall preference, and sign-out.
- `/signin/`: Google sign-in with a validated return destination.

The existing `accounts/{uid}`, `numbers/{number}`, `words/{word}`, and `number_favorites/{uid}-{number}` collections and field names are preserved. Writes merge only the supported fields. User accounts do not need to be imported or recreated. Security remains enforced by the existing Firebase Authentication and Firestore rules; no rules or indexes were changed by the migration.

## Hosting and cutover

Firebase Hosting keeps the `dingn.com` domain, HTTPS, and reserved Firebase authentication endpoints. `firebase.json` forwards website requests to the `dingn-web` Cloud Run service in `us-central1`. It deliberately uploads no static files, so old Flutter files cannot take precedence over the rewrite. The rewrite follows Cloud Run traffic without pinning a revision; future GitHub deployments therefore update `dingn.com` automatically.

```sh
firebase deploy --only hosting --project dingn-193716
```

The cutover includes a retirement worker at the old `flutter_service_worker.js` path. It clears only Flutter's three named caches, unregisters itself, and refreshes controlled windows to avoid leaving returning visitors on the old app. Old `/#/word` and similar Flutter links forward to the corresponding new page.

No live deployment is performed by `npm run build` or the preview command. Google Analytics is not enabled yet; its measurement ID is still needed.

## Flutter reference and rollback

The earlier Flutter app and visual refresh remain in `lib/`, `web/`, `android/`, and `ios/` as a migration reference. They are not bundled into the new website. Its configuration is preserved as `firebase.flutter.json`, which points to `build/web`. Firebase Hosting release history can roll back a live release; the retained Flutter source can also be rebuilt if needed. Do not remove the old implementation until the website cutover has been verified.

## Cloud Run deployment

GitHub Actions in `.github/workflows/website.yml` validates every PR into `master` with TypeScript, tests, and a production build. A merge (or any push) to `master` validates again, builds and pushes an image tagged with the commit SHA, and deploys its immutable digest to `dingn-web`. Deployments run one at a time. Manual runs are supported on `master`; PR runs never receive cloud credentials. The deployed routes are checked over HTTPS and the URL appears in the workflow summary.

One-time setup: upload the website source to Cloud Shell and run `bash scripts/setup-cloud-run.sh` as the project owner. This enables the required APIs, creates the Docker registry and dedicated service accounts, deploys the initial website, and configures Workload Identity Federation. The provider admits only repository ID `227018999`, owner ID `6968989`, and this exact workflow on `master` for push/manual events. CI can write only the `dingn-web` image repository, update only the `dingn-web` service, and act as only its dedicated runtime account. The runtime account has no project roles. No service-account key or GitHub secret is needed.

Configure branch protection to require `Validate website` if merges must be blocked until validation passes. The workflow itself always requires validation before deploying. To roll back, send traffic to a previous healthy Cloud Run revision from the console; the next successful deployment sends traffic to the newest revision again.

The `Dockerfile` builds the static export and serves it from a minimal Node.js container as a non-root user, binding to `0.0.0.0:$PORT`. Cloud Build uploads only the files allowed by `.gcloudignore`; local environment files, Flutter source, tests, and Git history are excluded.

Prerequisites: link a billing account to `dingn-193716`, install/authenticate the Google Cloud CLI, and grant the deployer the required Cloud Run source-deployment and build permissions. The deployment command enables required APIs if prompted. No billing account is selected automatically.

```powershell
npm run deploy:cloud-run
```

Default service: `dingn-web`, region: `us-central1`, request-based billing, minimum instances: 0, maximum instances: 2, memory: 256 MiB, CPU: 1. Instance limits reduce scaling but are not a spending cap. Builds and image storage can also incur charges.

After deployment, authorize the exact returned `run.app` hostname in Firebase Authentication and verify Google sign-in and data access. `dingn.com` reaches this service through Firebase Hosting, which also preserves the existing Firebase auth handler.

## Admin access

In authenticated Cloud Shell, run `python3 scripts/set-admin.py EMAIL --grant` (or `--revoke`) for an explicitly approved existing account. This uses the project-owner credentials, preserves other custom claims, and verifies the change. The script is excluded from the website container. Never store admin access in editable account documents. After a change, sign out and back in; existing tokens can retain their claims until expiry (up to an hour). The admin navigation link appears only after the token claim is confirmed; Firestore independently enforces access.

