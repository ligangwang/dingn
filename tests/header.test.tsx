import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Header } from "../src/components/header";

const mocks = vi.hoisted(() => ({
  session: {
    user: null as null | { displayName: null; email: string },
    ready: true,
    isAdmin: false,
    profile: { avatar: "fox", userName: "Ada" },
    stats: null as null | { level: number; xp: number },
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users/" }));
// The coin count fetches the wallet; not what these tests are about.
vi.mock("../src/components/rewards", () => ({ CoinCount: () => null }));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
  useOptionalSession: () => mocks.session,
}));

afterEach(cleanup);

it("shows the Admin menu with games, users and feedback only to admins", () => {
  const view = render(<Header />);
  expect(screen.queryByText("Admin")).toBeNull();
  mocks.session.isAdmin = true;
  view.rerender(<Header />);
  const menu = screen.getByText("Admin").closest("summary")!;
  expect(menu.getAttribute("aria-current")).toBe("page");
  expect(
    ["Games", "Users", "Players", "Feedback"].map((name) =>
      screen.getByRole("link", { name, hidden: true }).getAttribute("href"),
    ),
  ).toEqual([
    "/admin/games",
    "/admin/users",
    "/admin/players",
    "/admin/feedback",
  ]);
  expect(
    screen
      .getByRole("link", { name: "Users", hidden: true })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it("wears the player's level on their avatar, in the ring of their honor", () => {
  mocks.session.user = { displayName: null, email: "ada@example.com" };
  mocks.session.stats = { level: 4, xp: 640 };
  render(<Header />);
  const link = screen.getByRole("link", { name: /Your account/ });
  expect(link.querySelector(".profile-avatar.honor-bronze")).toBeTruthy();
  expect(link.querySelector(".profile-medal")).toBeTruthy();
  expect(link.getAttribute("title")).toBe("Account level 4 · 640 XP in all");
  // No separate "Lv" pill beside it any more.
  expect(screen.queryByText("Lv 4")).toBeNull();
  cleanup();
  // Before the level loads: the avatar alone.
  mocks.session.stats = null;
  render(<Header />);
  expect(
    screen
      .getByRole("link", { name: "Your account" })
      .querySelector(".profile-medal"),
  ).toBeNull();
});
