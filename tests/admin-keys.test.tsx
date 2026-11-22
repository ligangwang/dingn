import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminKeys } from "../src/components/admin-keys";

const mocks = vi.hoisted(() => ({
  session: { user: { uid: "admin" }, ready: true, isAdmin: true },
  listReviewKeys: vi.fn(),
  createReviewKey: vi.fn(),
  revokeReviewKey: vi.fn(),
  listUploadKeys: vi.fn(),
  createUploadKey: vi.fn(),
  revokeUploadKey: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listReviewKeys: mocks.listReviewKeys,
  createReviewKey: mocks.createReviewKey,
  revokeReviewKey: mocks.revokeReviewKey,
}));
vi.mock("../src/lib/developer-games", () => ({
  listUploadKeys: mocks.listUploadKeys,
  createUploadKey: mocks.createUploadKey,
  revokeUploadKey: mocks.revokeUploadKey,
}));

const key = (id: string, name: string, lastUsedAt: string | null = null) => ({
  id,
  name,
  createdAt: "2026-11-20T00:00:00Z",
  lastUsedAt,
});

beforeEach(() => {
  mocks.session = { user: { uid: "admin" }, ready: true, isAdmin: true };
  for (const fn of Object.values(mocks))
    if (typeof fn === "function") fn.mockReset();
  mocks.listReviewKeys.mockResolvedValue({ keys: [] });
  mocks.listUploadKeys.mockResolvedValue({ keys: [] });
});
afterEach(cleanup);

it("shows nothing to someone who isn't an admin", () => {
  mocks.session.isAdmin = false;
  render(<AdminKeys />);
  expect(screen.queryByRole("heading", { name: "API keys" })).toBeNull();
  expect(mocks.listReviewKeys).not.toHaveBeenCalled();
});

it("lists the admin's review and upload keys on one page", async () => {
  mocks.listReviewKeys.mockResolvedValue({ keys: [key("r1", "Claude")] });
  mocks.listUploadKeys.mockResolvedValue({
    keys: [key("u1", "kingdom CI", "2026-11-21T00:00:00Z")],
  });
  render(<AdminKeys />);
  expect(screen.getByRole("heading", { name: "API keys" })).toBeTruthy();
  const review = screen.getByRole("region", { name: "Review keys" });
  const upload = screen.getByRole("region", { name: "Upload keys" });
  expect(await within(review).findByText("Claude")).toBeTruthy();
  expect(await within(upload).findByText("kingdom CI")).toBeTruthy();
  expect(within(upload).getByText(/DINGN_UPLOAD_KEY/)).toBeTruthy();
});

it("creates a review key, shows it once, and revokes it", async () => {
  mocks.createReviewKey.mockResolvedValue({
    key: "dak.admin.k1.secret",
    keys: [key("k1", "Claude")],
  });
  mocks.revokeReviewKey.mockResolvedValue({ keys: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminKeys />);
  const user = userEvent.setup();
  const section = screen.getByRole("region", { name: "Review keys" });
  await within(section).findByText("No keys yet.");
  await user.type(within(section).getByLabelText("Key name"), "Claude");
  await user.click(within(section).getByRole("button", { name: "Create key" }));
  expect(mocks.createReviewKey).toHaveBeenCalledWith("Claude");
  expect(await within(section).findByText("dak.admin.k1.secret")).toBeTruthy();
  expect(
    within(section).getByText("never used", { exact: false }),
  ).toBeTruthy();
  await user.click(within(section).getByRole("button", { name: "Revoke" }));
  expect(mocks.revokeReviewKey).toHaveBeenCalledWith("k1");
  expect(within(section).queryByRole("listitem")).toBeNull();
});

it("creates an upload key for CI", async () => {
  mocks.createUploadKey.mockResolvedValue({
    key: "dgk.admin.u1.secret",
    keys: [key("u1", "kingdom CI")],
  });
  render(<AdminKeys />);
  const user = userEvent.setup();
  const section = screen.getByRole("region", { name: "Upload keys" });
  await within(section).findByText("No keys yet.");
  await user.type(within(section).getByLabelText("Key name"), "kingdom CI");
  await user.click(within(section).getByRole("button", { name: "Create key" }));
  expect(mocks.createUploadKey).toHaveBeenCalledWith("kingdom CI");
  expect(await within(section).findByText("dgk.admin.u1.secret")).toBeTruthy();
  expect(mocks.createReviewKey).not.toHaveBeenCalled();
});
