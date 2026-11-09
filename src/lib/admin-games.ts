// The Games admin page's calls to the dingn server (scripts/games-admin.mjs).
import { api } from "./api";

export type AdminVersion = {
  version: string;
  title: { en: string; zh: string };
  publishedAt: string | null;
  /** False for a developer's upload that was never made live. */
  reviewed: boolean;
  /** Why it was sent back to the developer, if it was. */
  rejected: string | null;
};
export type Plays = { total: number; week: number; month: number };
export type AdminGame = {
  id: string;
  status: "listed" | "unlisted" | "removed";
  /** Why the game was taken down, if it was. */
  removedReason: string | null;
  plays: Plays | null;
  live: string | null;
  beta: string | null;
  updatedAt: string | null;
  /** The email of the outside developer who uploads this game, if any. */
  owner: string | null;
  versions: AdminVersion[];
};
export type GameChange =
  | { action: "set-live" | "set-beta"; version: string }
  | { action: "clear-beta" | "list" | "unlist" | "restore" }
  | { action: "reject"; version: string; reason: string }
  | { action: "take-down"; reason: string }
  | { action: "transfer"; email: string };

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

export type Admin = { uid: string; email: string };

export async function listAdmins() {
  return (await api<{ admins: Admin[] }>("/api/admin/admins")).admins;
}

export async function changeAdmin(email: string, action: "add" | "remove") {
  return (
    await api<{ admin: Admin }>("/api/admin/admins/update", { email, action })
  ).admin;
}

export type Player = {
  uid: string;
  email: string;
  name: string;
  providers: string[];
  admin: boolean;
  developer: boolean;
  developerBlocked: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
  lastActive: string | null;
};

/** One page (from 1) of players, most recently active first. */
export async function listPlayers(page = 1) {
  return await api<{ players: Player[]; total: number; pages: number }>(
    "/api/admin/players",
    { page },
  );
}

export type Report = {
  id: string;
  game: string;
  version: string;
  reason: "broken" | "offensive" | "unsafe" | "copyright" | "other";
  details: string;
  reporter: string;
  createdAt: string;
};

export async function listReports() {
  return (await api<{ reports: Report[] }>("/api/admin/reports")).reports;
}

export async function closeReport(id: string, action: "dismiss" | "resolve") {
  await api("/api/admin/reports/update", { id, action });
}
