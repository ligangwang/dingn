import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

let dir, registry, uploads, admin, zipLib;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-dev-games-"));
  process.env.GAMES_LOCAL_DIR = dir;
  registry = await import("../scripts/game-registry.mjs");
  uploads = await import("../scripts/developer-games.mjs");
  admin = await import("../scripts/games-admin.mjs");
  zipLib = await import("../scripts/zip.mjs");
  // dingn's own game, published from the repository: it has no owner.
  await registry.updateRecord("crowd", (r) =>
    registry.addVersion(
      r,
      registry.validateManifest({
        id: "crowd",
        version: "1.0.0",
        title: { en: "Crowd Rush", zh: "人潮突击" },
      }),
    ),
  );
});
after(() => rm(dir, { recursive: true, force: true }));

/** A zip like the ones zip tools make: deflated, with folder entries. */
function deflatedZip(files) {
  const local = [],
    central = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const data = Buffer.from(contents);
    const packed = name.endsWith("/") ? data : deflateRawSync(data);
    const method = name.endsWith("/") ? 0 : 8;
    const fileName = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    local.push(header, fileName, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, fileName);
    offset += 30 + fileName.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

const gameJson = (id, version, extra = {}) =>
  JSON.stringify({
    id,
    version,
    title: { en: "Sky Hop", zh: "跳跳云" },
    ...extra,
  });

test("unzip reads deflated zips and leaves out folders and zip-tool extras", () => {
  const files = zipLib.unzip(
    deflatedZip({
      "sky/": "",
      "sky/game.json": gameJson("skyhop", "1.0.0"),
      "sky/index.html": "<p>hop</p>",
      "sky/.DS_Store": "x",
      "__MACOSX/sky/._index.html": "x",
    }),
  );
  assert.deepEqual(Object.keys(files).sort(), [
    "sky/game.json",
    "sky/index.html",
  ]);
  assert.equal(files["sky/index.html"].toString(), "<p>hop</p>");
});

test("unzip refuses unsafe, oversized and broken zips", () => {
  const code = (fn) => {
    try {
      fn();
    } catch (error) {
      return error.code;
    }
    return "ok";
  };
  assert.equal(
    code(() => zipLib.unzip(Buffer.from("not a zip"))),
    "invalid-zip",
  );
  assert.equal(
    code(() => zipLib.unzip(deflatedZip({ "../evil.html": "x" }))),
    "bad-file",
  );
  const limits = { ...zipLib.ZIP_LIMITS, maxFiles: 2, maxFile: 1000 };
  assert.equal(
    code(() => zipLib.unzip(deflatedZip({ a: "1", b: "2", c: "3" }), limits)),
    "too-many-files",
  );
  assert.equal(
    code(() => zipLib.unzip(deflatedZip({ big: "x".repeat(2000) }), limits)),
    "too-large",
  );
  // Patches the first central directory entry of a one-file zip.
  const patch = (zip, at, value, bytes = 4) => {
    const entry = zip.readUInt32LE(zip.length - 22 + 16);
    if (bytes === 4) zip.writeUInt32LE(value, entry + at);
    else zip.writeUInt16LE(value, entry + at);
    return zip;
  };
  // A file that inflates to more than its declared size is refused.
  const bomb = patch(deflatedZip({ a: "x".repeat(5000) }), 24, 10);
  assert.equal(
    code(() => zipLib.unzip(bomb)),
    "invalid-zip",
  );
  const encrypted = patch(deflatedZip({ a: "x" }), 8, 1, 2);
  assert.equal(
    code(() => zipLib.unzip(encrypted)),
    "encrypted",
  );
});

test("an upload needs game.json, an entry page and files dingn can serve", () => {
  const prepared = uploads.prepareUpload({
    "sky/game.json": Buffer.from(gameJson("skyhop", "1.0.0")),
    "sky/index.html": Buffer.from("<p>hop</p>"),
    "sky/img/hero.png": Buffer.from("png"),
  });
  assert.equal(prepared.manifest.id, "skyhop");
  assert.deepEqual(Object.keys(prepared.files).sort(), [
    "game.json",
    "img/hero.png",
    "index.html",
  ]);
  const code = (files) => {
    try {
      uploads.prepareUpload(
        Object.fromEntries(
          Object.entries(files).map(([k, v]) => [k, Buffer.from(v)]),
        ),
      );
    } catch (error) {
      return error.message;
    }
  };
  assert.equal(code({ "index.html": "x" }), "no-manifest");
  assert.equal(
    code({ "game.json": "{", "index.html": "x" }),
    "invalid-manifest",
  );
  assert.equal(
    code({ "game.json": gameJson("skyhop", "1.0.0"), "play.html": "x" }),
    "missing-entry",
  );
  assert.equal(
    code({
      "game.json": gameJson("skyhop", "1.0.0"),
      "index.html": "x",
      "setup.exe": "x",
    }),
    "unsupported-type",
  );
});

test("a game belongs to the developer who first uploaded it", () => {
  const ada = { uid: "ada", email: "ada@example.com" };
  const bob = { uid: "bob", email: "bob@example.com" };
  const m = registry.validateManifest(JSON.parse(gameJson("skyhop", "1.0.0")));
  const reserved = uploads.reserveUpload(null, m, ada, 1000);
  assert.equal(reserved.owner, "ada");
  assert.throws(() => uploads.reserveUpload(reserved, m, bob), /not-your-game/);
  // The same version cannot be uploaded twice at once.
  assert.throws(
    () => uploads.reserveUpload(reserved, m, ada, 2000),
    /upload-in-progress/,
  );
  const done = uploads.finishUpload(reserved, m, ada);
  assert.equal(done.beta, "1.0.0");
  assert.equal(done.live, null);
  assert.deepEqual(done.pending, {});
  assert.equal(done.versions["1.0.0"].uploadedBy, "ada");
  assert.throws(() => uploads.reserveUpload(done, m, ada), /version-exists/);
  // dingn's own games cannot be uploaded to.
  assert.throws(
    () => uploads.reserveUpload({ id: "crowd", versions: {} }, m, ada),
    /not-your-game/,
  );
  // Until an admin makes it live, it is an unreviewed preview.
  assert.equal(registry.publicGame(done, "beta").preview, true);
  const live = registry.pointChannel(done, "1.0.0", "live");
  assert.equal(registry.publicGame(live).preview, false);
});

const origin = "http://127.0.0.1:3001";
function call(pathname, body, { claims, type = "application/json" } = {}) {
  const req = Object.assign(
    Readable.from([Buffer.isBuffer(body) ? body : JSON.stringify(body ?? {})]),
    {
      method: "POST",
      url: pathname,
      headers: { origin, "x-dingn-request": "1", "content-type": type },
    },
  );
  return new Promise((resolve) => {
    let status = 0;
    const res = {
      setHeader() {},
      writeHead: (s) => (status = s),
      end: (b) => resolve({ status, body: b ? JSON.parse(b) : null }),
    };
    void uploads.handleDeveloperGames(req, res, pathname, {
      verify: async () => claims,
      exchange: async () => "id-token",
    });
  });
}
const upload = (zip, claims) =>
  call("/api/developer/games/upload", zip, {
    claims,
    type: "application/zip",
  });

test("developers upload a zip and it becomes their game's beta", async () => {
  const ada = { uid: "ada", email: "ada@example.com", developer: true };
  const visitor = { uid: "eve", email: "eve@example.com" };
  const zip = deflatedZip({
    "game.json": gameJson("cloudhop", "1.0.0"),
    "index.html": "<p>hop</p>",
    "js/main.js": "console.log(1)",
  });

  const listed = (await call("/api/developer/games", {}, { claims: visitor }))
    .body;
  assert.equal(listed.developer, false);
  assert.deepEqual(listed.games, []);
  assert.equal((await upload(zip, visitor)).status, 403);
  // Uploads must come from dingn's own pages.
  assert.equal(
    (await call("/api/developer/games/upload", zip, { claims: ada })).status,
    403,
  );

  const first = await upload(zip, ada);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.play, "/play/cloudhop/?v=1.0.0");
  assert.equal(first.body.game.beta, "1.0.0");
  assert.equal(first.body.game.versions[0].reviewed, false);
  assert.equal(
    await readFile(
      path.join(dir, "games", "cloudhop", "1.0.0", "js", "main.js"),
      "utf8",
    ),
    "console.log(1)",
  );
  const record = await registry.getRecord("cloudhop");
  assert.equal(record.owner, "ada");
  assert.equal(record.live, null);

  const again = await upload(zip, ada);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "version-exists");
  const bob = { uid: "bob", email: "bob@example.com", developer: true };
  const stolen = await upload(
    deflatedZip({
      "game.json": gameJson("cloudhop", "2.0.0"),
      "index.html": "<p>mine</p>",
    }),
    bob,
  );
  assert.equal(stolen.status, 403);
  assert.equal(stolen.body.error, "not-your-game");
  const crowd = await upload(
    deflatedZip({
      "game.json": gameJson("crowd", "9.0.0"),
      "index.html": "x",
    }),
    bob,
  );
  assert.equal(crowd.body.error, "not-your-game");
  const broken = await upload(
    deflatedZip({ "game.json": gameJson("Bad", "1"), "index.html": "x" }),
    bob,
  );
  assert.equal(broken.body.error, "invalid-manifest");
  assert.match(broken.body.detail, /id must be/);

  const mine = await call("/api/developer/games", {}, { claims: ada });
  assert.deepEqual(
    mine.body.games.map((g) => g.id),
    ["cloudhop"],
  );
});

