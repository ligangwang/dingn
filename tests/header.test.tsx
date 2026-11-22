import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Header } from "../src/components/header";

const mocks = vi.hoisted(() => ({
  path: "/admin/users/",
  session: {
    user: null as null | { displayName: null; email: string },
    ready: true,
    isAdmin: false,
    isDeveloper: false,
    isTester: false,
    profile: { avatar: "fox", userName: "Ada" },
    stats: null as null | { level: number; xp: number },
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
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

it("links the Challenges page in the menu for everyone, in place of the Leaderboard", () => {
  mocks.session.user = null;
  mocks.session.stats = null;
  mocks.session.isAdmin = false;
  render(<Header />);
  expect(
    screen.getByRole("link", { name: "Challenges" }).getAttribute("href"),
  ).toMatch(/^\/challenges\/?$/);
  cleanup();
  mocks.session.isAdmin = true;
  render(<Header />);
  expect(screen.queryByRole("link", { name: "Leaderboard" })).toBeNull();
});

it("gives a developer who isn't an admin an API keys link", () => {
  mocks.session.isAdmin = false;
  mocks.session.isDeveloper = true;
  render(<Header />);
  expect(
    screen.getByRole("link", { name: "API keys" }).getAttribute("href"),
  ).toBe("/developers/keys");
  cleanup();
  mocks.session.isAdmin = true;
  render(<Header />);
  // Admins find it in the Admin menu instead: one link, not two.
  expect(
    screen.getAllByRole("link", { name: "API keys", hidden: true }),
  ).toHaveLength(1);
  mocks.session.isDeveloper = false;
});

it("marks a test account's avatar with a TEST tag", () => {
  mocks.session.user = { displayName: null, email: "qa1@dingn.com" };
  const view = render(<Header />);
  expect(screen.queryByText("TEST")).toBeNull();
  mocks.session.isTester = true;
  view.rerender(<Header />);
  expect(screen.getByText("TEST")).toBeTruthy();
  mocks.session.isTester = false;
  mocks.session.user = null;
});

it("keeps one Games menu and one Admin menu as an admin moves between pages", () => {
  mocks.session.isAdmin = true;
  const view = render(<Header />);
  for (const path of ["/challenges/", "/", "/casual/"]) {
    mocks.path = path;
    view.rerender(<Header />);
  }
  mocks.path = "/admin/users/";
  mocks.session.isAdmin = false;
  // The two menus sit side by side and are both remade on each page.
  expect(view.container.querySelectorAll(".games-menu").length).toBe(1);
  expect(
    view.container.querySelectorAll(".admin-menu:not(.games-menu)").length,
  ).toBe(1);
});
