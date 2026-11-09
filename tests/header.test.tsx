import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Header } from "../src/components/header";

const mocks = vi.hoisted(() => ({
  session: { user: null, ready: true, isAdmin: false, profile: {} },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users/" }));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/components/xp", () => ({ LevelBadge: () => null }));

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
