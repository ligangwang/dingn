import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUsers } from "../src/components/admin-users";

const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "me" } as { uid: string } | null,
    ready: true,
    isAdmin: true,
  },
  listAdmins: vi.fn(),
  changeAdmin: vi.fn(),
  listDevelopers: vi.fn(),
  changeDeveloper: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listAdmins: mocks.listAdmins,
  changeAdmin: mocks.changeAdmin,
  listDevelopers: mocks.listDevelopers,
  changeDeveloper: mocks.changeDeveloper,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
  mocks.listAdmins.mockResolvedValue([{ uid: "me", email: "me@dingn.com" }]);
  mocks.listDevelopers.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("never loads users for non-admins", () => {
  mocks.session.isAdmin = false;
  render(<AdminUsers />);
  expect(
    screen.getByRole("heading", { name: "Admin access required" }),
  ).toBeTruthy();
  expect(mocks.listAdmins).not.toHaveBeenCalled();
  expect(mocks.listDevelopers).not.toHaveBeenCalled();
});

it("makes someone an admin after confirming, and never offers to remove yourself", async () => {
  mocks.changeAdmin.mockResolvedValue({ uid: "ada", email: "ada@dingn.com" });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminUsers />);
  const admins = screen.getByRole("region", { name: "Admins" });
  await within(admins).findByText("me@dingn.com");
  expect(within(admins).getByText("(you)")).toBeTruthy();
  expect(within(admins).queryByRole("button", { name: "Remove" })).toBeNull();

  await userEvent.type(
    within(admins).getByLabelText("Account email"),
    "ada@dingn.com",
  );
  await userEvent.click(
    within(admins).getByRole("button", { name: "Make admin" }),
  );
  expect(window.confirm).toHaveBeenCalledWith("Make ada@dingn.com an admin?");
  expect(mocks.changeAdmin).toHaveBeenCalledWith("ada@dingn.com", "add");
  expect(
    await within(admins).findByText("ada@dingn.com is an admin now."),
  ).toBeTruthy();

  mocks.changeAdmin.mockResolvedValue({ uid: "ada", email: "ada@dingn.com" });
  await userEvent.click(within(admins).getByRole("button", { name: "Remove" }));
  expect(mocks.changeAdmin).toHaveBeenLastCalledWith("ada@dingn.com", "remove");
  expect(
    await within(admins).findByText("ada@dingn.com is no longer an admin."),
  ).toBeTruthy();
});

it("lets admins allow developers to upload", async () => {
  mocks.changeDeveloper.mockResolvedValue({ uid: "bo", email: "bo@x.com" });
  render(<AdminUsers />);
  const developers = screen.getByRole("region", { name: "Developers" });
  await userEvent.type(
    within(developers).getByLabelText("Account email"),
    "bo@x.com",
  );
  await userEvent.click(
    within(developers).getByRole("button", { name: "Allow uploads" }),
  );
  expect(mocks.changeDeveloper).toHaveBeenCalledWith("bo@x.com", "add");
  expect(
    await within(developers).findByText("bo@x.com can upload games now."),
  ).toBeTruthy();
});
