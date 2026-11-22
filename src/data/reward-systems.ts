// The reward systems dingn's games feed: each is its own package, in its own
// repository, that decides what players earn (see AGENTS.md, "Rewards").
// The admin Rewards page (/admin/rewards/) lists them in this order. To add
// one, install its package and add it here.
import pkg from "../../package.json";
import { REWARD_KINDS, EVENTS } from "kingdom/rewards";

export type RewardSystem = {
  id: string;
  title: string;
  description: string;
  /** owner/name on GitHub. */
  repo: string;
  /** The package name in package.json. */
  packageName: string;
  /** The reward kinds it grants, and the events each listens for. */
  kinds: { id: string; on: string[] }[];
  /** The events dingn reports to it. */
  events: string[];
};

export const REWARD_SYSTEMS: RewardSystem[] = [
  {
    id: "kingdom",
    title: "Kingdom",
    description:
      "Account XP and levels, honors, coins for badges and play, the coin shop, and the 3D kingdom players build with their coins.",
    repo: "ligangwang/kingdom",
    packageName: "kingdom",
    kinds: REWARD_KINDS.map(({ id, on }) => ({ id, on: [...on] })),
    events: Object.values(EVENTS),
  },
];

const dependencies: Record<string, string> = pkg.dependencies;

/**
 * The commit of a reward system's repository that dingn runs, from its
 * pinned tarball in package.json, or null when it isn't pinned to one.
 */
export function pinnedCommit(system: RewardSystem): string | null {
  const spec = dependencies[system.packageName] ?? "";
  return /\/tar\.gz\/([0-9a-f]{7,40})$/.exec(spec)?.[1] ?? null;
}
