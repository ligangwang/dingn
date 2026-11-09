import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminGames } from "../src/components/admin-games";
import type { AdminGame } from "../src/lib/admin-games";

const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "admin" } as { uid: string } | null,
    ready: true,
    isAdmin: true,
  },
  listGames: vi.fn(),
  changeGame: vi.fn(),
  listDevelopers: vi.fn(),
  changeDeveloper: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listGames: mocks.listGames,
  changeGame: mocks.changeGame,
  listDevelopers: mocks.listDevelopers,
  changeDeveloper: mocks.changeDeveloper,
}));

const title = { en: "Crowd Rush", zh: "人潮突击" };
const crowd: AdminGame = {
  id: "crowd",
  status: "unlisted",
  live: "1.0.0",
  beta: "1.1.0",
  updatedAt: null,
  owner: null,
  versions: [
    {
      version: "1.1.0",
      title,
      publishedAt: "2026-11-09T03:50:00Z",
      reviewed: true,
    },
    {
      version: "1.0.0",
      title,
      publishedAt: "2026-11-08T03:50:00Z",
      reviewed: true,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "admin" }, ready: true, isAdmin: true };
  mocks.listGames.mockResolvedValue([crowd]);
  mocks.listDevelopers.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("never loads games for visitors or non-admins", () => {
  mocks.session.user = null;
  const view = render(<AdminGames />);
  expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeTruthy();
  mocks.session.user = { uid: "ordinary" };
  mocks.session.isAdmin = false;
  view.rerender(<AdminGames />);
  expect(
    screen.getByRole("heading", { name: "Admin access required" }),
  ).toBeTruthy();
  expect(mocks.listGames).not.toHaveBeenCalled();
});

it("releases the beta after confirming, and lists the game", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mocks.changeGame.mockImplementation(async (_id, change) =>
    change.action === "set-live"
      ? { ...crowd, live: change.version }
      : { ...crowd, status: "listed" },
  );
  render(<AdminGames />);
  const card = await screen.findByRole("region", { name: "Crowd Rush" });
  expect(within(card).getByText(/Live: 1\.0\.0/)).toBeTruthy();
  const beta = within(card).getByRole("row", { name: /1\.1\.0/ });
  await userEvent.click(
    within(beta).getByRole("button", { name: "Make live" }),
  );
  expect(window.confirm).toHaveBeenCalled();
  expect(mocks.changeGame).toHaveBeenCalledWith("crowd", {
    action: "set-live",
    version: "1.1.0",
  });
  expect(await screen.findByText("Crowd Rush 1.1.0 is live.")).toBeTruthy();
  expect(
    within(beta).getByRole("link", { name: "Try it" }).getAttribute("href"),
  ).toBe("/play/crowd/?v=1.1.0");

  await userEvent.click(
    within(card).getByRole("button", { name: "Show in catalog" }),
  );
  expect(mocks.changeGame).toHaveBeenLastCalledWith("crowd", {
    action: "list",
  });
});

it("does nothing when the release is not confirmed", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<AdminGames />);
  const card = await screen.findByRole("region", { name: "Crowd Rush" });
  const beta = within(card).getByRole("row", { name: /1\.1\.0/ });
  await userEvent.click(
    within(beta).getByRole("button", { name: "Make live" }),
  );
  expect(mocks.changeGame).not.toHaveBeenCalled();
});
