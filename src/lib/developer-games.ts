// The developer page's calls to the dingn server (scripts/developer-games.mjs).
import { api } from "./api";

export type DeveloperVersion = {
  version: string;
  title: { en: string; zh: string };
  publishedAt: string | null;
  reviewed: boolean;
  /** Why dingn sent this version back, if it did. */
  rejected: string | null;
};
export type Plays = { total: number; week: number; month: number };
export type DeveloperGame = {
  id: string;
  status: "listed" | "unlisted" | "removed";
  /** Why dingn took the game down, if it did. */
  removedReason: string | null;
  plays: Plays | null;
  live: string | null;
  beta: string | null;
  versions: DeveloperVersion[];
};
export type UploadResult = {
  game: DeveloperGame;
  version: string;
  play: string;
};

export type MyGames = {
  developer: boolean;
  /** The developer agreement's current version. */
  agreement: string;
  /** Not a developer: an admin removed this account's access. */
  blocked?: boolean;
  /** Not a developer: whether the account's email is verified. */
  emailVerified?: boolean;
  limits?: { games: number; uploadsPerDay: number };
  games: DeveloperGame[];
};

export async function listMyGames() {
  return api<MyGames>("/api/developer/games");
}

/** Signs the account up as a developer, accepting this agreement version. */
export async function joinDevelopers(agreement: string) {
  return api<{ developer: true }>("/api/developer/join", {
    agree: true,
    agreement,
  });
}

/** Uploads a zipped game. Errors carry the server's `code` and `detail`. */
export async function uploadGame(zip: Blob): Promise<UploadResult> {
  const response = await fetch("/api/developer/games/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/zip", "X-Dingn-Request": "1" },
    body: zip,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A body too large for the hosting in front of dingn gets no JSON.
    const code =
      data.error || (response.status === 413 ? "too-large" : "unavailable");
    throw Object.assign(new Error(code), { code, detail: data.detail || "" });
  }
  return data as UploadResult;
}
