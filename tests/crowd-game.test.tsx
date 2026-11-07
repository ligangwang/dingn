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

test("starts at the saved level and has no 2D version to switch to", async () => {
  localStorage.setItem("dingn.crowd.level", "6");
  render(<CrowdGame />);
  expect(
    await screen.findByRole("heading", { name: "Crowd Rush" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Level 6").length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: /2D/ })).toBeNull();
});

test("explains when WebGL is unavailable and links back to the games", async () => {
  render(<CrowdGame />);
  expect(
    await screen.findByRole("heading", { name: "3D isn't available here" }),
  ).toBeTruthy();
  expect(
    screen
      .getAllByRole("link", { name: "Back to games" })
      .every((a) => a.getAttribute("href") === "/"),
  ).toBe(true);
  fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
});

test("sound preference is remembered", async () => {
  render(<CrowdGame />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Sound on" })),
  );
  expect(localStorage.getItem("dingn.crowd.sound")).toBe("off");
});

test("the page is translated into Simplified Chinese", async () => {
  history.replaceState({}, "", "/crowd/?lang=zh-CN");
  render(
    <LocaleProvider>
      <CrowdGame />
    </LocaleProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: catalog["Crowd Rush"] }),
  ).toBeTruthy();
  expect(screen.getAllByText("第 1 关").length).toBeGreaterThan(0);
  localStorage.removeItem("dingn.locale");
});
