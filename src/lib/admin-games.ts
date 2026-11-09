// The Games admin page's calls to the dingn server (scripts/games-admin.mjs).
import { api } from "./api";

export type AdminVersion = {
  version: string;
  title: { en: string; zh: string };
  publishedAt: string | null;
};
export type AdminGame = {
  id: string;
  status: "listed" | "unlisted";
  live: string | null;
  beta: string | null;
  updatedAt: string | null;
  versions: AdminVersion[];
};
export type GameChange =
  | { action: "set-live" | "set-beta"; version: string }
  | { action: "clear-beta" | "list" | "unlist" };

export async function listGames() {
  return (await api<{ games: AdminGame[] }>("/api/admin/games")).games;
}

export async function changeGame(id: string, change: GameChange) {
  return (
    await api<{ game: AdminGame }>("/api/admin/games/update", { id, ...change })
  ).game;
}
