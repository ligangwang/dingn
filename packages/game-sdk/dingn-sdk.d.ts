export declare const PROTOCOL: 1;
/**
 * A language: "en", "zh-CN", "es", "pt-BR", "id", "ja", "ko", or another
 * dingn adds later. A game gets only languages its game.json `languages`
 * lists (English and Chinese for games that list none), so it can show any
 * code it receives.
 */
export type Locale =
  "en" | "zh-CN" | "es" | "pt-BR" | "id" | "ja" | "ko" | (string & {});
export type Player = {
  signedIn: boolean;
  name: string;
  avatar: string;
  /**
   * True for a test account that dingn's admins made for testing. A game may
   * show test tools (skip a level, unlock everything) to it, and must not
   * show them to anyone else. dingn already keeps test accounts off its
   * leaderboard and statistics. Websites from before test accounts leave it
   * out, so treat a missing value as false.
   */
  tester?: boolean;
};
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";
/** A badge from the game's game.json, in the player's language. */
export type Badge = {
  id: string;
  tier: BadgeTier;
  /** A level badge shows this number; other badges show `icon`. */
  level?: number;
  icon?: string;
  coins: number;
  title: string;
  earned: boolean;
};
export type BadgeUnlock = {
  /** False when the player already had this badge. */
  new: boolean;
  /** dingn coins this unlock paid. */
  coins: number;
  /** True in a version dingn has not reviewed, or in the playground: nothing was saved. */
  test?: boolean;
};
/** An upgrade from the `shop` in the game's game.json, in the player's language. */
export type ShopItem = {
  id: string;
  /** dingn coins. */
  price: number;
  /** An upgrade that must be bought first. */
  requires?: string;
  title: string;
  /** Bought by the signed-in player. Upgrades are bought once and kept. */
  owned: boolean;
};
export type Purchase = {
  /** False when the player already owned it: nothing was charged. */
  new: boolean;
  /** dingn coins this purchase cost. */
  coins: number;
  /** True in a version dingn has not reviewed, or in the playground: nothing was charged. */
  test?: boolean;
};
export type Earning = {
  /** dingn coins paid: less than asked, or 0, once today's allowance is used up. */
  coins: number;
  /** Coins this game can still pay the player today, or null in a test. */
  left: number | null;
  /** True in a version dingn has not reviewed, or in the playground: nothing was paid. */
  test?: boolean;
};
/** What a score is counted in, so dingn can word a challenge in both languages. */
export type ChallengeUnit =
  "points" | "digits" | "cards" | "levels" | "stars" | "words" | "coins";
/**
 * A score for anyone to beat. `mode` (1-24 lowercase letters, digits or
 * dashes) and `seed` (1-32 letters, digits or dashes, such as a day) tell the
 * game which round to replay, so the friend plays the same one.
 */
