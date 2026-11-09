// The developer page's calls to the dingn server (scripts/developer-games.mjs).
import { api } from "./api";

export type DeveloperVersion = {
  version: string;
  title: { en: string; zh: string };
  publishedAt: string | null;
  reviewed: boolean;
};
export type DeveloperGame = {
  id: string;
  status: "listed" | "unlisted";
  live: string | null;
  beta: string | null;
  versions: DeveloperVersion[];
};
export type UploadResult = {
  game: DeveloperGame;
  version: string;
  play: string;
};

export async function listMyGames() {
  return api<{ developer: boolean; games: DeveloperGame[] }>(
    "/api/developer/games",
  );
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
