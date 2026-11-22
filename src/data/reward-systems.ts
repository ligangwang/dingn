// The reward systems dingn's games feed: each is its own repository that
// decides what players earn, and runs here as a plugin uploaded and approved
// like a game (see AGENTS.md, "Rewards"). The admin Rewards page
// (/admin/rewards/) lists them in this order; what each grants comes from
// its live version. To add one, add it here and in
// scripts/reward-systems.mjs.

export type RewardSystem = {
  id: string;
  title: string;
  description: string;
  /** owner/name on GitHub. */
  repo: string;
};

export const REWARD_SYSTEMS: RewardSystem[] = [
  {
    id: "kingdom",
    title: "Kingdom",
    description:
      "Account XP and levels, honors, coins for badges and play, the coin shop, and the 3D kingdom players build with their coins.",
    repo: "ligangwang/kingdom",
  },
];
