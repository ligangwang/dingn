import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminRewards } from "../src/components/admin-rewards";
import pkg from "../package.json";
import kingdomPkg from "kingdom/package.json";
import {
  REWARD_SYSTEMS,
  pinnedCommit,
  pinnedRelease,
} from "../src/data/reward-systems";

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

it("lists the reward systems, kingdom first, with the version dingn runs", () => {
  expect(REWARD_SYSTEMS[0].id).toBe("kingdom");
  // dingn installs kingdom from a published release.
  const release = pinnedRelease(REWARD_SYSTEMS[0]);
  expect(release).toBe(`v${kingdomPkg.version}`);
  expect(REWARD_SYSTEMS[0].version).toBe(kingdomPkg.version);

  render(<AdminRewards />);
  const kingdom = screen.getByRole("region", { name: "Kingdom" });
  const repo = within(kingdom).getByRole("link", {
    name: "ligangwang/kingdom",
  });
  expect(repo.getAttribute("href")).toBe(
    "https://github.com/ligangwang/kingdom",
  );
  const version = within(kingdom).getByRole("link", {
    name: kingdomPkg.version,
  });
  expect(version.getAttribute("href")).toBe(
    `https://github.com/ligangwang/kingdom/releases/tag/${release}`,
  );
  expect(within(kingdom).queryByText("Not a published release")).toBeNull();
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

it("reads the release and commit from kingdom's install spec only", () => {
  expect(pkg.dependencies.kingdom).toMatch(
    /^https:\/\/github\.com\/ligangwang\/kingdom\/releases\/download\/v[^/]+\/kingdom-[^/]+\.tgz$/,
  );
  expect(pinnedCommit(REWARD_SYSTEMS[0])).toBeNull();
  const system = { ...REWARD_SYSTEMS[0], packageName: "react" };
  expect(pinnedRelease(system)).toBeNull();
  expect(pinnedCommit(system)).toBeNull();
});
