import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Account, honorOf } from "../src/components/account";

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
vi.mock("../src/components/kingdom-card", () => ({
  KingdomCard: () => <p>kingdom card</p>,
}));

beforeEach(() => window.history.replaceState(null, "", "/account/"));
afterEach(cleanup);

it("a level earns a metal and a title, rising with the kingdom's stages", () => {
  expect(honorOf(1)).toEqual({ tier: "bronze", title: "Wanderer" });
  expect(honorOf(4)).toEqual({ tier: "bronze", title: "Village elder" });
  expect(honorOf(6)).toEqual({ tier: "silver", title: "Town lord" });
  expect(honorOf(12)).toEqual({ tier: "gold", title: "City governor" });
  expect(honorOf(15).title).toBe("Monarch");
  expect(honorOf(25)).toEqual({ tier: "diamond", title: "High monarch" });
});

it("shows who the player is and how far they have come, with their account details tucked away", () => {
  render(<Account />);
  expect(screen.getByRole("heading", { level: 1, name: "Ada" })).toBeTruthy();
  expect(document.querySelector(".profile-honor")!.textContent).toBe(
    "City governor",
  );
  expect(document.querySelector(".profile-avatar.honor-gold")).toBeTruthy();
  expect(screen.getByText("340")).toBeTruthy();
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
  expect(
    within(path).getByText("Monarch at level 15: 3,500 XP to go."),
  ).toBeTruthy();
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
