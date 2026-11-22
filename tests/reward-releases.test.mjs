// Reward systems as plugins, reviewed like games: CI uploads a bundle with an
// admin's upload key, an admin approves it on the website or with a review
// key, and approving makes it live: this server runs its rules and the pages
// load its files, with no rebuild.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, releases, plugin, keys, zip, store;
const accounts = {
  boss: { customClaims: { admin: true }, email: "boss@example.com" },
  dev: { customClaims: { developer: true }, email: "dev@example.com" },
};
const users = {
  getUser: async (uid) => {
    if (!accounts[uid]) throw new Error("no user");
    return { uid, ...accounts[uid] };
  },
};

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-reward-releases-"));
  process.env.GAMES_LOCAL_DIR = dir;
  process.env.REVIEW_EMAIL = "review@example.com";
  releases = await import("../scripts/reward-releases.mjs");
  plugin = await import("../scripts/reward-plugin.mjs");
  keys = await import("../scripts/upload-keys.mjs");
  store = await import("../scripts/platform-store.mjs");
  ({ zip } = await import("../scripts/zip.mjs"));
});
after(() => rm(dir, { recursive: true, force: true }));

/** Rules as a plugin bundle has them: one module, no imports. */
const rulesFor = (title) => `
export const PLUGIN_API = 1;
const fn = () => 0;
export const rewards = { grant: fn, total: fn };
export const coins = { DAILY_GAME_COINS: 50, MAX_EARN: 10, MAX_GAME_COINS: 1000, TIER_COINS: {} };
export const levels = { levelFor: () => 7, levelProgress: fn, capPlayXp: fn, xpToReach: fn, DAILY_XP_CAP: 300 };
export const honors = { HONORS: [], honorName: () => ${JSON.stringify(title)}, honorOf: fn };
class RewardError extends Error {}
class KingdomError extends Error {}
export const ledger = { RewardError, awardBadge: fn, badgeXpOwed: fn, buyItem: fn, earnCoins: fn, payBadgeXp: fn, publicBadges: fn, wallet: fn };
export const kingdom = { KingdomError, STAGES: [], buildIn: fn, building: fn, kingdomView: fn, moveIn: fn, publicKingdom: fn, settleDoc: fn };
`;

function bundle(version, over = {}, files = {}) {
  return zip({
    "reward.json": JSON.stringify({
      system: "kingdom",
      version,
      api: 1,
      rules: "rules.mjs",
      ui: "ui.js",
      css: "kingdom.css",
      assets: "assets/kingdom/",
      ...over,
    }),
    "rules.mjs": rulesFor(`Plugin ${version}`),
    "ui.js": "export function mountKingdomPage() {}",
    "kingdom.css": ".kingdom {}",
    "assets/kingdom/CREDITS.md": "# Credits",
    ...files,
  });
}

const origin = "http://127.0.0.1:3001";
function call(
  pathname,
  body,
  { claims = { uid: "boss", admin: true }, headers = {}, reload } = {},
) {
  const binary = Buffer.isBuffer(body);
  const req = Object.assign(
    Readable.from([binary ? body : JSON.stringify(body ?? {})]),
    {
      method: "POST",
      url: pathname,
      headers: {
        origin,
        "x-dingn-request": "1",
        "content-type": binary ? "application/zip" : "application/json",
        cookie: "__session=refresh-token",
        ...headers,
      },
    },
  );
  return new Promise((resolve) => {
    let status = 0;
    const res = {
      setHeader() {},
      getHeader() {},
      writeHead: (s) => (status = s),
      end: (b) => resolve({ status, body: b ? JSON.parse(b) : null }),
    };
    void releases.handleRewardReleases(req, res, pathname, {
      verify: async () => claims,
      exchange: async () => "id-token",
      users,
      reload: reload ?? (async () => {}),
      now: () => "2026-11-22T12:00:00.000Z",
    });
  });
}
const bearer = (key) => ({ authorization: `Bearer ${key}` });