test("admins grant and remove developer access by email", async () => {
  const claims = { u1: { admin: true }, u2: {} };
  const users = {
    async listUsers() {
      return {
        users: Object.entries(claims).map(([uid, c]) => ({
          uid,
          email: `${uid}@example.com`,
          customClaims: c,
        })),
      };
    },
    async getUserByEmail(email) {
      const uid = email.split("@")[0];
      if (!claims[uid]) throw new Error("not found");
      return { uid, email, customClaims: claims[uid] };
    },
    async setCustomUserClaims(uid, value) {
      claims[uid] = value;
    },
  };
  const adminCall = (pathname, body) =>
    new Promise((resolve) => {
      const req = Object.assign(Readable.from([JSON.stringify(body)]), {
        method: "POST",
        headers: {
          origin,
          "x-dingn-request": "1",
          "content-type": "application/json",
        },
      });
      let status = 0;
      void admin.handleAdminGames(
        req,
        {
          setHeader() {},
          writeHead: (s) => (status = s),
          end: (b) => resolve({ status, body: JSON.parse(b) }),
        },
        pathname,
        {
          verify: async () => ({ uid: "u1", admin: true }),
          exchange: async () => "t",
          users,
        },
      );
    });
  const added = await adminCall("/api/admin/developers/update", {
    email: "u2@example.com",
    action: "add",
  });
  assert.equal(added.status, 200);
  assert.deepEqual(claims.u2, { developer: true });
  assert.deepEqual(
    (await adminCall("/api/admin/developers", {})).body.developers,
    [{ uid: "u2", email: "u2@example.com" }],
  );
  // Removing keeps the account's other claims.
  claims.u2.admin = true;
  await adminCall("/api/admin/developers/update", {
    email: "u2@example.com",
    action: "remove",
  });
  // It also stops the account from signing up again by itself.
  assert.deepEqual(claims.u2, { admin: true, developerBlocked: true });
  assert.equal(
    (
      await adminCall("/api/admin/developers/update", {
        email: "nobody@example.com",
        action: "add",
      })
    ).status,
    404,
  );
});

