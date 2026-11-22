// Reward system releases, reviewed like games: CI announces a version with
// an admin's upload key, an admin approves it on the website or with a
// review key, and approving starts the workflow that installs and deploys.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, releases, keys;
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
  keys = await import("../scripts/upload-keys.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

const origin = "http://127.0.0.1:3001";
function call(
  pathname,
  body,
  { claims = { uid: "boss", admin: true }, headers = {}, dispatch } = {},
) {
  const req = Object.assign(Readable.from([JSON.stringify(body ?? {})]), {
    method: "POST",
    url: pathname,
    headers: {
      origin,
      "x-dingn-request": "1",
      "content-type": "application/json",
      cookie: "__session=refresh-token",
      ...headers,
    },
  });
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
      dispatch: dispatch ?? (async () => {}),
      now: () => "2026-11-22T12:00:00.000Z",
    });
  });
}
const bearer = (key) => ({ authorization: `Bearer ${key}` });

test("a release's package file is its GitHub release", () => {
  assert.equal(
    releases.releaseUrl("kingdom", "0.2.0"),
    "https://github.com/ligangwang/kingdom/releases/download/v0.2.0/kingdom-0.2.0.tgz",
  );
  assert.throws(() => releases.releaseUrl("kingdom", "0.2"));
  assert.throws(() => releases.releaseUrl("__proto__", "0.2.0"));
});

test("CI announces a version with an admin's upload key, and it waits", async () => {
  const { key } = await keys.createKey("boss", "kingdom CI");
  const up = await call(
    "/api/rewards/upload",
    { system: "kingdom", version: "0.2.0" },
    { headers: bearer(key) },
  );
  assert.equal(up.status, 200);
  assert.deepEqual(
    up.body.versions.map((v) => v.version),
    ["0.2.0"],
  );
  assert.equal(up.body.versions[0].approvedAt, null);
  // Announcing it again changes nothing.
  const again = await call(
    "/api/rewards/upload",
    { system: "kingdom", version: "0.2.0" },
    { headers: bearer(key) },
  );
  assert.equal(again.status, 200);
  assert.equal(again.body.versions.length, 1);
  // The reviewers were asked by mail, once.
  const mail = JSON.parse(
    await readFile(path.join(dir, "store", "mail.json"), "utf8"),
  );
  assert.deepEqual(
    Object.values(mail).map((m) => m.message.subject),
    ["dingn: kingdom 0.2.0 is waiting for review"],
  );
});

test("only an admin's upload key can announce a version, and only a known one", async () => {
  const { key } = await keys.createKey("dev", "my game");
  const dev = await call(
    "/api/rewards/upload",
    { system: "kingdom", version: "0.3.0" },
    { headers: bearer(key) },
  );
  assert.equal(dev.status, 403);
  const session = await call("/api/rewards/upload", {
    system: "kingdom",
    version: "0.3.0",
  });
  assert.equal(session.status, 401);
  const { key: boss } = await keys.createKey("boss", "other");
  for (const body of [
    { system: "stars", version: "1.0.0" },
    { system: "kingdom", version: "latest" },
  ]) {
    const bad = await call("/api/rewards/upload", body, {
      headers: bearer(boss),
    });
    assert.equal(bad.status, 400);
  }
});

test("approving starts the install and deploy, then records it", async () => {
  const started = [];
  const ok = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.2.0", action: "approve" },
    { dispatch: async (...args) => started.push(args) },
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(started, [["kingdom", "0.2.0"]]);
  assert.equal(ok.body.versions[0].approvedAt, "2026-11-22T12:00:00.000Z");
  // Approving it again starts the install and deploy again, in case the
  // last one failed; sending it back is too late.
  const again = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.2.0", action: "approve" },
    { dispatch: async (...args) => started.push(args) },
  );
  assert.equal(again.status, 200);
  assert.equal(started.length, 2);
  const twice = await call("/api/admin/rewards/update", {
    system: "kingdom",
    version: "0.2.0",
    action: "reject",
    reason: "late",
  });
  assert.equal(twice.status, 409);
});

test("a failed deploy start leaves the version waiting", async () => {
  const { key } = await keys.createKey("boss", "ci 2");
  await call(
    "/api/rewards/upload",
    { system: "kingdom", version: "0.3.0" },
    { headers: bearer(key) },
  );
  const failed = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.3.0", action: "approve" },
    {
      dispatch: () =>
        releases.dispatchInstall("kingdom", "0.3.0", { token: "" }),
    },
  );
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error, "deploy-unavailable");
  const list = await call("/api/admin/rewards", {});
  const v = list.body.systems[0].versions.find((x) => x.version === "0.3.0");
  assert.equal(v.approvedAt, null);
});

test("a review key may reject a version, with a reason", async () => {
  const { key } = await keys.createAdminKey("boss", "assistant");
  const noReason = await call(
    "/api/admin/rewards/update",
    { system: "kingdom", version: "0.3.0", action: "reject" },
    { headers: bearer(key) },
  );
  assert.equal(noReason.status, 400);
  const rejected = await call(
    "/api/admin/rewards/update",
    {
      system: "kingdom",
      version: "0.3.0",
      action: "reject",
      reason: "Breaks the build page",
    },
    { headers: bearer(key) },
  );
  assert.equal(rejected.status, 200);
  const v = rejected.body.versions.find((x) => x.version === "0.3.0");
  assert.equal(v.rejected, "Breaks the build page");
});

test("only admins see and review releases", async () => {
  const player = await call(
    "/api/admin/rewards",
    {},
    {
      claims: { uid: "p", admin: false },
    },
  );
  assert.equal(player.status, 403);
});

test("starting the install asks GitHub to run the Website workflow", async () => {
  let asked;
  await releases.dispatchInstall("kingdom", "0.2.0", {
    token: "t0ken",
    fetchImpl: async (url, init) => {
      asked = { url, init };
      return { ok: true };
    },
  });
  assert.equal(
    asked.url,
    "https://api.github.com/repos/ligangwang/dingn/actions/workflows/website.yml/dispatches",
  );
  assert.equal(asked.init.headers.Authorization, "Bearer t0ken");
  assert.deepEqual(JSON.parse(asked.init.body), {
    ref: "main",
    inputs: { reward: "kingdom", reward_version: "0.2.0" },
  });
  await assert.rejects(
    releases.dispatchInstall("kingdom", "0.2.0", {
      token: "t0ken",
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => "" }),
    }),
    /deploy-unavailable/,
  );
});
