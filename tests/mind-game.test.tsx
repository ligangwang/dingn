import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MindGame, starsFor } from "../src/components/mind-game";
const mocks = vi.hoisted(() => ({
  user: null as null | { uid: string },
  startPlay: vi.fn(),
  finishPlay: vi.fn(),
  setStats: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => ({
    user: mocks.user,
    stats: null,
    setStats: mocks.setStats,
  }),
}));
vi.mock("../src/lib/xp", async (real) => ({
  ...(await real<typeof import("../src/lib/xp")>()),
  startPlay: mocks.startPlay,
  finishPlay: mocks.finishPlay,
  fetchLeaderboard: mocks.fetchLeaderboard,
  MIN_PLAY_MS: { warmup: 0, logic: 0, decisions: 0 },
}));
beforeEach(() => {
  mocks.user = null;
  mocks.startPlay.mockReset();
  mocks.finishPlay.mockReset();
  mocks.fetchLeaderboard.mockReset();
  mocks.fetchLeaderboard.mockResolvedValue([
    { name: "Ada", xp: 120, level: 2 },
  ]);
});
afterEach(cleanup);
test("logic rounds lock answers, explain mistakes, and reset the score", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  await user.click(screen.getByRole("button", { name: "30" }));
  expect(screen.getByRole("status").textContent).toContain("24 × 2 = 48");
  expect(
    (screen.getByRole("button", { name: "48 ✓" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (const answer of ["No", "Mia", "25"]) {
    await user.click(screen.getByRole("button", { name: /Next round/ }));
    await user.click(screen.getByRole("button", { name: answer }));
  }
  await user.click(screen.getByRole("button", { name: /See results/ }));
  expect(screen.getByRole("status").textContent).toContain("3 of 4");
  expect(screen.getByLabelText("2 of 3 stars")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Play again" }));
  expect(screen.getByText("Round 1 of 4")).toBeTruthy();
  expect(screen.getByText("points")).toBeTruthy();
});
test("decision answers change with the objective and complete a session", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="decisions" />);
  const answers = ["Route B", "Route A", "Two scanners", "Take the new path"];
  for (let i = 0; i < answers.length; i++) {
    await user.click(screen.getByRole("button", { name: answers[i] }));
    expect(screen.getByRole("status").textContent).toContain("You found it.");
    await user.click(
      screen.getByRole("button", {
        name: i === 3 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByRole("status").textContent).toContain("4 of 4");
  expect(screen.getByText("Flawless run!")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Next game: Logic/ })).toBeTruthy();
});
test("the score label is singular for one point", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  await user.click(screen.getByRole("button", { name: "48" }));
  expect(screen.getByText("point")).toBeTruthy();
});
test("stars reward near-perfect and perfect runs", () => {
  expect([0, 1, 2, 3, 4].map((n) => starsFor(n, 4))).toEqual([0, 1, 1, 2, 3]);
});

test("guests play without XP calls and are invited to sign in", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  for (const [i, answer] of ["48", "No", "Mia", "25"].entries()) {
    if (i) await user.click(screen.getByRole("button", { name: /Next round/ }));
    await user.click(screen.getByRole("button", { name: answer }));
  }
  await user.click(screen.getByRole("button", { name: /See results/ }));
  expect(mocks.startPlay).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  expect(await screen.findByText("Ada")).toBeTruthy();
});
test("signed-in players send raw answers and get the server's XP", async () => {
  mocks.user = { uid: "alice" };
  mocks.startPlay.mockResolvedValue({ playId: "play123456", challenge: {} });
  mocks.finishPlay.mockResolvedValue({
    score: 3,
    max: 4,
    xpGained: 30,
    capped: false,
    newBest: true,
    streak: 2,
    level: 1,
    xp: 30,
    floor: 0,
    next: 100,
  });
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  await waitFor(() => expect(mocks.startPlay).toHaveBeenCalledWith("logic"));
  for (const [i, answer] of ["30", "No", "Mia", "25"].entries()) {
    if (i) await user.click(screen.getByRole("button", { name: /Next round/ }));
    await user.click(screen.getByRole("button", { name: answer }));
  }
  await user.click(screen.getByRole("button", { name: /See results/ }));
  expect(mocks.finishPlay).toHaveBeenCalledWith("play123456", [0, 1, 0, 1]);
  expect(await screen.findByText("+30 XP")).toBeTruthy();
  expect(screen.getByText(/2-day streak/)).toBeTruthy();
});

import { LocaleProvider, LanguageSwitcher } from "../src/components/locale";
import { translate } from "../src/lib/i18n";
test("language changes preserve locked answers and round progress", async () => {
  localStorage.setItem("dingn.locale", "en");
  const user = userEvent.setup();
  render(
    <LocaleProvider>
      <LanguageSwitcher />
      <MindGame mode="logic" />
    </LocaleProvider>,
  );
  await user.click(screen.getByRole("button", { name: "48" }));
  await user.selectOptions(screen.getByRole("combobox"), "zh-CN");
  expect(
    (screen.getByRole("button", { name: "48 ✓" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain(
    translate("Each number is twice the previous one. 24 × 2 = 48.", "zh-CN"),
  );
  await user.click(
    screen.getByRole("button", { name: translate("Next round →", "zh-CN") }),
  );
  expect(screen.getByText(translate("Round 2 of 4", "zh-CN"))).toBeTruthy();
  localStorage.clear();
});
