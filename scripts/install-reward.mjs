#!/usr/bin/env node
// Installs an approved version of a reward system: points package.json and
// package-lock.json at its GitHub release. The Website workflow runs this
// when an admin approves a version on /admin/rewards/
// (scripts/reward-releases.mjs), then checks, commits and deploys.
//
//   node scripts/install-reward.mjs <system> <version>
//
// Prints "unchanged" when that version is already installed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { RELEASE_SYSTEMS, releaseUrl } from "./reward-systems.mjs";

const [system, version] = process.argv.slice(2);
const url = releaseUrl(system, version);
const name = RELEASE_SYSTEMS[system].package;
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.dependencies?.[name] === url) {
  console.log("unchanged");
} else {
  execFileSync("npm", ["install", "--save-exact", `${name}@${url}`], {
    stdio: "inherit",
  });
  console.log(`installed ${name} ${version}`);
}