export type Challenge = {
  mode: string;
  seed?: string;
  /** A whole number from 0 to 1,000,000,000. */
  score: number;
  unit: ChallengeUnit;
  /**
   * The rules the round was played with, in the game's own terms (1-64
   * letters, digits, dots, dashes or underscores), such as the upgrades and
   * helpers the player had, so the friend can play under exactly the same
   * ones. dingn saves it with the challenge and gives it back unchanged.
   */
  rules?: string;
  /**
   * In `dingn.challenge` only: true when the player opening the link is the
   * one who made it (signed in to the same account, or in the same browser).
   * Then it is their own score to beat, not a friend's.
   */
  mine?: boolean;
};
/** A level's open challenge and where a score would stand in it, from `dingn.challengeStanding`. */
export type ChallengeStanding = {
  /** The nickname of the player who owns the challenge. */
  name: string;
  /** Their score to beat. */
  score: number;
  /** True when the challenge is the signed-in player's own. */
  mine: boolean;
  /** The place the score would take (the player's best counts if it is higher), or null below the results dingn keeps. */
  rank: number | null;
  /** How many players there would be, this one included. */
  players: number;
};
/** How a challenge round ended, from `dingn.challengeResult`. */
export type ChallengeOutcome = {
  /** True when the score is higher than the challenge's. */
  beat: boolean;
  /** False for a signed-out player, and in a test: nothing was posted. */
  posted: boolean;
  /** The player's best score under this challenge. */
  best: number;
  /** Its place among the results, or null below the ones dingn keeps. */
  rank: number | null;
  /** How many players have posted a result. */
  players: number;
  test?: boolean;
};
/** What signing in would bring the player, for `dingn.showSignIn`. */
export type SignInReason = "score" | "rewards" | "progress";
export type DingnGame = {
  gameId: string;
  version: string;
  locale: Locale;
  player: Player;
  /** False when the game was opened on its own, outside dingn. */
  embedded: boolean;
  onPlayer(listener: (player: Player) => void): () => void;
  /**
   * Called when the player switches language while playing, with the new
   * language (one the game lists). Show your text and pictures in it and
   * keep the player's game going. Returns a function that stops listening.
   */
  onLanguage(listener: (locale: Locale) => void): () => void;
  /** Saved on this device only. Keys: letters, digits, `._-`, up to 64. Values up to 16 KB as JSON. */
  storage: {
    get(key: string): Promise<Json>;
    set(key: string, value: Json): Promise<void>;
  };
  /** Saved to the signed-in player's account, up to 16 KB as JSON. save() rejects with code "signed_out" otherwise. */
  progress: { load(): Promise<Json>; save(data: Json): Promise<void> };
  /**
   * Badges and dingn coins. List badges in game.json; unlock(id) awards one to
   * the signed-in player (each pays once) and dingn shows a "Badge earned"
   * popup. unlock() rejects with code "signed_out" for a signed-out player.
   * Players spend coins on upgrades listed in game.json's `shop`.
   */
  rewards: {
    unlock(id: string): Promise<BadgeUnlock>;
    list(): Promise<Badge[]>;
    /**
     * Buys an upgrade from game.json's `shop` with the player's dingn coins.
     * dingn asks the player to confirm first. Rejects with code "cancelled"
     * (the player said no), "not_enough_coins", "requires" (buy the upgrade
     * it requires first) or "signed_out". A "not_enough_coins" error also
     * carries `balance`, the coins the player has, so the game can show how
     * many more they need.
     */
    spend(id: string): Promise<Purchase>;
    shop(): Promise<ShopItem[]>;
    /**
     * Pays the signed-in player 1-10 dingn coins for play itself, such as a
     * failed level that still got somewhere. Each game can pay a player at
     * most 500 coins a day this way, on top of its badges. Rejects with code
     * "signed_out" for a signed-out player.
     */
    earn(coins: number): Promise<Earning>;
  };
  /**
   * The challenge in the page's address when a friend's challenge link
   * opened the game, otherwise null. dingn has already shown the player the
   * score to beat; start that round and compare at the end.
   */
  challenge: Challenge | null;
  /**
   * A link to this game that opens the challenge of `challenge`'s level for
   * whoever follows it, with a link preview that shows the score. Share it
   * yourself (copy it, or navigator.share). A level (the game's `mode` and
   * `seed`, whatever its `rules`) has one challenge: the first signed-in player to challenge
   * it owns it, and a player who challenges a level that already has one
   * has their score posted under it instead, dingn tells them their place,
   * and the link is that challenge's. With `mode` "level" and the level's
   * number as `seed`, dingn names the level ("Level 28") where it shows the
   * challenge. Rejects with code "invalid" for a malformed challenge, and
   * "unknown_method" on a dingn website from before challenge links.
   */
  challengeLink(challenge: Challenge): Promise<string>;
  /**
   * Asks, without posting anything, whether `challenge`'s level already has
   * an open challenge, and where this score would stand in it. Null when the
   * level has none (and for a test account, whose challenges stay its own).
   * Call it at the end of a round played outside a challenge: with none,
   * offer "Challenge anyone"; with one, name its owner and the place and
   * offer to join it. Either button then calls `challengeLink`, which posts
   * the score. Only a signed-in player joins: a visitor gets the standing
   * as what signing in would bring (offer `requestSignIn()`), since a
   * visitor's `challengeLink` makes an unlisted challenge of their own.
   * Rejects with "invalid" for a malformed challenge, and
   * "unknown_method" on a dingn website from before this call.
   */
  challengeStanding(challenge: Challenge): Promise<ChallengeStanding | null>;
  /**
   * Call it when the player finishes the round of `dingn.challenge`, with
   * their score. A challenge is open to anyone: dingn posts a signed-in
   * player's result under it, where every result is ranked, and tells the
   * player whether they won; a signed-out player is told too and invited to
   * sign in. Each player keeps their best score. Rejects with code
   * "no_challenge" when the page was not opened from a challenge, and
   * "unknown_method" on a dingn website from before challenge results.
   */
  challengeResult(score: number): Promise<ChallengeOutcome>;
  /**
   * Tells dingn a round was played to the end (won or lost), for the
   * website's play statistics. Call it once per finished round.
   */
  roundEnded(): void;
  /** Sends the player to sign in at once. They come back to the game. */
  requestSignIn(): void;
  /**
   * Shows dingn's sign-in box over the game: what signing in brings, a
   * "Sign in free" button and a way to put it away. Draw no sign-in text,
   * link or button of your own; decide only when the box shows, such as on
   * the result of a round. `reasons` says what this player would gain:
   * "score" (their score saved and ranked), "rewards" (coins and badges),
   * "progress" (their progress saved). After `challengeResult` for a
   * signed-out player, dingn adds that their score will be posted under the
   * challenge. Nothing shows for a signed-in player, or on a dingn website
   * from before this call.
   */
  showSignIn(reasons?: SignInReason[]): void;
  /** Takes the sign-in box away, such as when the next round starts. */
  hideSignIn(): void;
  /** Leaves the game for a dingn page, such as "/" for the game list. The website keeps the player's language. */
  navigate(path: string): void;
  ready(): void;
};
export declare function connect(options?: {
  timeout?: number;
}): Promise<DingnGame>;
