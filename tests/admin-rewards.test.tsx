import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminRewards } from "../src/components/admin-rewards";
import { REWARD_SYSTEMS, pinnedCommit } from "../src/data/reward-systems";

const mocks = vi.hoisted(() => ({
  session: { user: { uid: "me" }, ready: true, isAdmin: true },
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));

beforeEach(() => {
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
});
afterEach(cleanup);

it("shows nothing to someone who isn't an admin", () => {
  mocks.session.isAdmin = false;
  render(<AdminRewards />);
  expect(screen.queryByRole("heading", { name: "Kingdom" })).toBeNull();
});

it("lists the reward systems, kingdom first, with the commit dingn runs", () => {
  expect(REWARD_SYSTEMS[0].id).toBe("kingdom");
  const commit = pinnedCommit(REWARD_SYSTEMS[0]);
  expect(commit).toMatch(/^[0-9a-f]{40}$/);

  render(<AdminRewards />);
  const kingdom = screen.getByRole("region", { name: "Kingdom" });
  const repo = within(kingdom).getByRole("link", {
    name: "ligangwang/kingdom",
  });
  expect(repo.getAttribute("href")).toBe(
    "https://github.com/ligangwang/kingdom",
  );
  expect(
    within(kingdom).getByRole("link", { name: commit!.slice(0, 7) }),
  ).toBeTruthy();
  // What it grants comes from the package's reward kinds.
  expect(within(kingdom).getByText("badge-coins")).toBeTruthy();
  expect(within(kingdom).getByText("level-ups")).toBeTruthy();
  // And its rules, from the package's numbers.
  expect(within(kingdom).getByText("Kingdom's rules")).toBeTruthy();
  expect(
    within(kingdom).getByText("One game's badges pay at most 1,000 coins."),
  ).toBeTruthy();
  expect(within(kingdom).getByText("Village elder")).toBeTruthy();
});

it("reads the commit from a pinned tarball only", () => {
  const system = { ...REWARD_SYSTEMS[0], packageName: "react" };
  expect(pinnedCommit(system)).toBeNull();
});
