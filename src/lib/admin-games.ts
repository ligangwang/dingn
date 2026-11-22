// The Games admin page's calls to the dingn server (scripts/games-admin.mjs).
import { api } from "./api";
import type { Role } from "@/components/session";

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
  /** Its category page: casual, memory, puzzle or adventure. */
  category: "casual" | "memory" | "puzzle" | "adventure";
  /** When it was pinned to its category page's banner, or null. */
  featuredAt: string | null;
  /** When it was made the game the home page features, or null. */
  homeAt: string | null;
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
  | {
      action:
        | "clear-beta"
        | "list"
        | "unlist"
        | "restore"
        | "feature"
        | "unfeature"
        | "feature-home"
        | "unfeature-home";
    }
  | { action: "reject"; version: string; reason: string }
  | { action: "take-down"; reason: string }
  | { action: "transfer"; email: string };

/** A review key: lets a script list games and approve or reject versions. */
export type ReviewKey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};
type ReviewKeysResult = { keys: ReviewKey[]; key?: string };

/** The signed-in admin's review keys. */
export async function listReviewKeys() {
  return api<ReviewKeysResult>("/api/admin/keys", { action: "list" });
}
export async function createReviewKey(name: string) {
  return api<ReviewKeysResult>("/api/admin/keys", { action: "create", name });
}
export async function revokeReviewKey(id: string) {
  return api<ReviewKeysResult>("/api/admin/keys", { action: "revoke", id });
}

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

/** A test account (scripts/test-accounts.mjs). */
export type Tester = {
  uid: string;
  email: string;
  name: string;
  disabled: boolean;
  /** Its roles: tester, and any other an admin gave it. */
  roles: Role[];
  createdAt: string | null;
  lastActive: string | null;
};
export type NewTesters = {
  email: string;
  count: number;
  name?: string;
  /** Left out: dingn makes one up and returns it once. */
  password?: string;
};

export async function listTesters() {
  return (await api<{ testers: Tester[] }>("/api/admin/testers")).testers;
}

/** Makes test accounts, all with one password, which comes back once. */
export async function createTesters(request: NewTesters) {
  return api<{ testers: Tester[]; password: string }>(
    "/api/admin/testers/update",
    { action: "create", ...request },
  );
}

/** Gives a test account a new password (made up when left out). */
export async function resetTesterPassword(uid: string, password?: string) {
  return api<{ tester: Tester; password: string }>(
    "/api/admin/testers/update",
    { action: "password", uid, ...(password ? { password } : {}) },
  );
}

export async function deleteTester(uid: string) {
  await api<{ uid: string }>("/api/admin/testers/update", {
    action: "delete",
    uid,
  });
}

export type Player = {
  uid: string;
  email: string;
  name: string;
  providers: string[];
  /** What the account may do: administrator, developer, player, tester. */
  roles: Role[];
  /** A developer removed by an admin, who can't sign up again by themselves. */
  developerBlocked: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
  lastActive: string | null;
  /** Their dingn nickname, which other players see ("" if none yet). */
  nickname?: string;
  /** Their public number, naming their page /player/<number>/ ("" if none). */
  number?: string;
};

/** One page (from 1) of players, most recently active first. */
/** A page of players; with `uid`, the page that account is on. */
export async function listPlayers(page = 1, uid?: string) {
  return await api<{
    players: Player[];
    total: number;
    pages: number;
    page: number;
  }>("/api/admin/players", uid ? { page, uid } : { page });
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

/** Site-wide switches (scripts/site-settings.mjs). */
export type SiteSettings = { leaderboardPublic: boolean };

export async function getSettings() {
  return (await api<{ settings: SiteSettings }>("/api/admin/settings"))
    .settings;
}

export async function updateSettings(change: Partial<SiteSettings>) {
  return (
    await api<{ settings: SiteSettings }>("/api/admin/settings/update", change)
  ).settings;
}

/** The growth funnel's counts (scripts/funnel.mjs), by source and by game. */
export type FunnelRow = {
  visitors: number;
  new: number;
  starts: number;
  finishes: number;
  shares: number;
  returning: number;
  returners: number;
  referred: number;
};
export type FunnelReport = {
  days: number;
  from: string;
  to: string;
  total: FunnelRow;
  sources: Record<string, FunnelRow>;
  games: Record<string, Pick<FunnelRow, "starts" | "finishes" | "shares">>;
};

export async function getFunnel(days: number) {
  return await api<FunnelReport>("/api/admin/funnel", { days });
}
