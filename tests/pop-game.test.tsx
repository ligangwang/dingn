import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { PopGame } from "../src/components/pop-game";
import { LocaleProvider } from "../src/components/locale";
import catalog from "../src/data/zh-CN.json";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState({}, "", "/");
});

test("keyboard pops count up, persist on the device, and a fresh sheet can be laid", async () => {
  render(<PopGame />);
  const sheet = screen.getByRole("application");
  await act(async () => {
    fireEvent.keyDown(sheet, { key: " " });
    fireEvent.keyDown(sheet, { key: "Enter" });
    fireEvent.keyDown(sheet, { key: "a" });
  });
  const stats = screen.getByLabelText("Your pops");
  expect(stats.textContent).toContain("2this visit");
  expect(localStorage.getItem("dingn.pop.total")).toBe("2");
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
  expect(localStorage.getItem("dingn.pop.sound")).toBe("off");
  expect(screen.getByRole("button", { name: "Sound off" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fresh sheet" }));
  expect(stats.textContent).toContain("2all time");
});

test("the game is fully translated into Simplified Chinese", () => {
  history.replaceState({}, "", "/pop/?lang=zh-CN");
  render(
    <LocaleProvider>
      <PopGame />
    </LocaleProvider>,
  );
  expect(
    screen.getByRole("heading", { name: catalog["Bubble Calm"] }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: catalog["Fresh sheet"] }),
  ).toBeTruthy();
  localStorage.removeItem("dingn.locale");
});
