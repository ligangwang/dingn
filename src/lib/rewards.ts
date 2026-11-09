// Coins and badges (scripts/rewards.mjs). Games list their badges in
// game.json and award them through the SDK; the website records them here and
// keeps the signed-in player's wallet in a small shared store, so the header's
// coin count updates as soon as a game pays out.
import { api } from "./api";

export type Tier = "bronze" | "silver" | "gold" | "diamond";
export type BadgeIcon =
  | "boss"
  | "stars"
  | "star"
  | "squad"
  | "trophy"
  | "crown"
  | "bolt"
  | "heart"
  | "target"
  | "clock";
/** A badge as a game declares it in game.json. */
export type BadgeDef = {
  id: string;
  tier: Tier;
  level?: number;
  icon?: BadgeIcon;
  coins: number;
  title: { en: string; zh: string };
};
export type EarnedBadge = BadgeDef & { game: string; at: string };
export type Wallet = { coins: number; badges: EarnedBadge[] };
export type Unlock = {
  badge: Omit<BadgeDef, "coins">;
  new: boolean;
  /** Coins this unlock paid. */
  coins: number;
  /** The player's coins afterwards, or null for a test unlock. */
  balance: number | null;
  /** From a version dingn has not reviewed: nothing was saved. */
  test?: boolean;
};

/** A "Badge earned" popup on the player page. */
export type EarnedToast = {
  key: number;
  /** How many badges this popup stands for (several arrive together). */
  count: number;
  badge: BadgeDef;
  coins: number;
  test: boolean;
};

// Badges awarded within this long of the popup appearing join it, so a
// returning player who catches up on past levels sees one popup, not ten.
export const MERGE_TOAST_MS = 1500;
const TIER_RANK: Record<Tier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  diamond: 3,
};

/** One popup for two awards: the higher-tier badge shows, coins add up. */
export function mergeToasts(a: EarnedToast, b: EarnedToast): EarnedToast {
  return {
    key: b.key,
    count: a.count + b.count,
    badge:
      TIER_RANK[b.badge.tier] >= TIER_RANK[a.badge.tier] ? b.badge : a.badge,
    coins: a.coins + b.coins,
    test: a.test || b.test,
  };
}

export const fetchWallet = () => api<Wallet>("/api/rewards/me");
export const unlockBadge = (game: string, version: string, badge: string) =>
  api<Unlock>("/api/rewards/unlock", { game, version, badge });

// ---- The signed-in player's wallet, shared by the header and pages ----

let wallet: Wallet | null = null;
let owner = "";
let loading: Promise<Wallet | null> | null = null;
const listeners = new Set<(wallet: Wallet | null) => void>();

function publish(next: Wallet | null) {
  wallet = next;
  for (const listener of listeners) listener(next);
}

export const currentWallet = (uid: string) => (uid === owner ? wallet : null);

export function subscribeWallet(listener: (wallet: Wallet | null) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Loads the wallet of the player `uid` once; "" (signed out) clears it. */
export function loadWallet(uid: string, force = false) {
  if (!uid) {
    owner = "";
    loading = null;
    publish(null);
    return Promise.resolve(null);
  }
  // Once loaded, answer with the shared wallet, which unlocks keep current.
  if (uid === owner && loading && !force)
    return loading.then(() => (owner === uid ? wallet : null));
  owner = uid;
  loading = fetchWallet()
    .then((value) => {
      if (owner === uid) publish(value);
      return value;
    })
    .catch(() => null);
  return loading;
}

/** Adds a badge the server just recorded to the shared wallet. */
export function addToWallet(
  uid: string,
  game: string,
  unlock: Unlock,
  def: BadgeDef,
) {
  if (uid !== owner || !wallet || !unlock.new || unlock.test) return;
  publish({
    coins: unlock.balance ?? wallet.coins + unlock.coins,
    badges: [
      {
        ...def,
        ...unlock.badge,
        coins: unlock.coins,
        game,
        at: new Date().toISOString(),
      },
      ...wallet.badges.filter((b) => !(b.game === game && b.id === def.id)),
    ],
  });
}
