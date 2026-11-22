import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
  list: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/reward-releases", () => ({
  listRewardReleases: mocks.list,
  reviewRewardRelease: mocks.review,
}));

const release = (version: string, over = {}) => ({
  version,
  url: `https://github.com/ligangwang/kingdom/releases/download/v${version}/kingdom-${version}.tgz`,
  notes: `https://github.com/ligangwang/kingdom/releases/tag/v${version}`,
  uploadedAt: "2026-11-22T12:00:00.000Z",
  approvedAt: null,
  rejected: null,
  ...over,
});

beforeEach(() => {
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
  mocks.list.mockReset().mockResolvedValue({
    systems: [{ system: "kingdom", versions: [] }],
  });
  mocks.review.mockReset();
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

it("lists the versions sent for review, and approves one", async () => {
  const running = kingdomPkg.version;
  mocks.list.mockResolvedValue({
    systems: [
      {
        system: "kingdom",
        versions: [release("9.0.0"), release(running, { approvedAt: "x" })],
      },
    ],
  });
  mocks.review.mockResolvedValue({
    system: "kingdom",
    versions: [
      release("9.0.0", { approvedAt: "2026-11-22T12:05:00.000Z" }),
      release(running, { approvedAt: "x" }),
    ],
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminRewards />);
  const kingdom = screen.getByRole("region", { name: "Kingdom" });
  const waiting = (
    await within(kingdom).findByRole("link", { name: "9.0.0" })
  ).closest("tr")!;
  expect(within(waiting).getByText("Waiting for review")).toBeTruthy();
  const current = within(kingdom)
    .getAllByRole("link", { name: running })
    .map((a) => a.closest("tr"))
    .find(Boolean)!;
  expect(within(current).getByText("Running")).toBeTruthy();

  fireEvent.click(within(waiting).getByRole("button", { name: "Approve" }));
  expect(mocks.review).toHaveBeenCalledWith("kingdom", "9.0.0", {
    action: "approve",
  });
  expect(
    await within(kingdom).findByText(
      "Kingdom 9.0.0 is approved and deploying. It goes live in a few minutes.",
    ),
  ).toBeTruthy();
  expect(within(waiting).getByText("Approved")).toBeTruthy();
});

it("says when deploying isn't set up", async () => {
  mocks.list.mockResolvedValue({
    systems: [{ system: "kingdom", versions: [release("9.0.0")] }],
  });
  mocks.review.mockRejectedValue(
    Object.assign(new Error("deploy-unavailable"), {
      code: "deploy-unavailable",
    }),
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminRewards />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  expect(
    await screen.findByText(
      "Deploying isn't set up yet: the dingn service needs a GITHUB_DISPATCH_TOKEN.",
    ),
  ).toBeTruthy();
});
