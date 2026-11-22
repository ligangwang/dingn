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
import * as kingdomRules from "kingdom/rules";
import { REWARD_SYSTEMS } from "../src/data/reward-systems";
import { setKingdomRules } from "../src/lib/reward-plugin";

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
  bundle: true,
  ...over,
});

beforeEach(() => {
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
  mocks.list.mockReset().mockResolvedValue({
    systems: [{ system: "kingdom", live: null, running: null, versions: [] }],
  });
  mocks.review.mockReset();
});
afterEach(cleanup);

it("shows nothing to someone who isn't an admin", () => {
  mocks.session.isAdmin = false;
  render(<AdminRewards />);
  expect(screen.queryByRole("heading", { name: "Kingdom" })).toBeNull();
});

it("lists the reward systems, kingdom first, with what the live version grants", () => {
  expect(REWARD_SYSTEMS[0].id).toBe("kingdom");

  render(<AdminRewards />);
  const kingdom = screen.getByRole("region", { name: "Kingdom" });
  const repo = within(kingdom).getByRole("link", {
    name: "ligangwang/kingdom",
  });
  expect(repo.getAttribute("href")).toBe(
    "https://github.com/ligangwang/kingdom",
  );
  // dingn has no copy of its own to show.
  expect(within(kingdom).queryByText("Built-in copy")).toBeNull();
  // What it grants comes from the live version's reward kinds.
  expect(within(kingdom).getByText("badge-coins")).toBeTruthy();
  expect(within(kingdom).getByText("level-ups")).toBeTruthy();
  // And its rules, from the live version's numbers.
  expect(within(kingdom).getByText("Kingdom's rules")).toBeTruthy();
  expect(
    within(kingdom).getByText("One game's badges pay at most 1,000 coins."),
  ).toBeTruthy();
  expect(within(kingdom).getByText("Village elder")).toBeTruthy();
});

it("installs kingdom only for its types and the tests", () => {
  expect(pkg.dependencies).not.toHaveProperty("kingdom");
  expect(pkg.devDependencies.kingdom).toMatch(
    /^https:\/\/github\.com\/ligangwang\/kingdom\/releases\/download\/v[^/]+\/kingdom-[^/]+\.tgz$/,
  );
});

it("says rewards are paused when no version is live or loaded", async () => {
  setKingdomRules(null);
  try {
    mocks.list.mockResolvedValue({
      systems: [
        {
          system: "kingdom",
          live: "0.3.0",
          running: { version: null, problem: "kingdom 0.3.0: storage 503" },
          versions: [release("0.3.0", { approvedAt: "x" })],
        },
      ],
    });
    render(<AdminRewards />);
    const kingdom = screen.getByRole("region", { name: "Kingdom" });
    expect((await within(kingdom).findByRole("alert")).textContent).toContain(
      "rewards are paused",
    );
    // Without the rules, nothing of what it grants is shown.
    expect(within(kingdom).queryByText("Kingdom's rules")).toBeNull();
  } finally {
    setKingdomRules(kingdomRules);
  }
});

it("approves a waiting version, which makes it live", async () => {
  mocks.list.mockResolvedValue({
    systems: [
      {
        system: "kingdom",
        live: "0.3.0",
        running: { version: "0.3.0", problem: null },
        versions: [release("9.0.0"), release("0.3.0", { approvedAt: "x" })],
      },
    ],
  });
  mocks.review.mockResolvedValue({
    system: "kingdom",
    live: "9.0.0",
    running: { version: "9.0.0", problem: null },
    versions: [
      release("9.0.0", { approvedAt: "2026-11-22T12:05:00.000Z" }),
      release("0.3.0", { approvedAt: "x" }),
    ],
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminRewards />);
  const kingdom = screen.getByRole("region", { name: "Kingdom" });
  const waiting = (
    await within(kingdom).findByRole("link", { name: "9.0.0" })
  ).closest("tr")!;
  expect(within(waiting).getByText("Waiting for review")).toBeTruthy();
  const live = within(kingdom)
    .getByRole("link", { name: "0.3.0" })
    .closest("tr")!;
  expect(within(live).getByText("Live")).toBeTruthy();

  fireEvent.click(within(waiting).getByRole("button", { name: "Approve" }));
  expect(window.confirm).toHaveBeenCalledWith(
    "Approve Kingdom 9.0.0? It goes live within a minute.",
  );
  expect(mocks.review).toHaveBeenCalledWith("kingdom", "9.0.0", {
    action: "approve",
  });
  expect(
    await within(kingdom).findByText(
      "Kingdom 9.0.0 is live. Every server runs it within a minute.",
    ),
  ).toBeTruthy();
  expect(within(waiting).getByText("Live")).toBeTruthy();
  // The one live before can be made live again, to roll back.
  expect(within(live).getByRole("button", { name: "Make live" })).toBeTruthy();
});

it("says when this server can't load the live version", async () => {
  mocks.list.mockResolvedValue({
    systems: [
      {
        system: "kingdom",
        live: "9.0.0",
        running: {
          version: "0.2.0",
          problem: "kingdom 9.0.0: rules.mjs does not match its upload",
        },
        versions: [release("9.0.0", { approvedAt: "x" })],
      },
    ],
  });
  render(<AdminRewards />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "This server can't load the live version, so it runs 0.2.0 meanwhile:",
  );
  expect(alert.textContent).toContain("does not match its upload");
});

it("can't approve a version sent before plugins", async () => {
  mocks.list.mockResolvedValue({
    systems: [
      {
        system: "kingdom",
        live: null,
        running: null,
        versions: [release("0.2.0", { bundle: false })],
      },
    ],
  });
  render(<AdminRewards />);
  expect(await screen.findByText("Sent before plugins")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(
    screen.getByText(/none yet, so rewards are paused until one is approved/),
  ).toBeTruthy();
});
