import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PremiumPanel } from "../src/components/premium";
import { formatPrice } from "../src/lib/premium";

const monthly = {
  id: "price_month",
  currency: "usd",
  unitAmount: 299,
  interval: "month",
};
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  user: { uid: "player1", isPremium: false } as {
    uid: string;
    isPremium?: boolean;
  },
  assign: vi.fn(),
  search: "",
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: mocks.user }),
}));
function route(table: Record<string, unknown>) {
  mocks.api.mockImplementation(async (path: string) => {
    const value = table[path];
    if (value instanceof Error) throw value;
    if (typeof value === "function") return value();
    return value;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { uid: "player1", isPremium: false };
  mocks.search = "";
  route({ "/api/billing/prices": [monthly] });
  Object.defineProperty(window, "location", {
    configurable: true,
    get: () => ({ assign: mocks.assign, search: mocks.search }),
  });
});
afterEach(cleanup);

it("offers the premium price and sends the player to Stripe Checkout", async () => {
  route({
    "/api/billing/prices": [monthly],
    "/api/billing/checkout": { url: "https://checkout.stripe.com/c/abc" },
  });
  render(<PremiumPanel />);
  const user = userEvent.setup();
  await user.dblClick(
    await screen.findByRole("button", { name: "Upgrade · $2.99 / month" }),
  );
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/abc",
    ),
  );
  const checkouts = mocks.api.mock.calls.filter(
    ([path]) => path === "/api/billing/checkout",
  );
  expect(checkouts).toEqual([
    ["/api/billing/checkout", { price: "price_month" }],
  ]);
});

it("shows an error and re-enables upgrading when checkout fails", async () => {
  route({
    "/api/billing/prices": [monthly],
    "/api/billing/checkout": new Error("checkout-timeout"),
  });
  render(<PremiumPanel />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Upgrade/ }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Upgrade/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(mocks.assign).not.toHaveBeenCalled();
});

it("says premium is unavailable when no plan is configured", async () => {
  route({ "/api/billing/prices": [] });
  render(<PremiumPanel />);
  expect(await screen.findByText(/isn’t available yet/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("lets premium players manage their subscription", async () => {
  mocks.user = { uid: "player1", isPremium: true };
  route({ "/api/billing/portal": { url: "https://billing.stripe.com/p/x" } });
  render(<PremiumPanel />);
  expect(screen.getByText("Active")).toBeTruthy();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Manage subscription" }));
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith("https://billing.stripe.com/p/x"),
  );
  expect(mocks.api).not.toHaveBeenCalledWith("/api/billing/prices");
});

it("activates premium after checkout once the server reports it", async () => {
  mocks.search = "?checkout=success";
  route({
    "/api/billing/prices": [monthly],
    "/api/billing/status": { isPremium: true },
  });
  render(<PremiumPanel />);
  expect(await screen.findByText("Active")).toBeTruthy();
});

it("formats prices in the currency's minor unit", () => {
  expect(formatPrice(monthly)).toBe("$2.99 / month");
  expect(formatPrice({ ...monthly, currency: "jpy", unitAmount: 1000 })).toBe(
    "¥1,000 / month",
  );
});
