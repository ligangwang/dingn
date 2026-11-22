import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPlayers } from "../src/components/admin-players";
import type { Player } from "../src/lib/admin-games";

const mocks = vi.hoisted(() => ({
  session: { user: { uid: "me" }, ready: true, isAdmin: true },
  listPlayers: vi.fn(),
  getSettings: vi.fn(async () => ({ leaderboardPublic: false })),
  updateSettings: vi.fn(async (change: { leaderboardPublic: boolean }) => ({
    leaderboardPublic: change.leaderboardPublic,
  })),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listPlayers: mocks.listPlayers,
  getSettings: mocks.getSettings,
  updateSettings: mocks.updateSettings,
}));

const player = (uid: string, extra: Partial<Player> = {}): Player => ({
  uid,
  email: `${uid}@x.com`,
  name: "",
  providers: ["google.com"],
  roles: ["player"],
  developerBlocked: false,
  disabled: false,
  createdAt: "2026-11-01T10:00:00Z",
  lastSignIn: "2026-11-08T10:00:00Z",
  lastActive: null,
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
});
afterEach(cleanup);

it("never loads players for non-admins", () => {
  mocks.session.isAdmin = false;
  render(<AdminPlayers />);
  expect(mocks.listPlayers).not.toHaveBeenCalled();
});

it("lists players with their roles and pages forward and back", async () => {
  mocks.listPlayers.mockImplementation(async (page: number) =>
    page === 2
      ? { players: [player("cy")], total: 51, pages: 2 }
      : {
          players: [
            player("ada", {
              roles: ["administrator", "developer", "player"],
              name: "Ada Lovelace",
              nickname: "Star Gazer",
              number: "7302518846",
            }),
            player("bo"),
          ],
          total: 51,
          pages: 2,
        },
  );
  render(<AdminPlayers />);
  // The nickname players see, who signed in, and the public player number.
  expect(await screen.findByText("Star Gazer")).toBeTruthy();
  expect(screen.getByText("Ada Lovelace · ada@x.com")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "7302518846" }).getAttribute("href"),
  ).toMatch(/^\/player\/7302518846\/?$/);
  expect(screen.getByText("Administrator, Developer, Player")).toBeTruthy();
  expect(screen.getAllByText("Google")).toHaveLength(2);
  expect(screen.getAllByText("Never")).toHaveLength(2);
  expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  expect(screen.getByText("51 players")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("cy@x.com")).toBeTruthy();
  expect(mocks.listPlayers).toHaveBeenLastCalledWith(2);
  expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  await userEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByText("bo@x.com")).toBeTruthy();
  expect(mocks.listPlayers).toHaveBeenLastCalledWith(1);
});

it("can retry or go back after a page fails to load", async () => {
  mocks.listPlayers
    .mockResolvedValueOnce({ players: [player("ada")], total: 51, pages: 2 })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ players: [player("cy")], total: 51, pages: 2 });
  render(<AdminPlayers />);
  await screen.findByText("ada@x.com");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("alert");
  expect(
    (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("cy@x.com")).toBeTruthy();
  expect(mocks.listPlayers).toHaveBeenLastCalledWith(2);
});

it("makes the leaderboard public and hides it again", async () => {
  mocks.listPlayers.mockResolvedValue({ players: [], total: 0, pages: 1 });
  render(<AdminPlayers />);
  expect(await screen.findByText(/Admins only/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Make it public" }));
  expect(mocks.updateSettings).toHaveBeenLastCalledWith({
    leaderboardPublic: true,
  });
  expect(await screen.findByText(/Public: anyone can open/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Hide it again" }));
  expect(mocks.updateSettings).toHaveBeenLastCalledWith({
    leaderboardPublic: false,
  });
});

it("opens on the player a leaderboard link names, and marks their row", async () => {
  history.replaceState({}, "", "/admin/players/?uid=cy");
  Element.prototype.scrollIntoView = vi.fn();
  mocks.listPlayers.mockResolvedValue({
    players: [player("bo"), player("cy")],
    total: 51,
    pages: 2,
    page: 2,
  });
  render(<AdminPlayers />);
  const cell = await screen.findByText("cy@x.com");
  expect(mocks.listPlayers).toHaveBeenCalledWith(1, "cy");
  // It moved to page 2, without loading that page a second time.
  expect(mocks.listPlayers).toHaveBeenCalledTimes(1);
  expect(cell.closest("tr")?.className).toBe("admin-player-wanted");
  expect(screen.getByText("bo@x.com").closest("tr")?.className).toBe("");
  // The scroll runs in an effect just after the row first shows.
  await waitFor(() =>
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled(),
  );
  history.replaceState({}, "", "/");
});

it("looks the wanted player up only once, so Previous still reaches page 1", async () => {
  history.replaceState({}, "", "/admin/players/?uid=cy");
  Element.prototype.scrollIntoView = vi.fn();
  mocks.listPlayers.mockImplementation(async (page: number, uid?: string) =>
    uid
      ? { players: [player("cy")], total: 51, pages: 2, page: 2 }
      : {
          players: [player(page === 1 ? "ada" : "cy")],
          total: 51,
          pages: 2,
          page,
        },
  );
  render(<AdminPlayers />);
  await screen.findByText("cy@x.com");
  await userEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByText("ada@x.com")).toBeTruthy();
  expect(mocks.listPlayers).toHaveBeenLastCalledWith(1);
  expect(mocks.listPlayers).toHaveBeenCalledTimes(2);
  history.replaceState({}, "", "/");
});
