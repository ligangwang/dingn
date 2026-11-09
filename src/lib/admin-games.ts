// The Games admin page's calls to the dingn server (scripts/games-admin.mjs).
import { api } from "./api";

export type AdminVersion = {
  version: string;
  title: { en: string; zh: string };
  publishedAt: string | null;
  /** False for a developer's upload that was never made live. */
  reviewed: boolean;
};
export type AdminGame = {
  id: string;
  status: "listed" | "unlisted";
  live: string | null;
  beta: string | null;
  updatedAt: string | null;
  /** The email of the outside developer who uploads this game, if any. */
  owner: string | null;
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

export type Developer = { uid: string; email: string };

export async function listDevelopers() {
  return (await api<{ developers: Developer[] }>("/api/admin/developers"))
    .developers;
}

export async function changeDeveloper(email: string, action: "add" | "remove") {
  return (
    await api<{ developer: Developer }>("/api/admin/developers/update", {
      email,
      action,
    })
  ).developer;
}