test("every uploaded file is sandboxed, whatever its type or case", async () => {
  const ada = { uid: "ada", email: "ada@example.com", developer: true };
  const result = await upload(
    deflatedZip({
      "game.json": gameJson("cloudhop", "1.1.0"),
      "index.html": "<p>hop</p>",
      "attack.HTML": "<script>alert(1)</script>",
      "attack.svg":
        "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
      "img/a.png": "png",
    }),
    ada,
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const get = (file, dest) =>
    new Promise((resolve) => {
      const pathname = `/g/cloudhop/1.1.0/${file}`;
      const req = Object.assign(new EventEmitter(), {
        method: "GET",
        url: pathname,
        headers: dest ? { "sec-fetch-dest": dest } : {},
      });
      const res = Object.assign(new EventEmitter(), {
        headersSent: false,
        writeHead(status, headers) {
          this.status = status;
          this.headers = headers;
        },
        write() {
          return true;
        },
        end() {
          resolve(this);
        },
      });
      void registry.handleGames(req, res, pathname);
    });
  for (const file of ["attack.HTML", "attack.svg", "img/a.png"]) {
    const res = await get(file);
    assert.equal(res.status, 200, file);
    assert.match(res.headers["Content-Security-Policy"], /^sandbox /, file);
  }
  for (const file of ["attack.HTML", "attack.svg"])
    assert.equal((await get(file, "document")).status, 302, file);
});

test("a game page opened on its own goes to the player page", async () => {
  const req = Object.assign(new EventEmitter(), {
    method: "GET",
    url: "/g/cloudhop/1.0.0/index.html",
    headers: { "sec-fetch-dest": "document" },
  });
  const result = await new Promise((resolve) => {
    const res = {
      headersSent: false,
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end() {
        resolve(this);
      },
    };
    void registry.handleGames(req, res, "/g/cloudhop/1.0.0/index.html");
  });
  assert.equal(result.status, 302);
  assert.equal(result.headers.Location, "/play/cloudhop/?v=1.0.0");
});
