import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemShop } from "../src/components/item-shop";
import { formatPrice } from "../src/lib/shop";
const mocks = vi.hoisted(() => ({ api: vi.fn(), assign: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
const item = {
  id: "cape",
  game: "morrowglint",
  name: { en: "Test cape", "zh-CN": "测试披风" },
  description: { en: "Test description", "zh-CN": "测试描述" },
  unitAmount: 300,
  currency: "usd",
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    get: () => ({ assign: mocks.assign, search: "?purchase=pending" }),
  });
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith("/items")
      ? [item]
      : path.endsWith("/checkout")
        ? { url: "https://checkout.stripe.com/c/test" }
        : [],
  );
});
afterEach(cleanup);
it("offers one-time item purchases with no subscription and prevents duplicate clicks", async () => {
  render(<ItemShop />);
  await userEvent
    .setup()
    .dblClick(await screen.findByRole("button", { name: "Buy · $3.00" }));
  await waitFor(() =>
    expect(mocks.assign).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/test",
    ),
  );
  expect(mocks.api.mock.calls.filter(([p]) => p.endsWith("/checkout"))).toEqual(
    [["/api/billing/checkout", { itemId: "cape", locale: "en" }]],
  );
  expect(screen.queryByText(/Premium/)).toBeNull();
});
it("a return URL alone never shows owned", async () => {
  render(<ItemShop />);
  await screen.findByRole("button", { name: "Buy · $3.00" });
  expect(screen.queryByText("Owned")).toBeNull();
});
it("disables buying an owned item and shows account purchase history", async () => {
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith("/items")
      ? [item]
      : [
          {
            ...item,
            id: "order1",
            itemId: "cape",
            status: "owned",
            createdAt: 1,
          },
        ],
  );
  render(<ItemShop />);
  expect(
    (
      (await screen.findByRole("button", {
        name: "Owned",
      })) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("shows honest empty catalog without upgrade offers", async () => {
  mocks.api.mockResolvedValue([]);
  render(<ItemShop />);
  expect(await screen.findByText(/No items are available yet/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Buy/ })).toBeNull();
});
it("shows errors rather than pretending there are no items", async () => {
  mocks.api.mockRejectedValue(new Error("offline"));
  render(<ItemShop />);
  expect((await screen.findAllByRole("alert")).length).toBe(2);
});
it("formats one-time prices using currency units", () => {
  expect(formatPrice(item)).toBe("$3.00");
  expect(formatPrice({ ...item, currency: "jpy", unitAmount: 1000 })).toBe(
    "¥1,000",
  );
});
import { LocaleProvider } from "../src/components/locale";
it("renders the item shop in Chinese", async () => {
  localStorage.setItem("dingn.locale", "zh-CN");
  render(
    <LocaleProvider>
      <ItemShop />
    </LocaleProvider>,
  );
  expect(await screen.findByText("游戏道具")).toBeTruthy();
  expect(await screen.findByText("测试披风")).toBeTruthy();
  expect(screen.queryByText("Game items")).toBeNull();
  localStorage.removeItem("dingn.locale");
});

it("shows empty shop even when history fails, without claiming no purchases", async () => {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith("/items")) return [];
    throw new Error("history unavailable");
  });
  render(<ItemShop />);
  expect(await screen.findByText(/No items are available yet/)).toBeTruthy();
  expect(
    await screen.findByText(/Purchase history could not be loaded/),
  ).toBeTruthy();
  expect(screen.queryByText("No purchases yet.")).toBeNull();
  expect(screen.queryByText(/The item shop could not be loaded/)).toBeNull();
});
