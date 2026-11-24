import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignIn } from "../src/components/auth";

const session = vi.hoisted(() => ({
  loginEmail: vi.fn(),
  login: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: null, ready: true, ...session }),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

async function signUp(password: string, confirm: string) {
  render(<SignIn />);
  await userEvent.click(
    screen.getByRole("button", { name: "New here? Create an account" }),
  );
  await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

it("asks for the password twice and stops at a typo", async () => {
  await signUp("secret-password", "secret-passwrod");
  expect(screen.getByRole("alert").textContent).toBe(
    "The two passwords don’t match. Type the same password in both boxes.",
  );
  expect(session.loginEmail).not.toHaveBeenCalled();
});

it("makes the account and signs in, with no email to open", async () => {
  session.loginEmail.mockResolvedValue(undefined);
  await signUp("secret-password", "secret-password");
  expect(session.loginEmail).toHaveBeenCalledWith(
    "new@example.com",
    "secret-password",
    true,
    "secret-password",
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("opens on creating an account when a challenge's invitation sends you", async () => {
  history.replaceState({}, "", "/signin/?create=1&next=%2Fplay%2Fskyhop%2F");
  render(<SignIn />);
  expect(await screen.findByLabelText("Confirm password")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  history.replaceState({}, "", "/");
});
