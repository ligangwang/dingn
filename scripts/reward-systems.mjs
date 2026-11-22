// The reward systems that publish releases to dingn (scripts/reward-
// releases.mjs), by id: the repository whose GitHub releases hold each
// version, and the package name dingn installs it as. The admin Rewards
// page lists the same systems (src/data/reward-systems.ts).
export const RELEASE_SYSTEMS = {
  kingdom: { repo: "ligangwang/kingdom", package: "kingdom" },
};

export const RELEASE_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/** Where a version's package file is: its GitHub release. */
export function releaseUrl(system, version) {
  if (!Object.hasOwn(RELEASE_SYSTEMS, system))
    throw new Error(`Unknown reward system: ${system}`);
  if (!RELEASE_VERSION.test(version))
    throw new Error(`Not a version: ${version}`);
  const { repo, package: name } = RELEASE_SYSTEMS[system];
  return `https://github.com/${repo}/releases/download/v${version}/${name}-${version}.tgz`;
}
