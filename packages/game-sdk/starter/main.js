import { connect } from "https://dingn.com/sdk/v1/dingn-sdk.js";
import { copy } from "./copy.mjs";

const MODE = "tap-v1";
const ROUND_MS = 5000;
const $ = (id) => document.getElementById(id);
const dingn = await connect();
const incoming = dingn.challenge;
const challenge =
  incoming?.mode === MODE &&
  incoming.unit === "points" &&
  /^[a-f0-9]{32}$/.test(incoming.seed ?? "")
    ? incoming
    : null;

let locale = dingn.locale;
let score = 0;
let best = 0;
let deadline = 0;
let finished = false;
let seed;
let link = "";
let linkRequest;
let status = null;

function render() {
  const text = copy[locale] ?? copy.en;
  document.documentElement.lang = copy[locale] ? locale : "en";
  const format = new Intl.NumberFormat(document.documentElement.lang);
  $("tap").textContent = text.tap;
  $("score").textContent = `${text.points}: ${format.format(score)}`;
  $("best").textContent = `${text.best}: ${format.format(best)}`;
  $("start").textContent = challenge
    ? text.retry
    : finished
      ? text.again
      : text.start;
  $("start").hidden = Boolean(deadline);
  $("tap").disabled = !deadline;
  $("target").hidden = !challenge;
  $("outcome").hidden = !challenge || !finished;
  if (challenge) {
    $("target").textContent =
      `${text.target}: ${format.format(challenge.score)}`;
    $("outcome").textContent =
      score > challenge.score
        ? text.win
        : score === challenge.score
          ? text.tie
          : text.loss;
  }
  $("signin").hidden = dingn.player.signedIn || !dingn.embedded;
  $("signin").textContent = text.signIn;
  $("challenge").hidden =
    !dingn.embedded || !finished || Boolean(challenge) || Boolean(link);
  $("challenge").disabled = Boolean(linkRequest);
  $("challenge").textContent = text.challenge;
  $("share").hidden = !link;
  $("link").value = link;
  $("link").setAttribute("aria-label", text.link);
  $("copy").textContent = text.copy;
  $("status").textContent = status ? text[status] : "";
}

async function loadBest() {
  const local = await dingn.storage.get("best").catch(() => 0);
  const saved = dingn.player.signedIn
    ? await dingn.progress.load().catch(() => null)
    : null;
  best = Math.max(best, Number(local) || 0, Number(saved?.best) || 0);
  render();
}

function finish() {
  deadline = 0;
  finished = true;
  if (score > best) {
    best = score;
    void dingn.storage.set("best", best).catch(() => {});
    if (dingn.player.signedIn)
      void dingn.progress.save({ best }).catch(() => {});
  }
  if (challenge) void dingn.challengeResult(score).catch(() => {});
  dingn.roundEnded();
  render();
  $("start").focus();
}

$("start").onclick = () => {
  if (deadline) return;
  score = 0;
  // Each ordinary run gets its own challenge. This example uses a fixed
  // timer. Feed this seed into your level generator if your game uses one.
  seed = challenge?.seed ?? crypto.randomUUID().replaceAll("-", "");
  link = "";
  linkRequest = null;
  status = null;
  finished = false;
  deadline = performance.now() + ROUND_MS;
  setTimeout(finish, ROUND_MS);
  render();
  $("tap").focus();
};

$("tap").onclick = () => {
  if (!deadline || performance.now() >= deadline) return;
  score++;
  render();
};

$("challenge").onclick = async () => {
  if (!finished || linkRequest || link) return;
  status = null;
  const request = dingn.challengeLink({
    mode: MODE,
    seed,
    score,
    unit: "points",
  });
  linkRequest = request;
  render();
  try {
    const url = await request;
    if (linkRequest === request) link = url;
  } catch {
    if (linkRequest === request) status = "error";
  } finally {
    if (linkRequest === request) {
      linkRequest = null;
      render();
      if (link) $("copy").focus();
    }
  }
};

$("copy").onclick = async () => {
  const url = link;
  try {
    await navigator.clipboard.writeText(url);
    if (link === url) status = "copied";
  } catch {
    if (link !== url) return;
    $("link").focus();
    $("link").select();
    status = document.execCommand("copy") ? "copied" : "manual";
  }
  render();
};

$("signin").onclick = () => dingn.requestSignIn();
dingn.onPlayer(loadBest);
dingn.onLanguage((next) => {
  locale = next;
  render();
});

render();
dingn.ready();
void loadBest();
