import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({
  pathname: "/",
  sync: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => mock.pathname }));
vi.mock("../src/lib/analytics", () => ({
  consentKey: "dingn.analytics-consent.v1",
  syncAnalytics: mock.sync,
  clearAnalyticsCookies: mock.clear,
}));
import { Analytics } from "../src/components/analytics";
afterEach(() => {
  cleanup();
  localStorage.clear();
  mock.sync.mockClear();
  window.history.replaceState({}, "", "/");
});
test("client navigation to opt-out persists denial before tracking that route", async () => {
  localStorage.setItem("dingn.analytics-consent.v1", "granted");
  mock.pathname = "/";
  const view = render(<Analytics />);
  await waitFor(() => expect(mock.sync).toHaveBeenCalledWith("granted", "/"));
  mock.sync.mockClear();
  window.history.replaceState({}, "", "/opt-out/");
  mock.pathname = "/opt-out/";
  view.rerender(<Analytics />);
  await waitFor(() =>
    expect(localStorage.getItem("dingn.analytics-consent.v1")).toBe("denied"),
  );
  expect(mock.sync.mock.calls.every((call) => call[0] === "denied")).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Analytics preferences" }),
  ).toBeNull();
});
