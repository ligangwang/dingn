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
const SEQ = "01234567890123456789";
const mocks = vi.hoisted(() => ({ begin: vi.fn(), submit: vi.fn() }));
vi.mock("../src/components/xp", () => ({
  useXpPlay: () => ({ ...mocks, signedIn: true, outcome: { kind: "idle" } }),
  XpSummary: () => null,
}));
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mocks.begin.mockResolvedValue({ sequences: Array(20).fill(SEQ) });
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
test("correct rounds climb from three to twenty digits and submit once", async () => {
  await start();
  for (let n = 3; n <= 20; n++) {
    expect(
      screen.getByLabelText(`Remember ${SEQ.slice(0, n).split("").join(", ")}`),
    ).toBeTruthy();
    await time(n * 1000);
    expect(screen.queryByLabelText(/^Remember /)).toBeNull();
    answer(SEQ.slice(0, n));
    fireEvent.click(
      screen.getByRole("button", {
        name: n === 20 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByText("Top of the ladder!")).toBeTruthy();
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(
    Array.from({ length: 18 }, (_, i) => SEQ.slice(0, i + 3)),
  );
  expect(localStorage.getItem("dingn.memory-ladder.best.v1")).toBe("20");
});
test("three misses end the climb", async () => {
  await start();
  for (let miss = 1; miss <= 3; miss++) {
    expect(screen.getByLabelText(`${4 - miss} of 3 lives left`)).toBeTruthy();
    await time(3000);
    answer("999");
    fireEvent.click(
      screen.getByRole("button", {
        name: miss === 3 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByText("Your climb is complete.")).toBeTruthy();
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(["999", "999", "999"]);
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
