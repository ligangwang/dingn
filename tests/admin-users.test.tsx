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
  listTesters: vi.fn(),
  createTesters: vi.fn(),
  resetTesterPassword: vi.fn(),
  deleteTester: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-games", () => ({
  listAdmins: mocks.listAdmins,
  changeAdmin: mocks.changeAdmin,
  listDevelopers: mocks.listDevelopers,
  changeDeveloper: mocks.changeDeveloper,
  listTesters: mocks.listTesters,
  createTesters: mocks.createTesters,
  resetTesterPassword: mocks.resetTesterPassword,
  deleteTester: mocks.deleteTester,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "me" }, ready: true, isAdmin: true };
  mocks.listAdmins.mockResolvedValue([{ uid: "me", email: "me@dingn.com" }]);
  mocks.listDevelopers.mockResolvedValue([]);
  mocks.listTesters.mockResolvedValue([]);
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

const qa = (n: number) => ({
  uid: `qa${n}`,
  email: `qa${n}@example.com`,
  name: "",
  disabled: false,
  admin: false,
  createdAt: "2026-11-22T10:00:00.000Z",
  lastActive: null,
});

it("makes test accounts and shows their password once", async () => {
  mocks.createTesters.mockResolvedValue({
    testers: [qa(1), qa(2)],
    password: "Secret-pass-1234",
  });
  render(<AdminUsers />);
  const section = screen.getByRole("region", { name: "Test accounts" });
  await within(section).findByText("No test accounts yet.");
  await userEvent.type(
    within(section).getByLabelText("Email"),
    "qa@example.com",
  );
  const count = within(section).getByLabelText("How many");
  await userEvent.clear(count);
  await userEvent.type(count, "2");
  await userEvent.click(
    within(section).getByRole("button", { name: "Make test accounts" }),
  );
  expect(mocks.createTesters).toHaveBeenCalledWith({
    email: "qa@example.com",
    count: 2,
  });
  expect(await within(section).findByText("Secret-pass-1234")).toBeTruthy();
  expect(within(section).getByText("qa1@example.com")).toBeTruthy();
  expect(within(section).getByText("qa2@example.com")).toBeTruthy();
});

it("gives a test account a new password and deletes one after confirming", async () => {
  mocks.listTesters.mockResolvedValue([qa(1), qa(2)]);
  mocks.resetTesterPassword.mockResolvedValue({
    tester: qa(1),
    password: "Fresh-pass-5678",
  });
  mocks.deleteTester.mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AdminUsers />);
  const section = screen.getByRole("region", { name: "Test accounts" });
  const first = (await within(section).findByText("qa1@example.com")).closest(
    "li",
  )!;
  await userEvent.click(
    within(first).getByRole("button", { name: "New password" }),
  );
  expect(mocks.resetTesterPassword).toHaveBeenCalledWith("qa1");
  expect(await within(section).findByText("Fresh-pass-5678")).toBeTruthy();

  const second = within(section).getByText("qa2@example.com").closest("li")!;
  await userEvent.click(within(second).getByRole("button", { name: "Delete" }));
  expect(confirm).toHaveBeenLastCalledWith(
    "Delete the test account qa2@example.com? This can't be undone.",
  );
  expect(mocks.deleteTester).toHaveBeenCalledWith("qa2");
  expect(
    await within(section).findByText("qa2@example.com was deleted."),
  ).toBeTruthy();
  expect(
    within(section)
      .getAllByRole("listitem")
      .map((li) => li.textContent),
  ).toEqual([expect.stringContaining("qa1@example.com")]);
});
