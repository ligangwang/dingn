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
  listReports: vi.fn(),
  closeReport: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listGames: mocks.listGames,
  changeGame: mocks.changeGame,
  listDevelopers: mocks.listDevelopers,
  changeDeveloper: mocks.changeDeveloper,
  listReports: mocks.listReports,
  closeReport: mocks.closeReport,
}));

const title = { en: "Crowd Rush", zh: "人潮突击" };
const crowd: AdminGame = {
  id: "crowd",
  status: "unlisted",
  live: "1.0.0",
  beta: "1.1.0",
  updatedAt: null,
  owner: null,
  removedReason: null,
  plays: null,
  versions: [
    {
      version: "1.1.0",
      title,
      publishedAt: "2026-11-09T03:50:00Z",
      reviewed: true,
      rejected: null,
    },
    {
      version: "1.0.0",
      title,
      publishedAt: "2026-11-08T03:50:00Z",
      reviewed: true,
      rejected: null,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "admin" }, ready: true, isAdmin: true };
  mocks.listGames.mockResolvedValue([crowd]);
  mocks.listDevelopers.mockResolvedValue([]);
  mocks.listReports.mockResolvedValue([]);
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

const skyhop: AdminGame = {
  id: "skyhop",
  status: "unlisted",
  live: null,
  beta: "1.0.0",
  updatedAt: null,
  owner: "ada@example.com",
  removedReason: null,
  plays: { total: 12, week: 5, month: 12 },
  versions: [
    {
      version: "1.0.0",
      title: { en: "Sky Hop", zh: "跳跳云" },
      publishedAt: "2026-11-09T03:50:00Z",
      reviewed: false,
      rejected: null,
    },
  ],
};

it("approves or sends back uploads waiting for review", async () => {
  mocks.listGames.mockResolvedValue([crowd, skyhop]);
  vi.spyOn(window, "prompt").mockReturnValue("  Starts with a blank screen. ");
  mocks.changeGame.mockResolvedValue({
    ...skyhop,
    beta: null,
    plays: null,
    versions: [
      { ...skyhop.versions[0], rejected: "Starts with a blank screen." },
    ],
  });
  render(<AdminGames />);
  const queue = await screen.findByRole("region", {
    name: "Waiting for review (1)",
  });
  expect(queue.textContent).toContain("ada@example.com");
  expect(
    (await screen.findByRole("region", { name: "Sky Hop" })).textContent,
  ).toContain("Plays: 5 this week, 12 in 30 days, 12 in all");
  await userEvent.click(
    within(queue).getByRole("button", { name: "Send back" }),
  );
  expect(mocks.changeGame).toHaveBeenCalledWith("skyhop", {
    action: "reject",
    version: "1.0.0",
    reason: "Starts with a blank screen.",
  });
  expect(
    await screen.findByRole("region", { name: "Waiting for review (0)" }),
  ).toBeTruthy();
  // The play counts stay after the change.
  expect(screen.getByRole("region", { name: "Sky Hop" }).textContent).toContain(
    "12 in all",
  );
});

it("takes a reported game down and closes the report", async () => {
  mocks.listGames.mockResolvedValue([crowd, skyhop]);
  mocks.listReports.mockResolvedValue([
    {
      id: "r1",
      game: "skyhop",
      version: "1.0.0",
      reason: "unsafe",
      details: "Asks for my password",
      reporter: "pat@example.com",
      createdAt: "2026-11-09T05:00:00Z",
    },
  ]);
  vi.spyOn(window, "prompt").mockReturnValue("Phishing");
  mocks.changeGame.mockResolvedValue({
    ...skyhop,
    status: "removed",
    removedReason: "Phishing",
  });
  render(<AdminGames />);
  const reports = await screen.findByRole("region", { name: "Reports (1)" });
  expect(await within(reports).findByText(/Asks for my password/)).toBeTruthy();
  await userEvent.click(
    within(reports).getByRole("button", { name: "Take down" }),
  );
  expect(mocks.changeGame).toHaveBeenCalledWith("skyhop", {
    action: "take-down",
    reason: "Phishing",
  });
  expect(mocks.closeReport).toHaveBeenCalledWith("r1", "resolve");
  expect(await screen.findByText("No open reports.")).toBeTruthy();
  const card = screen.getByRole("region", { name: "Sky Hop" });
  expect(within(card).getByRole("button", { name: "Restore" })).toBeTruthy();
});

it("transfers dingn's own game to a developer", async () => {
  vi.spyOn(window, "prompt").mockReturnValue(" studio@example.com ");
  mocks.changeGame.mockResolvedValue({ ...crowd, owner: "studio@example.com" });
  render(<AdminGames />);
  const card = await screen.findByRole("region", { name: "Crowd Rush" });
  await userEvent.click(
    within(card).getByRole("button", { name: "Transfer to a developer" }),
  );
  expect(mocks.changeGame).toHaveBeenCalledWith("crowd", {
    action: "transfer",
    email: "studio@example.com",
  });
  expect(
    await screen.findByText("Crowd Rush now belongs to studio@example.com."),
  ).toBeTruthy();
  expect(
    within(card).queryByRole("button", { name: "Transfer to a developer" }),
  ).toBeNull();
});
