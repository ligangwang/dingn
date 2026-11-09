export declare const PROTOCOL: 1;
export type Locale = "en" | "zh-CN";
export type Player = { signedIn: boolean; name: string; avatar: string };
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type DingnGame = {
  gameId: string;
  version: string;
  locale: Locale;
  player: Player;
  /** False when the game was opened on its own, outside dingn. */
  embedded: boolean;
  onPlayer(listener: (player: Player) => void): () => void;
  /** Saved on this device only. Keys: letters, digits, `._-`, up to 64. Values up to 16 KB as JSON. */
  storage: {
    get(key: string): Promise<Json>;
    set(key: string, value: Json): Promise<void>;
  };
  /** Saved to the signed-in player's account, up to 16 KB as JSON. save() rejects with code "signed_out" otherwise. */
  progress: { load(): Promise<Json>; save(data: Json): Promise<void> };
  requestSignIn(): void;
  /** Leaves the game for a dingn page, such as "/" for the game list. The website keeps the player's language. */
  navigate(path: string): void;
  ready(): void;
};
export declare function connect(options?: {
  timeout?: number;
}): Promise<DingnGame>;
