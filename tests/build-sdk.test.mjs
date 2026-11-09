import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32 } from "node:zlib";
import { buildSdk, zip } from "../scripts/build-sdk.mjs";

const repo = path.resolve(import.meta.dirname, "..");

/** Reads a stored (uncompressed) zip through its central directory. */
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "has an end of central directory record");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(at), 0x02014b50);
    const crc = buffer.readUInt32LE(at + 16);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    assert.equal(buffer.readUInt32LE(offset), 0x04034b50);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26);
    const data = buffer.subarray(start, start + size);
    assert.equal(crc32(data), crc, `${name} checksum`);
    files[name] = data.toString("utf8");
    at += 46 + nameLength;
  }
  return files;
}

test("zip() writes an archive that reads back unchanged", () => {
  const files = { "a/one.txt": "hello", "a/二.txt": "你好" };
  assert.deepEqual(unzip(zip(files)), files);
  // The same input always gives the same bytes, so builds are repeatable.
  assert.deepEqual(zip(files), zip(files));
});

test("the website serves the SDK, its types and the starter game", async () => {
  const out = await mkdtemp(path.join(tmpdir(), "dingn-sdk-"));
  try {
    buildSdk(repo, out);
    const sdk = path.join(repo, "packages", "game-sdk");
    for (const name of ["dingn-sdk.js", "dingn-sdk.d.ts"])
      assert.equal(
        await readFile(path.join(out, name), "utf8"),
        await readFile(path.join(sdk, name), "utf8"),
      );
    const starter = unzip(await readFile(path.join(out, "starter.zip")));
    assert.deepEqual(Object.keys(starter).sort(), [
      "dingn-starter/README.md",
      "dingn-starter/game.json",
      "dingn-starter/index.html",
      "dingn-starter/main.js",
      "dingn-starter/style.css",
    ]);
    // The starter loads the SDK from the address the website serves it at.
    assert.match(
      starter["dingn-starter/main.js"],
      /from "https:\/\/dingn\.com\/sdk\/v1\/dingn-sdk\.js"/,
    );
    const manifest = JSON.parse(starter["dingn-starter/game.json"]);
    const { validateManifest } = await import("../scripts/game-registry.mjs");
    assert.equal(validateManifest(manifest).id, "mygame");
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
