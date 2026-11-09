#!/usr/bin/env node
// Copies the game SDK and a zip of the starter game into public/sdk/v1/, so
// the website serves them at https://dingn.com/sdk/v1/. Runs before every
// build (npm's prebuild) and dev server (predev); the output is not committed.
//
// v1 is the protocol version. Changes to it must stay backward compatible,
// because games load it from this address (see packages/game-sdk/README.md).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { fileURLToPath } from "node:url";

/**
 * A zip archive of `files` (name → contents), stored without compression.
 * The starter is a few kilobytes, so this keeps the build free of a zip
 * dependency.
 */
export function zip(files) {
  const local = [],
    central = [];
  let offset = 0;
  // 1980-01-01 00:00, so the zip is the same on every build.
  const time = 0,
    date = (0 << 9) | (1 << 5) | 1;
  for (const [name, contents] of Object.entries(files)) {
    const data = Buffer.from(contents);
    const fileName = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(0, 8); // stored
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, fileName, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular, readable file
    entry.writeUInt32LE(offset, 42);
    central.push(entry, fileName);
    offset += header.length + fileName.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

/** The starter game's files, under one folder, as zip() takes them. */
export function starterFiles(sdkDir) {
  const starter = path.join(sdkDir, "starter");
  return Object.fromEntries(
    readdirSync(starter)
      .sort()
      .map((name) => [
        `dingn-starter/${name}`,
        readFileSync(path.join(starter, name)),
      ]),
  );
}

export function buildSdk(repo, out = path.join(repo, "public", "sdk", "v1")) {
  const sdkDir = path.join(repo, "packages", "game-sdk");
  mkdirSync(out, { recursive: true });
  for (const name of ["dingn-sdk.js", "dingn-sdk.d.ts"])
    writeFileSync(path.join(out, name), readFileSync(path.join(sdkDir, name)));
  writeFileSync(path.join(out, "starter.zip"), zip(starterFiles(sdkDir)));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  console.log(`Game SDK written to ${path.relative(repo, buildSdk(repo))}/`);
}
