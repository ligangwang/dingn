import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import packs from "../src/data/coin-packs.json";
import { CoinShop } from "../src/components/coin-shop";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  assign: vi.fn(),
  loadWallet: vi.fn(),
  search: "",
  testMode: true,
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/components/auth", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: { uid: "alice" } }),
}));
vi.mock("../src/components/rewards", () => ({
  useWallet: () => ({ coins: 120, badges: [], items: [] }),
}));
vi.mock("../src/lib/rewards", () => ({ loadWallet: mocks.loadWallet }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.search = "";
  mocks.testMode = true;
  Object.defineProperty(window, "location", {
    configurable: true,
    get: () => ({ assign: mocks.assign, search: mocks.search }),
  });
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith("/coin-packs")
      ? { packs, testMode: mocks.testMode }
      : { url: "https://checkout.stripe.com/c/test" },
  );
});
afterEach(cleanup);
it("shows the balance, the packs with their bonus, and opens Stripe Checkout once", async () => {
  render(<CoinShop />);
  expect(screen.getByText("120")).toBeTruthy();
  expect(await screen.findByText("+33% more coins")).toBeTruthy();
  expect(screen.getByText("+45% more coins")).toBeTruthy();
  expect(screen.getByRole("note").textContent).toContain("4242");
  await userEvent
    .setup()
    .dblClick(screen.getByRole("button", { name: "$1.99" }));
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/test",
    ),
  );
  expect(
    mocks.api.mock.calls.filter(([p]) => p.endsWith("/buy-coins")),
  ).toEqual([
    ["/api/billing/buy-coins", { packId: "coins-800", locale: "en" }],
  ]);
});
it("hides the test-mode note with live keys and refreshes the wallet after payment", async () => {
  mocks.testMode = false;
  mocks.search = "?purchase=pending";
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<CoinShop />);
  expect(await screen.findByText(/coins will appear/)).toBeTruthy();
  expect(screen.queryByRole("note")).toBeNull();
  vi.advanceTimersByTime(2000);
  expect(mocks.loadWallet).toHaveBeenCalledWith("alice", true);
  vi.useRealTimers();
});
it("says the shop isn't open when payments are not configured", async () => {
  mocks.api.mockResolvedValue({ packs: [], testMode: false });
  render(<CoinShop />);
  expect(await screen.findByText(/isn’t open yet/)).toBeTruthy();
});
