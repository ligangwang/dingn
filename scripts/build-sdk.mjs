#!/usr/bin/env node
// Copies the game SDK and a zip of the starter game into public/sdk/v1/, so
// the website serves them at https://dingn.com/sdk/v1/. Runs before every
// build (npm's prebuild) and dev server (predev); the output is not committed.
//
// v1 is the protocol version. Changes to it must stay backward compatible,
// because games load it from this address (see packages/game-sdk/README.md).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zip } from "./zip.mjs";

export { zip };

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
