import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PremiumPanel } from "../src/components/premium";

const monthly = {
  id: "price_month",
  currency: "usd",
  unitAmount: 299,
  interval: "month",
  recurring: true,
};
const mocks = vi.hoisted(() => ({
  readPremiumPrices: vi.fn(),
  startCheckout: vi.fn(),
  openBillingPortal: vi.fn(),
  watchActiveSubscription: vi.fn(),
  refreshClaims: vi.fn(),
  session: { isPremium: false } as { isPremium: boolean },
  assign: vi.fn(),
}));
vi.mock("../src/lib/premium", async (original) => ({
  ...(await original<typeof import("../src/lib/premium")>()),
  readPremiumPrices: mocks.readPremiumPrices,
  startCheckout: mocks.startCheckout,
  openBillingPortal: mocks.openBillingPortal,
  watchActiveSubscription: mocks.watchActiveSubscription,
}));
vi.mock("../src/components/session", () => ({
  useSession: () => ({
    user: { uid: "player1" },
    isPremium: mocks.session.isPremium,
    refreshClaims: mocks.refreshClaims,
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.isPremium = false;
  mocks.readPremiumPrices.mockResolvedValue([monthly]);
  mocks.watchActiveSubscription.mockReturnValue(() => {});
  mocks.refreshClaims.mockResolvedValue(undefined);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign: mocks.assign, search: "" },
  });
});
afterEach(cleanup);

it("offers the premium price and sends the player to Stripe Checkout", async () => {
  mocks.startCheckout.mockResolvedValue("https://checkout.stripe.com/c/abc");
  render(<PremiumPanel />);
  const user = userEvent.setup();
  const button = await screen.findByRole("button", {
    name: "Upgrade · $2.99 / month",
  });
  await user.dblClick(button);
  expect(mocks.startCheckout).toHaveBeenCalledTimes(1);
  expect(mocks.startCheckout).toHaveBeenCalledWith("player1", monthly);
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/abc",
    ),
  );
});

it("shows an error and re-enables upgrading when checkout fails", async () => {
  mocks.startCheckout.mockRejectedValue(new Error("boom"));
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
  mocks.readPremiumPrices.mockResolvedValue([]);
  render(<PremiumPanel />);
  expect(await screen.findByText(/isn’t available yet/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("lets premium players manage their subscription", async () => {
  mocks.session.isPremium = true;
  mocks.openBillingPortal.mockResolvedValue("https://billing.stripe.com/p/x");
  render(<PremiumPanel />);
  expect(screen.getByText("Active")).toBeTruthy();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Manage subscription" }));
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith("https://billing.stripe.com/p/x"),
  );
});

it("refreshes the sign-in token once a new subscription appears", async () => {
  mocks.watchActiveSubscription.mockImplementation((_uid, onChange) => {
    onChange(true);
    return () => {};
  });
  render(<PremiumPanel />);
  await waitFor(() => expect(mocks.refreshClaims).toHaveBeenCalled());
  expect(screen.getByText("Active")).toBeTruthy();
});

it("formats prices in the currency's minor unit", async () => {
  const { formatPrice } =
    await vi.importActual<typeof import("../src/lib/premium")>(
      "../src/lib/premium",
    );
  expect(formatPrice(monthly)).toBe("$2.99 / month");
  expect(formatPrice({ ...monthly, currency: "jpy", unitAmount: 1000 })).toBe(
    "¥1,000 / month",
  );
});
