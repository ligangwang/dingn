import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LevelCard } from "../src/components/xp";

const mocks = vi.hoisted(() => ({
  session: {
    stats: null as null | {
      level: number;
      xp: number;
      floor: number;
      next: number;
      streak: number;
      best: object;
    },
  },
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));

afterEach(cleanup);

it("shows the player's level, XP, the way to the next level and their streak", () => {
  render(<LevelCard />);
  expect(screen.getByText("Loading…")).toBeTruthy();
  cleanup();

  // Level 6 runs from 1,500 XP to 2,100.
  mocks.session.stats = {
    level: 6,
    xp: 1990,
    floor: 1500,
    next: 2100,
    streak: 3,
    best: {},
  };
  render(<LevelCard />);
  expect(screen.getByText("Account level 6")).toBeTruthy();
  expect(screen.getByText("1,990 XP in all")).toBeTruthy();
  expect(screen.getByText(/110 XP to level 7/)).toBeTruthy();
  expect(screen.getByText(/3-day streak/)).toBeTruthy();
  const bar = screen.getByRole("progressbar", { name: "Progress to level 7" });
  expect(bar.getAttribute("aria-valuenow")).toBe("490");
  expect(bar.getAttribute("aria-valuemax")).toBe("600");
  cleanup();

  // A one-day streak is not worth showing.
  mocks.session.stats = { ...mocks.session.stats, streak: 1 };
  render(<LevelCard />);
  expect(screen.queryByText(/day streak/)).toBeNull();
});
