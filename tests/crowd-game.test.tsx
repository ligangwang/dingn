import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { CrowdGame } from "../src/components/crowd-game";
import { LocaleProvider } from "../src/components/locale";
import catalog from "../src/data/zh-CN.json";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState({}, "", "/");
});

test("starts at the saved level and begins the run from the menu or keyboard", async () => {
  localStorage.setItem("dingn.crowd.level", "4");
  render(<CrowdGame />);
  expect(
    await screen.findByRole("heading", { name: "Ready to rush?" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Level 4").length).toBeGreaterThan(0);
  fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
  expect(screen.queryByRole("heading", { name: "Ready to rush?" })).toBeNull();
});

test("sound preference is remembered", async () => {
  render(<CrowdGame />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Sound on" })),
  );
  expect(localStorage.getItem("dingn.crowd.sound")).toBe("off");
});

test("the menu is translated into Simplified Chinese", async () => {
  history.replaceState({}, "", "/crowd/?lang=zh-CN");
  render(
    <LocaleProvider>
      <CrowdGame />
    </LocaleProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: catalog["Crowd Rush"] }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: catalog["Ready to rush?"] }),
  ).toBeTruthy();
  expect(screen.getAllByText("第 1 关").length).toBeGreaterThan(0);
  localStorage.removeItem("dingn.locale");
});
