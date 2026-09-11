import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Practice } from "../src/components/practice";
import { Account } from "../src/components/account";
const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "existing-user", email: "owner@example.test" },
    ready: true,
    profile: { userName: "Owner", cardSide: "OneSide" },
    profileError: "",
    updateProfile: vi.fn(),
    logout: vi.fn(),
  },
  readNumbers: vi.fn(),
  readNumber: vi.fn(),
  randomWord: vi.fn(),
  readWord: vi.fn(),
  readFavorite: vi.fn(),
  saveFavorite: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/repository", () => mocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.push }),
}));
const number = (value: string) => ({
  number: value,
  words: ["sun", "son"],
  favorite: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.profile = { userName: "Owner", cardSide: "OneSide" };
  mocks.session.profileError = "";
  mocks.session.user = { uid: "existing-user", email: "owner@example.test" };
  mocks.readNumbers.mockResolvedValue({
    items: [number("0"), number("1")],
    more: false,
  });
  mocks.readFavorite.mockResolvedValue(null);
  mocks.saveFavorite.mockResolvedValue(undefined);
  mocks.readNumber.mockImplementation(async (value: string) => number(value));
  mocks.randomWord.mockResolvedValue({
    word: "name",
    number: "23",
    ipa: "",
    language: "",
    definitions: { noun: ["A label."] },
  });
});
afterEach(cleanup);
describe("migrated practice behavior", () => {
  it("does not expose answer before recall and preserves leading-zero favorite IDs", async () => {
    mocks.session.profile.cardSide = "TwoSides";
    mocks.readNumbers.mockResolvedValue({ items: [number("02")], more: false });
    const user = userEvent.setup();
    render(<Practice mode="number" />);
    await screen.findByRole("heading", { name: "02" });
    expect(screen.queryByRole("button", { name: "sun" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Reveal answer/ }));
    await user.click(screen.getByRole("button", { name: "sun" }));
    await waitFor(() =>
      expect(mocks.saveFavorite).toHaveBeenCalledWith(
        "existing-user",
        "02",
        "sun",
      ),
    );
    expect(
      screen.getByRole("button", { name: "sun" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("search results do not corrupt the browsing position and favorites target the result", async () => {
    const user = userEvent.setup();
    render(<Practice mode="number" />);
    await screen.findByRole("heading", { name: "0" });
    await user.click(screen.getByRole("button", { name: /Next practice/ }));
    await screen.findByRole("heading", { name: "1" });
    await user.type(
      screen.getByRole("textbox", { name: "Search numbers" }),
      "02",
    );
    await user.click(
      screen.getByRole("button", { name: "Search" }),
    );
    await screen.findByRole("heading", { name: "02" });
    await user.click(screen.getByRole("button", { name: "son" }));
    await waitFor(() =>
      expect(mocks.saveFavorite).toHaveBeenCalledWith(
        "existing-user",
        "02",
        "son",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Back to practice" }));
    await screen.findByRole("heading", { name: "1" });
  });
  it("does not mark a failed favorite write as saved", async () => {
    mocks.saveFavorite.mockRejectedValue({ code: "permission-denied" });
    const user = userEvent.setup();
    render(<Practice mode="number" />);
    await screen.findByRole("heading", { name: "0" });
    await user.click(screen.getByRole("button", { name: "sun" }));
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "sun" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
  it("retries a failed initial read and loads digit filters independently", async () => {
    mocks.readNumbers.mockRejectedValueOnce({ code: "unavailable" });
    const user = userEvent.setup();
    render(<Practice mode="number" />);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "0" });
    await user.click(screen.getByRole("button", { name: "2 digits" }));
    await waitFor(() => expect(mocks.readNumbers).toHaveBeenLastCalledWith(2));
  });
  it("uses legacy deck mapping and reveals the next card independently", async () => {
    const user = userEvent.setup();
    render(<Practice mode="card" />);
    await screen.findByRole("img", { name: "2 of clubs" });
    expect(mocks.readNumber).toHaveBeenCalledWith("72");
    await user.click(screen.getByRole("button", { name: /Reveal answer/ }));
    await screen.findByRole("heading", { name: "72" });
    await user.click(screen.getByRole("button", { name: /Next practice/ }));
    await screen.findByRole("img", { name: "3 of clubs" });
    expect(mocks.readNumber).toHaveBeenLastCalledWith("73");
  });
  it("retains the previous word when navigating back", async () => {
    const user = userEvent.setup();
    render(<Practice mode="word" />);
    await screen.findByRole("heading", { name: "name" });
    mocks.randomWord.mockResolvedValueOnce({
      word: "sun",
      number: "02",
      ipa: "",
      language: "",
      definitions: {},
    });
    await user.click(screen.getByRole("button", { name: /Next practice/ }));
    await screen.findByRole("heading", { name: "sun" });
    await user.click(screen.getByRole("button", { name: /Previous/ }));
    await screen.findByRole("heading", { name: "name" });
  });
  it("saves account preferences without writing other users or replacing unrelated fields", async () => {
    mocks.session.updateProfile.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Account />);
    await user.clear(screen.getByRole("textbox", { name: "Display name" }));
    await user.type(
      screen.getByRole("textbox", { name: "Display name" }),
      "New name",
    );
    await user.click(screen.getByRole("radio", { name: /Recall/ }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByRole("status");
    expect(mocks.session.updateProfile).toHaveBeenCalledWith({
      userName: "New name",
      cardSide: "TwoSides",
    });
  });
});