/** GET of a served file: its status and body. */
function get(pathname) {
  return new Promise((resolve) => {
    let status = 0;
    const res = {
      writeHead: (s) => (status = s),
      end: (b) => resolve({ status, body: b ? String(b) : "" }),
    };
    void plugin.serveRewardFile({ method: "GET", headers: {} }, res, pathname);
  });
}

test("CI uploads a bundle with an admin's upload key, and it waits", async () => {
  const { key } = await keys.createKey("boss", "kingdom CI");
  const up = await call("/api/rewards/upload", bundle("0.3.0"), {
    headers: bearer(key),
  });
  assert.equal(up.status, 200);
  assert.equal(up.body.live, null);
  assert.deepEqual(
    up.body.versions.map((v) => [v.version, v.approvedAt, v.bundle]),
    [["0.3.0", null, true]],
  );
  // Uploading it again changes nothing and mails no one.
  const again = await call("/api/rewards/upload", bundle("0.3.0"), {
    headers: bearer(key),
  });
  assert.equal(again.status, 200);
  const mail = JSON.parse(
    await readFile(path.join(dir, "store", "mail.json"), "utf8"),
  );
  assert.deepEqual(
    Object.values(mail).map((m) => m.message.subject),
    ["dingn: kingdom 0.3.0 is waiting for review"],
  );
  // Its files are kept, but not served until it is approved.
  assert.equal(
    await readFile(
      path.join(dir, "rewards", "kingdom", "0.3.0", "kingdom.css"),
      "utf8",
    ),
    ".kingdom {}",
  );
  plugin.clearReleaseCache();
  assert.equal((await get("/rewards/kingdom/0.3.0/ui.js")).status, 404);
});

test("only an admin's upload key can upload, and only a good bundle", async () => {
  const { key } = await keys.createKey("dev", "my game");
  const dev = await call("/api/rewards/upload", bundle("0.4.0"), {
    headers: bearer(key),
  });
  assert.equal(dev.status, 403);
  const session = await call("/api/rewards/upload", bundle("0.4.0"));
  assert.equal(session.status, 401);
  const { key: boss } = await keys.createKey("boss", "other");
  for (const [bad, code] of [
    [bundle("0.4.0", { system: "stars" }), "unknown-reward-system"],
    [bundle("latest"), "invalid-version"],
    [bundle("0.4.0", { api: 2 }), "unsupported-api"],
    [bundle("0.4.0", { ui: "missing.js" }), "missing-file"],
    [bundle("0.4.0", {}, { "../escape.js": "x" }), "bad-file"],
    [bundle("0.4.0", {}, { "run.sh": "x" }), "bad-file"],
    [Buffer.from("not a zip"), "invalid-zip"],
  ]) {
    const refused = await call("/api/rewards/upload", bad, {
      headers: bearer(boss),
    });
    assert.equal(refused.status, 400, code);
    assert.equal(refused.body.error, code);
  }
});

test("approving makes a version live; this server runs its rules at once", async () => {
  let reloaded = 0;
  const ok = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.3.0", action: "approve" },
    { reload: async () => reloaded++ },
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.body.live, "0.3.0");
  assert.equal(reloaded, 1);
  assert.ok(ok.body.versions[0].approvedAt);

  // Its files are served now, for good.
  plugin.clearReleaseCache();
  const css = await get("/rewards/kingdom/0.3.0/kingdom.css");
  assert.deepEqual(css, { status: 200, body: ".kingdom {}" });
  assert.equal((await get("/rewards/kingdom/0.3.0/../secret")).status, 404);
  assert.equal((await get("/rewards/kingdom/0.3.0/nothing.js")).status, 404);

  // The pages are told where to load it from.
  const live = await new Promise((resolve) => {
    void plugin.handlePlugins(
      {},
      { writeHead() {}, end: (b) => resolve(JSON.parse(b)) },
    );
  });
  assert.deepEqual(live.kingdom, {
    version: "0.3.0",
    base: "/rewards/kingdom/0.3.0/",
    rules: "/rewards/kingdom/0.3.0/rules.mjs",
    ui: "/rewards/kingdom/0.3.0/ui.js",
    css: "/rewards/kingdom/0.3.0/kingdom.css",
    assets: "/rewards/kingdom/0.3.0/assets/kingdom/",
  });

  // The server runs the plugin's rules, checked against the upload.
  const record = await store.getDoc("rewardReleases", "kingdom");
  // A passing storage failure is tried again on the next refresh.
  await plugin.useLive(record, {
    read: async () => {
      throw new Error("storage 503");
    },
  });
  assert.equal(plugin.rules().builtIn, true);
  assert.match(plugin.runtimeStatus().problem, /storage 503/);
  const rules = await plugin.useLive(record);
  assert.equal(rules.version, "0.3.0");
  assert.equal(plugin.rules().honors.honorName(1), "Plugin 0.3.0");
  assert.equal(plugin.runtimeStatus().builtIn, false);
});

