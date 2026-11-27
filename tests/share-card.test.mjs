// The picture a challenge link shows where it is shared.
import "./kingdom-rules.mjs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, registry, cards;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-cards-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  cards = await import("../scripts/share-card.mjs");
  await registry.updateRecord("memory", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest({
        id: "memory",
        version: "1.0.0",
        title: { en: "Memory", zh: "记忆" },
        cover: "cover.png",
      }),
      { listed: true },
    ),
  );
  // A one-pixel PNG as the game's cover.
  const files = path.join(dir, "games", "memory", "1.0.0");
  await mkdir(files, { recursive: true });
  await writeFile(
    path.join(files, "cover.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  registry.clearRegistryCache();
});
after(() => rm(dir, { recursive: true, force: true }));

const saved = {
  id: "Xq3v9TzK1bWm",
  game: "memory",
  mode: "level",
  seed: "6",
  score: 4140,
  unit: "points",
  name: "Ada",
  avatar: "fox",
};

function call(url, method = "GET") {
  const req = Object.assign(new EventEmitter(), {
    method,
    url,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  });
  return new Promise((resolve) => {
    const res = {
      writeHead(status, headers = {}) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        resolve({ status: this.status, headers: this.headers, body });
      },
    };
    void cards.handleShareCard(req, res, new URL(url, "http://x").pathname);
  });
}

test("a card says who to beat, their score, the game and the round", () => {
  const svg = cards.cardSvg({ challenge: saved, title: "Memory" });
  assert.match(svg, /^<svg [^>]*width="1200" height="630"/);
  assert.match(svg, />Ada<\/text>/);
  assert.match(svg, />4,140 points<\/text>/);
  assert.match(svg, />Memory \(Level 6\)<\/text>/);
  assert.match(svg, />Can you beat it\?<\/text>/);
  // The fox's colour behind the player's initials.
  assert.match(svg, /fill="#ff9f43"\/><text[^>]*>AD<\/text>/);
  // No cover given: none drawn.
  assert.doesNotMatch(svg, /<image /);
  assert.match(
    cards.cardSvg({ challenge: saved, title: "Memory", cover: "data:x" }),
    /<image [^>]*xlink:href="data:x"/,
  );
  // In the link's language, and "A player" for a guest's challenge.
  const zh = cards.cardSvg({
    challenge: { ...saved, name: null },
    title: "记忆",
    locale: "zh-CN",
  });
  assert.match(zh, />你能超过吗？<\/text>/);
  assert.match(zh, />记忆 \(第 6 关\)<\/text>/);
  assert.doesNotMatch(zh, />Ada</);
});

test("a card's text can't add to the picture, and always fits", () => {
  const svg = cards.cardSvg({
    challenge: { ...saved, name: '<b a="1">&' },
    title: "</text><script>x</script>",
  });
  assert.doesNotMatch(svg, /<script|<b /);
  assert.match(svg, /&lt;b a=&quot;1&quot;&gt;&amp;/);
  // Emoji, which the server's fonts can't draw, are left out.
  assert.equal(cards.drawable("  Ada 🦊  Lovelace\n"), "Ada Lovelace");
  assert.equal(cards.drawable("🦊"), "");
  assert.equal(cards.drawable(null), "");
  // Short text keeps the largest size; long text shrinks, then is cut.
  assert.deepEqual(cards.fit("Ada", 500, 40, 28), { text: "Ada", size: 40 });
  const shrunk = cards.fit("A rather long game title", 400, 44, 28);
  assert.ok(shrunk.size < 44 && shrunk.size >= 28);
  const cut = cards.fit("W".repeat(80), 400, 44, 28);
  assert.equal(cut.size, 28);
  assert.match(cut.text, /^W+…$/);
  assert.ok(cards.widthOf(cut.text, 28) <= 400);
  // Chinese, Japanese and Korean characters are as wide as the font is tall.
  assert.equal(cards.widthOf("人潮突击", 40), 160);
});

test("the card of a saved challenge is a 1200×630 PNG, drawn once", async () => {
  let finds = 0;
  const find = async (id) => (++finds, id === saved.id ? saved : null);
  const card = await cards.shareCard(saved.id, "en", find);
  assert.deepEqual(
    [...card.png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  assert.equal(card.png.readUInt32BE(16), 1200);
  assert.equal(card.png.readUInt32BE(20), 630);
  // Asked for again, the same bytes come from the kept card.
  assert.equal((await cards.shareCard(saved.id, "en", find)).png, card.png);
  // A changed score is a new card.
  const raised = async () => ({ ...saved, score: 5000 });
  assert.notEqual(
    (await cards.shareCard(saved.id, "en", raised)).png,
    card.png,
  );
  // No such challenge, or a game dingn doesn't show: no card.
  assert.equal(await cards.shareCard("AAAAAAAAAAAA", "en", find), null);
  assert.equal(
    await cards.shareCard(saved.id, "en", async () => ({
      ...saved,
      game: "nope",
    })),
    null,
  );
});

test("the picture's address is checked before anything is drawn", async () => {
  assert.equal(
    cards.isShareCardPath("/share/challenge/Xq3v9TzK1bWm.png"),
    true,
  );
  assert.equal(cards.isShareCardPath("/share/challenge/short.png"), false);
  assert.equal(cards.isShareCardPath("/share/challenge/Xq3v9TzK1bWm"), false);
  assert.equal(
    cards.shareCardUrl("https://dingn.com", saved, "pt-BR"),
    "https://dingn.com/share/challenge/Xq3v9TzK1bWm.png?l=pt-BR&s=4140",
  );
  // Nothing saved under the id.
  const missing = await call("/share/challenge/AAAAAAAAAAAA.png?l=zz");
  assert.equal(missing.status, 404);
  assert.equal(missing.headers["Cache-Control"], "no-store");
  assert.equal(
    (await call("/share/challenge/AAAAAAAAAAAA.png", "POST")).status,
    405,
  );
});
