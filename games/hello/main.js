// A tiny example game for the dingn game platform. It shows every part of
// the SDK: locale, player, device storage, account progress and sign-in.
import { connect } from "./dingn-sdk.js";

const copy = {
  en: {
    hello: (name) => (name ? `Hi ${name}!` : "Hi there!"),
    score: (n) => `Score: ${n}`,
    best: (n, where) => `Best: ${n} (${where})`,
    account: "saved to your account",
    device: "this device",
    start: "Start",
    again: "Play again",
    signIn: "Sign in to keep your best score",
  },
  "zh-CN": {
    hello: (name) => (name ? `你好，${name}！` : "你好！"),
    score: (n) => `得分：${n}`,
    best: (n, where) => `最高分：${n}（${where}）`,
    account: "已保存到账号",
    device: "本设备",
    start: "开始",
    again: "再玩一次",
    signIn: "登录以保存最高分",
  },
};

const $ = (id) => document.getElementById(id);
const dingn = await connect();
const text = copy[dingn.locale] ?? copy.en;
let best = 0,
  score = 0,
  timer = 0;

async function loadBest() {
  const saved = dingn.player.signedIn
    ? await dingn.progress.load().catch(() => null)
    : null;
  const local = (await dingn.storage.get("best")) ?? 0;
  best = Math.max(Number(saved?.best) || 0, Number(local) || 0);
}
function render() {
  $("hello").textContent = text.hello(dingn.player.name);
  $("score").textContent = text.score(score);
  $("best").textContent = text.best(
    best,
    dingn.player.signedIn ? text.account : text.device,
  );
  $("signin").hidden = dingn.player.signedIn || !dingn.embedded;
  $("signin").textContent = text.signIn;
}

$("star").disabled = true;
$("start").textContent = text.start;
$("start").onclick = () => {
  score = 0;
  $("star").disabled = false;
  $("start").hidden = true;
  render();
  clearTimeout(timer);
  timer = setTimeout(async () => {
    $("star").disabled = true;
    $("start").hidden = false;
    $("start").textContent = text.again;
    if (score > best) {
      best = score;
      await dingn.storage.set("best", best);
      if (dingn.player.signedIn)
        await dingn.progress.save({ best }).catch(() => {});
    }
    render();
  }, 10000);
};
$("star").onclick = () => {
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
dingn.ready();
