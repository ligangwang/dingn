import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPlayers } from "../src/components/admin-players";
import type { Player } from "../src/lib/admin-games";

const mocks = vi.hoisted(() => ({
  session: { user: { uid: "me" }, ready: true, isAdmin: true },
  listPlayers: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({ listPlayers: mocks.listPlayers }));

const player = (uid: string, extra: Partial<Player> = {}): Player => ({
  uid,
  email: `${uid}@x.com`,
  name: "",
  providers: ["google.com"],
  admin: false,
  developer: false,
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
            player("ada", { admin: true, developer: true, name: "Ada" }),
            player("bo"),
          ],
          total: 51,
          pages: 2,
        },
  );
  render(<AdminPlayers />);
  expect(await screen.findByText("ada@x.com")).toBeTruthy();
  expect(screen.getByText("Admin, Developer")).toBeTruthy();
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
