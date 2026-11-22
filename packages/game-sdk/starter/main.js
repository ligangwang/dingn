// A starter game for dingn. It uses every part of the dingn game SDK:
// language, player, device storage, account progress, badges, sign-in and
// ready().
// Change anything you like; keep the connect() call and dingn.ready().
import { connect } from "https://dingn.com/sdk/v1/dingn-sdk.js";

const copy = {
  en: {
    hello: (name) => (name ? `Hi ${name}!` : "Hi there!"),
    score: (n) => `Taps: ${n}`,
    best: (n) => `Best: ${n}`,
    start: "Start",
    again: "Play again",
    signIn: "Sign in to keep your best score",
  },
  "zh-CN": {
    hello: (name) => (name ? `你好，${name}！` : "你好！"),
    score: (n) => `点击：${n}`,
    best: (n) => `最高：${n}`,
    start: "开始",
    again: "再玩一次",
    signIn: "登录以保存最高分",
  },
};

const $ = (id) => document.getElementById(id);
const dingn = await connect();
const text = copy[dingn.locale] ?? copy.en;
let best = 0;
let score = 0;

async function loadBest() {
  // Account progress follows a signed-in player to any device;
  // storage stays on this device. Use whichever is higher.
  const saved = dingn.player.signedIn
    ? await dingn.progress.load().catch(() => null)
    : null;
  const local = await dingn.storage.get("best").catch(() => 0);
  best = Math.max(Number(saved?.best) || 0, Number(local) || 0);
}

function render() {
  $("hello").textContent = text.hello(dingn.player.name);
  $("score").textContent = text.score(score);
  $("best").textContent = text.best(best);
  $("signin").hidden = dingn.player.signedIn || !dingn.embedded;
  $("signin").textContent = text.signIn;
}

$("start").textContent = text.start;
$("start").onclick = () => {
  score = 0;
  $("tap").disabled = false;
  $("start").hidden = true;
  render();
  setTimeout(async () => {
    $("tap").disabled = true;
    $("start").hidden = false;
    $("start").textContent = text.again;
    if (score > best) {
      best = score;
      await dingn.storage.set("best", best).catch(() => {});
      if (dingn.player.signedIn)
        await dingn.progress.save({ best }).catch(() => {});
    }
    // A badge from game.json. dingn shows the "Badge earned" popup and pays
    // its coins once; signed-out players can't earn badges.
    if (score >= 30 && dingn.player.signedIn)
      await dingn.rewards.unlock("taps-30").catch(() => {});
    render();
  }, 5000);
};
$("tap").onclick = () => {
  score++;
  render();
};
$("signin").onclick = () => dingn.requestSignIn();
dingn.onPlayer(async () => {
  await loadBest();
  render();
});

await loadBest();
render();
dingn.ready(); // hides dingn's loading screen
