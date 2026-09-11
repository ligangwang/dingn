import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Feedback } from "../src/components/feedback";
const mocks = vi.hoisted(() => ({
  submitFeedback: vi.fn(),
  login: vi.fn(),
  user: { uid: "user1" } as { uid: string } | null,
}));
vi.mock("../src/lib/feedback", () => mocks);
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: mocks.user, ready: true, login: mocks.login }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { uid: "user1" };
});
afterEach(cleanup);
it("waits for the saved submission before confirming and blocks duplicate clicks", async () => {
  let resolve!: () => void;
  mocks.submitFeedback.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  render(<Feedback />);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("Your feedback"),
    "Please add daily challenges.",
  );
  await user.dblClick(screen.getByRole("button", { name: "Submit feedback" }));
  expect(mocks.submitFeedback).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  resolve();
  expect((await screen.findByRole("status")).textContent).toContain("saved");
});
it("retains the draft on a failed save so it can be retried", async () => {
  mocks.submitFeedback.mockRejectedValue(new Error("unavailable"));
  render(<Feedback />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Your feedback"), "My suggestion");
  await user.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Your feedback") as HTMLTextAreaElement).value,
  ).toBe("My suggestion");
  expect(screen.queryByRole("status")).toBeNull();
});
it("requires sign-in and preserves a draft when sign-in is cancelled", async () => {
  mocks.user = null;
  mocks.login.mockRejectedValue({ code: "auth/popup-closed-by-user" });
  render(<Feedback />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Your feedback"), "A draft");
  await user.click(
    screen.getByRole("button", { name: "Continue with Google" }),
  );
  await screen.findByRole("alert");
  expect(mocks.submitFeedback).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Your feedback") as HTMLTextAreaElement).value,
  ).toBe("A draft");
});
