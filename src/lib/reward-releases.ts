// The admin Rewards page's calls for reward system releases
// (scripts/reward-releases.mjs).
import { api } from "./api";

export type RewardRelease = {
  version: string;
  /** The package file on GitHub. */
  url: string;
  /** The release on GitHub, with its notes. */
  notes: string;
  uploadedAt: string | null;
  /** When an admin approved it, which made it live. */
  approvedAt: string | null;
  /** Why it was sent back, if it was. */
  rejected: string | null;
  /** Whether it was uploaded as a plugin bundle; older ones can't go live. */
  bundle: boolean;
};
export type RewardReleases = {
  system: string;
  /** The version dingn runs, or null for its built-in copy. */
  live: string | null;
  /** What the server that answered runs, and why not the live version. */
  running: {
    version: string;
    builtIn: boolean;
    problem: string | null;
  } | null;
  versions: RewardRelease[];
};

export const listRewardReleases = () =>
  api<{ systems: RewardReleases[] }>("/api/admin/rewards");

export const reviewRewardRelease = (
  system: string,
  version: string,
  change: { action: "approve" } | { action: "reject"; reason: string },
) =>
  api<RewardReleases>("/api/admin/rewards/update", {
    system,
    version,
    ...change,
  });
