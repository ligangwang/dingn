import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { WarmUp } from "../src/components/warm-up";
const mocks = vi.hoisted(() => ({ begin: vi.fn(), submit: vi.fn() }));
vi.mock("../src/components/xp", () => ({
  useXpPlay: () => ({ ...mocks, signedIn: true, outcome: { kind: "idle" } }),
  XpSummary: () => null,
}));
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mocks.begin.mockResolvedValue({ sequences: Array(6).fill("01234567") });
  mocks.submit.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function start() {
  render(<WarmUp />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Start climbing/ })),
  );
}
async function time(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
function answer(value: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));
}
test("six correct rounds climb from three to eight digits and submit once", async () => {
  await start();
  for (let n = 3; n <= 8; n++) {
    expect(
      screen.getByLabelText(
        `Remember ${"01234567".slice(0, n).split("").join(", ")}`,
      ),
    ).toBeTruthy();
    await time(n * 1000);
    expect(screen.queryByLabelText(/^Remember /)).toBeNull();
    answer("01234567".slice(0, n));
    fireEvent.click(
      screen.getByRole("button", {
        name: n === 8 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByText("Top of the ladder!")).toBeTruthy();
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith([
    "012",
    "0123",
    "01234",
    "012345",
    "0123456",
    "01234567",
  ]);
  expect(localStorage.getItem("dingn.memory-ladder.best.v1")).toBe("8");
});
test("typing does not reset recall deadline and a miss keeps difficulty", async () => {
  await start();
  await time(3000);
  await time(10000);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "99" } });
  await time(5000);
  expect(screen.getByText(/You entered 99/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Next round/ }));
  expect(screen.getByLabelText("Remember 0, 1, 2")).toBeTruthy();
  expect(mocks.submit).not.toHaveBeenCalled();
});
