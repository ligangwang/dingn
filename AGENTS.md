# AGENTS.md

Notes for AI coding agents (Claude Code, Codex, etc.) working in this repo.

## Game development resources

Reference links for building the games in this project. To add one, append a
row to the table (newest at the bottom) and note license terms and where it's used.

| Resource                                               | What it offers                                                                                      | License / usage notes                                                                                                                                                                                                                                                                                                                     | Used in                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Polyfork](https://polyfork.dev/)                      | Low-poly, rigged GLB models (soldiers, Orc Brute, dragons, more)                                    | License varies per model, so check each one. The models we use (infantry rifleman, Orc Brute, T-Rex, and the Rifle, Rotary Cannon and Rocket Launcher weapons) are **CC BY 4.0**: commercial use is OK but **attribution is required**, so list every model in the game's credits file. Loading GLBs directly from its CDN is allowed.    | 3D Crowd Rush (PR #35, weapons in PR #38; now in the `ligangwang/crowdrush` repo)                                     |
| [Polyfork Medieval Village kit](https://polyfork.dev/) | Low-poly medieval buildings, props, trees and animated villagers (GLB)                              | **CC BY 4.0**, attribution required: every model we ship is listed in `public/models/kingdom/CREDITS.md`, which the site footer's Credits link reaches through `public/models/CREDITS.md`. We self-host optimized copies rather than loading the CDN.                                                                                     | The dingn kingdom (`/kingdom/`, PR #76)                                                                               |
| [Poly Haven](https://polyhaven.com/)                   | Photographed HDRI skies, scanned ground and wall textures, tree models, and scanned props and ships | **CC0**: no attribution required, but list each asset under "Landscape" or "Scanned props" in `public/models/kingdom/CREDITS.md` so the sources stay known. Models and textures download without an account. We ship small derived files (a JPG sky, resized textures, tree picture sheets, simplified GLBs), never the originals.        | The dingn kingdom's landscape (`public/models/kingdom/land/`) and its props and ships (`public/models/kingdom/real/`) |
| [Sketchfab](https://sketchfab.com/)                    | Textured, realistic models by many authors (search with the "Downloadable" filter)                  | License varies per model, so check each one; ours are all **CC BY 4.0**, attribution required: list the title, author, link and the changes made under "Realistic buildings" in `public/models/kingdom/CREDITS.md`. Downloads need a signed-in account, so a person downloads the GLB (1k textures) by hand and we ship optimized copies. | The dingn kingdom's houses, church, mill, well, stall and gate (`public/models/kingdom/real/`)                        |

## Levels, XP and honors

Every dingn account has one level, from 1 to 100, earned with XP. The level
sets the player's honor (title, medal and avatar ring) and how far their
kingdom can grow. The levels tell the story of humankind, from wanderers on
the land to a people living on many planets.

**Status:** the 1–100 design below was agreed on 2026-11-21 and is not built
yet. Until it is, the code uses `50·n·(n−1)` XP for level n and seven honors
(Wanderer at 1 … High monarch at 20), already with their numerals. When you
build it, update this section to say so.

### Where it lives

- XP curve, play XP and the daily cap: `scripts/game-core.mjs`
  (`levelFor`, `levelProgress`, `DAILY_XP_CAP`, `xpFor`).
- Badge XP and the kingdom's stages and buildings: `src/data/kingdom.mjs`
  (`BADGE_XP`, `STAGES`, `BUILDINGS`). The server and the kingdom page
  both read it.
- Badge coins: `scripts/game-registry.mjs` (`TIER_COINS`, `MAX_GAME_COINS`,
  `DAILY_GAME_COINS`). Paying badges: `scripts/rewards.mjs`.
- Honors, the path of honor and the avatar ring with its level medal:
  `src/components/honor.tsx`.

### Earning XP

All XP is scored by the server; nothing a browser sends counts by itself.

| Source                             | XP                                          | Limit          |
| ---------------------------------- | ------------------------------------------- | -------------- |
| Warm-up (Memory games)             | 5 with a score, 1 without                   | Daily cap      |
| Memory Ladder and the Daily Ladder | 10 per round cleared, +10 for a perfect run | Daily cap      |
| A bronze badge in any game         | 20                                          | Once per badge |
| A silver badge                     | 50                                          | Once per badge |
| A gold badge                       | 100                                         | Once per badge |
| A diamond badge                    | 200                                         | Once per badge |

- **Daily cap:** play XP is capped at 300 a UTC day (`DAILY_XP_CAP`).
  Badge XP isn't capped, but each badge pays once.
- **Badges:** a badge's XP is twice the coins its tier pays (bronze 10,
  silver 25, gold 50, diamond 100 coins). One game's badges can pay at most
  1,000 coins in all. Games declare their badges in `game.json` and award
  them through the SDK. The referral badges, for 3, 10, 25 and 50 friends
  brought in by challenge links, pay XP the same way.
- **Proposed, not decided** (all would stay under the daily cap):
  - XP for finishing a round in any published game, through the SDK;
  - a first-play-of-the-day bonus;
  - a streak bonus;
  - XP when an invited friend joins.

### The XP curve

Levels 1–50 come quickly; 50–100 are a long climb where each level costs
more than the last, like Douyin's levels.

- **Levels 1–50:** level n starts at `10·n·(n−1)` XP.
- **Levels 51–100:** each level costs 7% more than the one before. Going from
  level n−1 to level n costs `980 · 1.07^(n−50)` XP, rounded to the nearest 10.

| Level | Starts at XP | XP from the level before | At the 300 XP cap |
| ----- | ------------ | ------------------------ | ----------------- |
| 5     | 200          | 80                       | day 1             |
| 10    | 900          | 180                      | 3 days            |
| 20    | 3,800        | 380                      | 2 weeks           |
| 30    | 8,700        | 580                      | 1 month           |
| 40    | 15,600       | 780                      | 2 months          |
| 50    | 24,500       | 980                      | 3 months          |
| 60    | 38,970       | 1,930                    | 4 months          |
| 70    | 67,460       | 3,790                    | 7½ months         |
| 80    | 123,530      | 7,460                    | 1⅛ years          |
| 90    | 233,810      | 14,670                   | 2⅛ years          |
| 100   | 450,750      | 28,870                   | 4 years           |

Rules for changing the curve:

- **Never lower a player's level.** Every new threshold must be at or below
  the old one for the levels players hold.
- **Recount stored levels.** `players/{uid}.level` is stored, and the
  leaderboard reads it, so after changing the curve run a one-time recount
  from XP.

### Eras, honors and what a player owns

A player's **honor** is the era's title with a Roman numeral for their step
within it, counted from the era's first level: Wanderer I, II, III, IV for
levels 1–4, then Camp leader I at level 5, and so on (`honorName` in
`src/components/honor.tsx`). The Path of honor shows each era's plain title,
with the numeral only on the player's current step.

| Levels | Era             | Title         | Medal         | Kingdom stage   | Land  | What it opens                                     |
| ------ | --------------- | ------------- | ------------- | --------------- | ----- | ------------------------------------------------- |
| 1–4    | Wilds           | Wanderer      | Bronze        | none yet        | –     | –                                                 |
| 5–9    | Tribe           | Camp leader   | Bronze        | Camp (campfire) | 5×5   | Paths, trees, flower beds, cottages, wheat fields |
| 10–14  | Village         | Village elder | Bronze        | Village         | 6×6   | Village hall, well, market stalls, windmill       |
| 15–19  | Town            | Town lord     | Bronze        | Town            | 7×7   | Great hall, town houses, blacksmith, watchtowers  |
| 20–29  | City            | City governor | Silver        | City            | 8×8   | Keep, chapel, fountain, clock tower               |
| 30–39  | Kingdom         | Monarch       | Silver        | Kingdom         | 9×9   | Castle, knight statues                            |
| 40–49  | Capital         | High monarch  | Gold          | Capital         | 10×10 | Palace                                            |
| 50–64  | Empire          | Emperor       | Gold          | (to design)     |       |                                                   |
| 65–79  | Machines        | Inventor      | Diamond       | (to design)     |       |                                                   |
| 80–99  | Space           | Starfarer     | Stellar (new) | (to design)     |       |                                                   |
| 100    | Multi-planetary | Worldmaker    | Stellar       | (to design)     |       |                                                   |

- **Owning:** a stage is a reward: when the level opens it, the land grows,
  the hall upgrades itself and a few basic buildings (paths, homes, a field,
  a well…) are placed for free (`STARTERS` in `src/data/kingdom.mjs`). The
  player can move them. Everything else is decoration bought with coins
  (`BUILDINGS`). A player keeps every building they own, even if the stage
  they can build at changes. Players who bought hall upgrades before halls
  were free got those coins back on their next visit (`hallRefund`).
- **The medal and title** go everywhere the player is shown: the site
  header, the profile page, their public page (`/player/<number>/`) and the
  leaderboard.
- **Visiting:** a player's public page (`/player/<number>/`) shows their
  kingdom in 3D, as they built it, for anyone to look around
  (`src/components/kingdom-visit.tsx`). The direction is for visitors to
  walk in, explore and make friends there; not built yet.
- **More to own:** each era should grant more than a title. Future assets
  (more land, equipment, knowledge or skills) are things a player owns and
  can buy, and they show in their kingdom and on their page. More models and
  art will come; add them to `BUILDINGS` or a new owned-asset list beside it,
  keyed by era, rather than hard-coding them in pages.
- **Later eras** (Empire to Multi-planetary) need new kingdom stages,
  buildings and the stellar medal's art. Keep the art original, and list any
  third-party models in `public/models/kingdom/CREDITS.md`.