test("a live version whose rules don't load leaves the rules as they were", async () => {
  const before = plugin.rules();
  const record = {
    live: "9.9.9",
    versions: {
      "9.9.9": {
        approvedAt: "x",
        bundle: { rules: "rules.mjs", rulesHash: "0".repeat(64) },
      },
    },
  };
  await plugin.useLive(record, { read: async () => Buffer.from("x") });
  assert.equal(plugin.rules(), before);
  assert.match(plugin.runtimeStatus().problem, /does not match its upload/);
  // With no live version, the built-in copy.
  await plugin.useLive({ versions: {} });
  assert.equal(plugin.rules().builtIn, true);
  assert.equal(plugin.runtimeStatus().problem, null);
});

test("approving an older approved version makes it live again", async () => {
  const { key } = await keys.createKey("boss", "ci again");
  await call("/api/rewards/upload", bundle("0.3.1"), { headers: bearer(key) });
  const newer = await call("/api/admin/rewards/update", {
    system: "kingdom",
    version: "0.3.1",
    action: "approve",
  });
  assert.equal(newer.body.live, "0.3.1");
  const back = await call("/api/admin/rewards/update", {
    system: "kingdom",
    version: "0.3.0",
    action: "approve",
  });
  assert.equal(back.status, 200);
  assert.equal(back.body.live, "0.3.0");
  // An approved version can't be sent back any more.
  const late = await call("/api/admin/rewards/update", {
    system: "kingdom",
    version: "0.3.1",
    action: "reject",
    reason: "Too late",
  });
  assert.equal(late.status, 409);
});

test("a review key may reject a version, with a reason", async () => {
  const { key: upload } = await keys.createKey("boss", "ci three");
  await call("/api/rewards/upload", bundle("0.5.0"), {
    headers: bearer(upload),
  });
  const { key } = await keys.createAdminKey("boss", "assistant");
  const noReason = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.5.0", action: "reject" },
    { headers: bearer(key) },
  );
  assert.equal(noReason.status, 400);
  const rejected = await call(
    "/api/admin/rewards/update",
    {
      system: "kingdom",
      version: "0.5.0",
      action: "reject",
      reason: "Breaks the build page",
    },
    { headers: bearer(key) },
  );
  assert.equal(rejected.status, 200);
  const v = rejected.body.versions.find((x) => x.version === "0.5.0");
  assert.equal(v.rejected, "Breaks the build page");
  assert.equal(rejected.body.live, "0.3.0");
  plugin.clearReleaseCache();
  assert.equal((await get("/rewards/kingdom/0.5.0/ui.js")).status, 404);
});

test("a version sent before bundles can't be made live", async () => {
  await store.updateDoc("rewardReleases", "kingdom", (r) => ({
    ...r,
    versions: { ...r.versions, "0.2.0": { uploadedAt: "x" } },
  }));
  const refused = await call("/api/admin/rewards/update", {
    system: "kingdom",
    version: "0.2.0",
    action: "approve",
  });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error, "no-bundle");
});

test("only admins see and review releases", async () => {
  const player = await call(
    "/api/admin/rewards",
    {},
    { claims: { uid: "p", admin: false } },
  );
  assert.equal(player.status, 403);
  const admin = await call("/api/admin/rewards", {});
  assert.equal(admin.status, 200);
  const kingdom = admin.body.systems.find((s) => s.system === "kingdom");
  assert.equal(kingdom.live, "0.3.0");
  assert.ok(kingdom.running);
});
