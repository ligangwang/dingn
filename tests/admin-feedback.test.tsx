import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFeedback } from "../src/components/admin-feedback";
const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "admin" } as { uid: string } | null,
    ready: true,
    isAdmin: true,
  },
  readFeedbackPage: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/admin-feedback", () => ({
  readFeedbackPage: mocks.readFeedbackPage,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "admin" }, ready: true, isAdmin: true };
});
afterEach(cleanup);
it("never queries feedback for visitors or non-admins", () => {
  mocks.session.user = null;
  const view = render(<AdminFeedback />);
  expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeTruthy();
  mocks.session.user = { uid: "ordinary" };
  mocks.session.isAdmin = false;
  view.rerender(<AdminFeedback />);
  expect(
    screen.getByRole("heading", { name: "Admin access required" }),
  ).toBeTruthy();
  expect(mocks.readFeedbackPage).not.toHaveBeenCalled();
});
it("shows feedback as text, paginates, and removes it when access changes", async () => {
  const cursor = { id: "last" };
  mocks.readFeedbackPage
    .mockResolvedValueOnce({
      items: [
        {
          id: "1",
          message: "<script>private</script>",
          uid: "author",
          status: "new",
          createdAt: null,
        },
      ],
      cursor,
      more: true,
    })
    .mockResolvedValue({ items: [], more: false });
  const view = render(<AdminFeedback />);
  await screen.findByText("<script>private</script>");
  await userEvent.click(screen.getByRole("button", { name: "Older" }));
  await screen.findByText("No feedback on this page.");
  expect(mocks.readFeedbackPage).toHaveBeenLastCalledWith(cursor);
  mocks.session.isAdmin = false;
  view.rerender(<AdminFeedback />);
  expect(screen.queryByText("No feedback on this page.")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Admin access required" }),
  ).toBeTruthy();
});
it("shows an error instead of treating failed reads as an empty inbox", async () => {
  mocks.readFeedbackPage.mockRejectedValue(new Error("denied"));
  render(<AdminFeedback />);
  await screen.findByRole("alert");
  expect(screen.queryByText("No feedback on this page.")).toBeNull();
});
