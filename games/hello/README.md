# Star Tap (example game)

The smallest complete dingn platform game: a static folder with `game.json`,
an `index.html` entry and `main.js`, which imports `./dingn-sdk.js` (the
publisher adds that file). Copy this folder to start a new static game.

```sh
npm run publish:game -- hello --local     # publish to .games-local/
npm run build && npm run preview -- --local-games
# open http://127.0.0.1:3001/play/hello/
```
