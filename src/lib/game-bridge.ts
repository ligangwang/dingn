// The website's side of the game SDK protocol (packages/game-sdk). A game in
// its sandboxed frame sends requests; this answers them for that one game.
// Everything a game sends is untrusted: keys, sizes and methods are checked
// here, and a game can only reach its own storage and progress.
import type { Locale } from "./i18n";

export const PROTOCOL = 1;
/** Largest stored value or progress save, as JSON. */
export const MAX_VALUE = 16 * 1024;
const KEY = /^[A-Za-z0-9._-]{1,64}$/;
/** Mirrors BADGE_ID in scripts/game-registry.mjs. */
const BADGE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export type Player = { signedIn: boolean; name: string; avatar: string };
export type GameRequest = {
  dingn: "game";
  v: number;
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};
export type HostReply =
  | { dingn: "host"; v: number; id: number; result: unknown }
  | {
      dingn: "host";
      v: number;
      id: number;
      error: { code: string; message: string };
    };

export type BridgeContext = {
  gameId: string;
  version: string;
  locale: Locale;
  player: Player;
  /** The website's localStorage, or null when the browser blocks it. */
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** The signed-in player's saved progress for this game, as JSON text. */
  loadProgress: () => Promise<string | null>;
  saveProgress: (json: string) => Promise<void>;
  signIn: () => void;
  /** Opens a dingn page (an already checked site path such as "/"). */
  navigate: (path: string) => void;
  ready: () => void;
  /**
   * Coins and badges (src/lib/rewards.ts). `unlock` records a badge for the
   * signed-in player; `list` gives the game's badges and which are earned.
   * Left out where rewards are not available.
   */
  rewards?: {
    unlock: (badge: string) => Promise<RewardResult>;
    list: () => Promise<RewardBadge[]>;
  };
};
export type RewardResult = { new: boolean; coins: number; test?: boolean };
export type RewardBadge = {
  id: string;
  tier: string;
  level?: number;
  icon?: string;
  coins: number;
  title: string;
  earned: boolean;
};

export const isGameRequest = (data: unknown): data is GameRequest =>
  !!data &&
  typeof data === "object" &&
  (data as GameRequest).dingn === "game" &&
  (data as GameRequest).v === PROTOCOL &&
  typeof (data as GameRequest).method === "string";

/** Where a game's device storage lives in the website's localStorage. */
export const storageKey = (gameId: string, key: string) =>
  `dingn.game.${gameId}.${key}`;
/**
 * A same-site path a game may send the player to: "/word/", never "//evil",
 * and no "//" anywhere, since adding or removing the /zh prefix could turn
 * "/zh//evil" into "//evil".
 */
export const SITE_PATH = /^(?!.*\/\/)\/[A-Za-z0-9\-._~/]*$/;
/** The `accounts/{uid}` field that holds a game's progress. */
export const progressField = (gameId: string) => `game_progress_${gameId}`;

/** A signed-in player's saved progress for a game, as JSON text. */
export function accountProgress(
  gameId: string,
  account: Record<string, unknown> | null | undefined,
): string | null {
  const value = account?.[progressField(gameId)];
  return typeof value === "string" ? value : null;
}

export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function encode(value: unknown) {
  let json: string | undefined;
  try {
    json = JSON.stringify(value ?? null);
  } catch {}
  if (json === undefined)
    throw new BridgeError("invalid", "The value must be JSON.");
  if (json.length > MAX_VALUE)
    throw new BridgeError("too_large", "The value is larger than 16 KB.");
  return json;
}
const decode = (json: string | null) => {
  if (json == null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

function key(params: GameRequest["params"]) {
  const value = params?.key;
  if (typeof value !== "string" || !KEY.test(value))
    throw new BridgeError(
      "invalid",
      "Keys are 1-64 letters, digits, dots, dashes or underscores.",
    );
  return value;
}

async function answer(
  request: GameRequest,
  ctx: BridgeContext,
): Promise<unknown> {
  switch (request.method) {
    case "init":
      return {
        gameId: ctx.gameId,
        version: ctx.version,
        locale: ctx.locale,
        player: ctx.player,
      };
    case "storage.get": {
      const k = key(request.params);
      return decode(ctx.storage?.getItem(storageKey(ctx.gameId, k)) ?? null);
    }
    case "storage.set": {
      const k = key(request.params);
      const json = encode(request.params?.value);
      try {
        ctx.storage?.setItem(storageKey(ctx.gameId, k), json);
      } catch {
        throw new BridgeError(
          "unavailable",
          "This browser is not saving data.",
        );
      }
      return null;
    }
    case "progress.load":
      return ctx.player.signedIn ? decode(await ctx.loadProgress()) : null;
    case "progress.save": {
      if (!ctx.player.signedIn)
        throw new BridgeError("signed_out", "Sign in to save progress.");
      await ctx.saveProgress(encode(request.params?.data));
      return null;
    }
    case "rewards.list":
      if (!ctx.rewards)
        throw new BridgeError("unavailable", "Rewards are not available here.");
      return ctx.rewards.list();
    case "rewards.unlock": {
      const id = request.params?.id;
      if (typeof id !== "string" || !BADGE_ID.test(id))
        throw new BridgeError(
          "invalid",
          "Badge ids are 1-40 lowercase letters, digits or dashes.",
        );
      if (!ctx.player.signedIn)
        throw new BridgeError("signed_out", "Sign in to earn badges.");
      if (!ctx.rewards)
        throw new BridgeError("unavailable", "Rewards are not available here.");
      return ctx.rewards.unlock(id);
    }
    case "signIn":
      ctx.signIn();
      return null;
    case "navigate": {
      const path = request.params?.path;
      if (typeof path !== "string" || !SITE_PATH.test(path))
        throw new BridgeError(
          "invalid",
          'Only dingn pages, such as "/", can be opened.',
        );
      ctx.navigate(path);
      return null;
    }
    case "ready":
      ctx.ready();
      return null;
    default:
      throw new BridgeError(
        "unknown_method",
        `dingn does not support "${request.method}".`,
      );
  }
}

/** Handles one request. Returns the reply to send, or null for a notification. */
export async function handleGameRequest(
  request: GameRequest,
  ctx: BridgeContext,
): Promise<HostReply | null> {
  const id = request.id;
  try {
    const result = await answer(request, ctx);
    return typeof id === "number"
      ? { dingn: "host", v: PROTOCOL, id, result }
      : null;
  } catch (error) {
    if (typeof id !== "number") return null;
    const known = error instanceof BridgeError;
    return {
      dingn: "host",
      v: PROTOCOL,
      id,
      error: {
        code: known ? error.code : "unavailable",
        message: known ? error.message : "dingn could not do that right now.",
      },
    };
  }
}
