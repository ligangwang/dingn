# AGENTS.md

Notes for AI coding agents (Claude Code, Codex, etc.) working in this repo.

## Game development resources

Reference links for building the games in this project. To add one, append a
row to the table (newest at the bottom) and note license terms and where it's used.

| Resource                          | What it offers                                                   | License / usage notes                                                                                                                                                                                                                                                                                                                  | Used in                                                                           |
| --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Polyfork](https://polyfork.dev/) | Low-poly, rigged GLB models (soldiers, Orc Brute, dragons, more) | License varies per model, so check each one. The models we use (infantry rifleman, Orc Brute, T-Rex, and the Rifle, Rotary Cannon and Rocket Launcher weapons) are **CC BY 4.0**: commercial use is OK but **attribution is required**, so list every model in the game's credits file. Loading GLBs directly from its CDN is allowed. | 3D Crowd Rush (PR #35, weapons in PR #38; now in the `ligangwang/crowdrush` repo) |

## Rewards: levels, XP, honors, coins and the kingdom

The reward system lives in its own repository, `ligangwang/kingdom`, and
runs in dingn as a plugin: an approved version's bundle, loaded at run time.
dingn is the platform: it runs the games, sign-in, Firestore and the API,
and asks the plugin what a player earns. Read the kingdom
repo's `AGENTS.md` for the levels, XP and honors design and the kingdom's
art credits.

- **Never copy a reward rule into dingn.** Call it through the plugin (below):
  `levels` (XP curve, `DAILY_XP_CAP`), `honors`, `coins` (`TIER_COINS`,
  `BADGE_XP` and the caps), `ledger`, `kingdom` (stages, buildings) and
  `rewards`.
- **Report events, don't pay rewards by hand.** `grantEvent` in
  `scripts/rewards.mjs` passes an event (`badge`, `earn`) to the package's
  `grant()` and saves the rewards and XP documents in one transaction. A new
  reward is added in the kingdom repo as a reward kind and needs no change
  here; a new kind of event needs dingn to report it once.
- **Shipping a change to the rewards** works like a game upload, with no
  dingn rebuild. Merge it in kingdom with a new version (kingdom's README,
  "Releasing a version"); kingdom's CI uploads its plugin bundle here
  (`/api/rewards/upload`, scripts/reward-releases.mjs). It waits on the
  admin Rewards page until an admin approves it there or with a review key.
  Approving makes it live: the servers run its rules and the pages load its
  UI within a minute (scripts/reward-plugin.mjs, src/lib/reward-plugin.ts).
- **Call the rules through the plugin.** On the server, `rules()` from
  `scripts/reward-plugin.mjs` (never a `kingdom/*` import); on a page,
  `useKingdomRules()` from `src/lib/reward-plugin.ts`, which is null until
  the rules load, so draw nothing that needs them until then. dingn has no
  copy of its own: without a live version the reward API answers 503.
- **The `kingdom` package is a dev dependency only**, for its types
  (`import type`), the tests (`tests/kingdom-rules.mjs` and
  `tests/setup-kingdom.ts` run it as the live version) and a game's
  `--dry-run` check. Never import it at run time: it isn't in the image.
- The live plugin serves its own models. The footer's Credits link reaches
  their credits through `public/models/CREDITS.md`, which links
  `/rewards/kingdom/live/assets/kingdom/CREDITS.md` (old `/models/kingdom/`
  links are redirected there).
- **Every reward system is listed** in `src/data/reward-systems.ts`, which
  the admin Rewards page (`/admin/rewards/`) shows, kingdom first, with
  what its live version grants, its uploaded versions and the live one. A new
  reward system (its own repository) is added there and in
  `scripts/reward-systems.mjs`.
- **The kingdom's pages come from the plugin** (its `ui.js`: the build page,
  a visit and the account card, drawn into an element with their own React).
  `src/components/kingdom.tsx` only gives them dingn's words, links, coin
  picture (`public/coin.svg`) and kingdom API as plain values; don't add
  kingdom UI or rules here. Their words stay in dingn's language packs.
- What stays here: what dingn's own games score (`xpFor` in
  `scripts/game-core.mjs`), the reward API and storage
  (`scripts/rewards.mjs`, `scripts/kingdom.mjs`), and the honors drawn
  across the site (`src/components/honor.tsx`).

## Roles

What an account may do is its roles: `administrator`, `developer`, `player`
and `tester`, kept as the `roles` list in its custom claims; the list is
exactly what it holds (an account with no list yet is a player). A tester is
never a player. Read and change roles only through `scripts/roles.mjs`
(`hasRole`, `rolesOf`, `withRole`, `withRoles`), and in the Firestore rules
through `isAdmin()`; never check or set `claims.admin`-style flags directly.
On a page, use `roles` (or the `isAdmin`/`isDeveloper`/`isTester` shortcuts)
from `useSession()`. A new role is added to `ROLES` in `scripts/roles.mjs`
and to the `Role` type in `src/components/session.tsx`. Games see only
`player.tester`, never an account's other roles.

## Versions

dingn's version is `version` in `package.json`, and the footer shows it with
the commit the site was built from (`GIT_COMMIT`, which the Website workflow
passes to `docker build`). Raise it when you ship a change people would
notice: minor for a feature, patch for a fix.
