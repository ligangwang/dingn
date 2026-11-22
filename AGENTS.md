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
dingn installs it as the `kingdom` package, pinned to a commit in
`package.json`. dingn is the platform: it runs the games, sign-in, Firestore
and the API, and asks the package what a player earns. Read the kingdom
repo's `AGENTS.md` for the levels, XP and honors design and the kingdom's
art credits.

- **Never copy a reward rule into dingn.** Import it: `kingdom/levels` (XP
  curve, `DAILY_XP_CAP`), `kingdom/honors`, `kingdom/coins` (`TIER_COINS`,
  `BADGE_XP` and the caps), `kingdom/ledger`, `kingdom/kingdom` (stages,
  buildings) and `kingdom/scene` (the 3D island).
- **Report events, don't pay rewards by hand.** `grantEvent` in
  `scripts/rewards.mjs` passes an event (`badge`, `earn`) to the package's
  `grant()` and saves the rewards and XP documents in one transaction. A new
  reward is added in the kingdom repo as a reward kind and needs no change
  here; a new kind of event needs dingn to report it once.
- **Shipping a change to the rewards:** merge it in kingdom, then point
  `package.json` at the new commit with
  `npm install https://codeload.github.com/ligangwang/kingdom/tar.gz/<commit>`.
- The kingdom's models are copied from the package to
  `public/models/kingdom` before `dev` and `build`
  (`scripts/kingdom-assets.mjs`) and are not committed. The footer's Credits
  link still reaches them through `public/models/CREDITS.md`.
- What dingn's own games score (`xpFor` in `scripts/game-core.mjs`) and the
  pages that draw the rewards (`src/components/honor.tsx`, `kingdom.tsx`,
  `kingdom-visit.tsx`, `kingdom-card.tsx`) stay here.
