# dingn game SDK

The only interface between a game and the dingn website. See
[docs/game-platform.md](../../docs/game-platform.md) for how games are built and
published, and `dingn-sdk.d.ts` for the full API.

Protocol changes must stay backward compatible: games already published keep
running against the newest website, so never remove or rename a method. Add new
ones, and bump `PROTOCOL` only for a change old games could not survive.
