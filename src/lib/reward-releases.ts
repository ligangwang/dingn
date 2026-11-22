// The admin Rewards page's calls for reward system releases
// (scripts/reward-releases.mjs).
import { api } from "./api";

export type RewardRelease = {
  version: string;
  /** The package file dingn installs. */
  url: string;
  /** The release on GitHub, with its notes. */
  notes: string;
  uploadedAt: string | null;
  /** When an admin approved it, which installed and deployed it. */
  approvedAt: string | null;
  /** Why it was sent back, if it was. */
  rejected: string | null;
};
export type RewardReleases = { system: string; versions: RewardRelease[] };

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
