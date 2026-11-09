# dingn game SDK

The only interface between a game and the dingn website. See
[docs/game-platform.md](../../docs/game-platform.md) for how games are built and
published, and `dingn-sdk.d.ts` for the full API.

The website serves this SDK to everyone at
`https://dingn.com/sdk/v1/dingn-sdk.js` (with `dingn-sdk.d.ts` and the
`starter/` game as `starter.zip` beside it), built by `scripts/build-sdk.mjs`.
Outside developers start from the guide at `/developers/` and test their game
in the playground at `/developers/playground/`, which runs any http(s)
address with a test player and logs every SDK call.

Protocol changes must stay backward compatible: games already published keep
running against the newest website, so never remove or rename a method. Add new
ones, and bump `PROTOCOL` only for a change old games could not survive. A new protocol
gets a new address (`/sdk/v2/`), and `/sdk/v1/` keeps serving the old one.
