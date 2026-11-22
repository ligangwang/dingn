import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Account, honorName, honorOf } from "../src/components/account";

const mocks = vi.hoisted(() => ({
  saveNickname: vi.fn(),
  session: {
    user: { uid: "u1", email: "ada@example.com", photoURL: null },
    ready: true,
    profile: { userName: "Ada", cardSide: "OneSide", avatar: "fox" },
    profileError: "",
    stats: {
      level: 12,
      xp: 7000,
      floor: 6600,
      next: 7800,
      streak: 4,
      best: {},
      number: "7302518846",
    },
    updateProfile: vi.fn(),
    logout: vi.fn(),
  },
}));
vi.mock("../src/lib/xp", async (real) => ({
  ...(await real<typeof import("../src/lib/xp")>()),
  saveNickname: mocks.saveNickname,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/account/",
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
  useOptionalSession: () => mocks.session,
}));
vi.mock("../src/components/auth", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../src/components/rewards", () => ({
  useWallet: () => ({ coins: 340, badges: [{}, {}, {}], items: [] }),
  BadgeShelf: () => <p>badge shelf</p>,
}));
vi.mock("../src/components/item-shop", () => ({
  ItemShop: () => <p>item shop</p>,
}));
vi.mock("../src/components/kingdom", () => ({
  KingdomCard: () => <p>kingdom card</p>,
}));

beforeEach(() => window.history.replaceState(null, "", "/account/"));
afterEach(cleanup);

it("a level earns a metal and a title, rising with the kingdom's stages", () => {
  expect(honorOf(1)).toEqual({ tier: "bronze", title: "Wanderer", rank: 1 });
  expect(honorOf(4)).toEqual({
    tier: "bronze",
    title: "Village elder",
    rank: 1,
  });
  expect(honorOf(6)).toEqual({ tier: "silver", title: "Town lord", rank: 1 });
  expect(honorOf(12)).toEqual({
    tier: "gold",
    title: "City governor",
    rank: 3,
  });
  expect(honorOf(15).title).toBe("Monarch");
  expect(honorOf(25)).toEqual({
    tier: "diamond",
    title: "High monarch",
    rank: 6,
  });
  // Each level within an honor is a step: Town lord I, II, III, IV.
  const name = (level: number) => honorName(level, (text) => text);
  expect([6, 7, 8, 9, 10].map(name)).toEqual([
    "Town lord I",
    "Town lord II",
    "Town lord III",
    "Town lord IV",
    "City governor I",
  ]);
  expect(name(29)).toBe("High monarch X");
  expect(name(23)).toBe("High monarch IV");
});

it("shows who the player is and how far they have come, with their account details tucked away", () => {
  render(<Account />);
  expect(screen.getByRole("heading", { level: 1, name: "Ada" })).toBeTruthy();
  expect(document.querySelector(".profile-honor")!.textContent).toBe(
    "City governor III",
  );
  expect(document.querySelector(".profile-avatar.honor-gold")).toBeTruthy();
  expect(screen.getByText("340")).toBeTruthy();
  // Top right: the page other players see, and editing.
  expect(
    screen
      .getByRole("link", { name: "See your public page" })
      .getAttribute("href"),
  ).toMatch(/^\/player\/7302518846\/?$/);
  // The email and the editing form are in Settings, not on show.
  expect(screen.queryByText(/ada@example\.com/)).toBeNull();
  expect(screen.queryByLabelText("Nickname")).toBeNull();
  // Overview first: the level, then the kingdom.
  expect(
    screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText("Account level 12")).toBeTruthy();
  expect(screen.getByText("kingdom card")).toBeTruthy();
  // The path of honor: reached ranks lit, the next one with the XP to go.
  const path = screen.getByRole("region", { name: "Path of honor" });
  expect(within(path).getByText("3,500 XP to go")).toBeTruthy();
  // The road from City governor (level 10, 4,500 XP) to Monarch (level 15,
  // 10,500 XP) is filled as far as 7,000 XP.
  expect(
    Number(
      (path.querySelector("li.next") as HTMLElement).style.getPropertyValue(
        "--fill",
      ),
    ),
  ).toBeCloseTo(2500 / 6000);
  const steps = [...path.querySelectorAll("li")].map((li) => li.className);
  expect(steps).toEqual([
    "honor-step reached",
    "honor-step reached",
    "honor-step reached",
    "honor-step reached",
    "honor-step current",
    "honor-step next",
    "honor-step locked",
  ]);
});

it("opens each tab, by click, by keys and from the address", () => {
  render(<Account />);
  fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
  expect(screen.getByText("badge shelf")).toBeTruthy();
  expect(window.location.hash).toBe("#wallet");
  fireEvent.keyDown(screen.getByRole("tab", { name: "Wallet" }), {
    key: "ArrowDown",
  });
  expect(screen.getByText("item shop")).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "Shop" }),
  );
  // The pencil opens Settings, with the email and the form.
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  const panel = screen.getByRole("tabpanel");
  expect(within(panel).getByLabelText("Nickname")).toBeTruthy();
  expect(within(panel).getByText("Signed in as ada@example.com.")).toBeTruthy();
  cleanup();

  // Older links to #badges, and the way back from a checkout, still land right.
  window.history.replaceState(null, "", "/account/#badges");
  render(<Account />);
  expect(screen.getByText("badge shelf")).toBeTruthy();
  cleanup();
  window.history.replaceState(null, "", "/account/?purchase=pending");
  render(<Account />);
  expect(screen.getByText("item shop")).toBeTruthy();
  // Choosing another tab after a checkout keeps that choice on a reload.
  fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
  expect(window.location.search).toBe("");
  expect(window.location.hash).toBe("#wallet");
  cleanup();
  window.history.replaceState(null, "", "/account/?purchase=pending#settings");
  render(<Account />);
  expect(
    within(screen.getByRole("tabpanel")).getByLabelText("Nickname"),
  ).toBeTruthy();
});

it("saves a new nickname through dingn, and says when another player has it", async () => {
  const { XpError } = await import("../src/lib/xp");
  mocks.session.updateProfile.mockResolvedValue(undefined);
  mocks.saveNickname.mockRejectedValueOnce(
    new XpError("That nickname is taken.", "nickname_taken"),
  );
  window.history.replaceState(null, "", "/account/#settings");
  render(<Account />);
  const field = screen.getByLabelText("Nickname");
  fireEvent.change(field, { target: { value: "Star Gazer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect(
    await screen.findByText("That nickname is taken. Try another."),
  ).toBeTruthy();
  expect(mocks.session.updateProfile).not.toHaveBeenCalled();
  // A free one is saved, with the name as dingn keeps it.
  mocks.saveNickname.mockResolvedValueOnce({ name: "Star Gazer" });
  fireEvent.change(field, { target: { value: "  Star Gazer " } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect(await screen.findByText("Your profile is saved.")).toBeTruthy();
  expect(mocks.saveNickname).toHaveBeenLastCalledWith("  Star Gazer ");
  expect(mocks.session.updateProfile).toHaveBeenLastCalledWith(
    expect.objectContaining({ userName: "Star Gazer" }),
  );
});
