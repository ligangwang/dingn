import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CrowdGame } from "../src/components/crowd-game";
import { LocaleProvider } from "../src/components/locale";
import catalog from "../src/data/zh-CN.json";

type User = { uid: string };
const mocks = vi.hoisted(() => ({
  session: { user: null as User | null, ready: true },
  readCrowdProgress: vi.fn(),
  saveCrowdProgress: vi.fn(),
  webgl: true,
}));
// A stand-in for the three.js scene, so overlays stay up while a test runs.
vi.mock("../src/game/crowd-scene", () => ({
  CrowdScene: class {
    constructor() {
      if (!mocks.webgl) throw new Error("no WebGL");
    }
    resize() {}
    load() {}
    loadModels = () => Promise.resolve();
    render() {}
    project = () => ({ x: 0, y: 0, visible: false });
    dispose() {}
  },
}));
vi.mock("../src/components/session", () => ({
  useOptionalSession: () => mocks.session,
}));
vi.mock("../src/lib/crowd-progress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/crowd-progress")>()),
  readCrowdProgress: mocks.readCrowdProgress,
  saveCrowdProgress: mocks.saveCrowdProgress,
}));

beforeEach(() => {
  localStorage.clear();
  mocks.session = { user: null, ready: true };
  mocks.webgl = true;
  mocks.readCrowdProgress.mockReset().mockResolvedValue({ level: 1, best: 0 });
  mocks.saveCrowdProgress.mockReset().mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState({}, "", "/");
});

test("starts at the saved level and has no 2D version to switch to", async () => {
  localStorage.setItem("dingn.crowd.level", "4");
  render(<CrowdGame />);
  expect(
    await screen.findByRole("heading", { name: "Crowd Rush" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Level 4").length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: /2D/ })).toBeNull();
});

test("levels 1 to 5 play without an account", async () => {
  localStorage.setItem("dingn.crowd.level", "5");
  render(<CrowdGame />);
  expect(await screen.findByRole("button", { name: "Start" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Save your progress to keep going" }),
  ).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Sign in to save it across devices." })
      .getAttribute("href"),
  ).toMatch(/^\/signin\/?\?next=%2Fcrowd%2F$/);
});

test("level 6 asks a signed-out player to sign in, with a way back", async () => {
  localStorage.setItem("dingn.crowd.level", "6");
  localStorage.setItem("dingn.crowd.best", "5");
  render(<CrowdGame />);
  expect(
    await screen.findByRole("heading", {
      name: "Save your progress to keep going",
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Sign in to keep playing" })
      .getAttribute("href"),
  ).toMatch(/^\/signin\/?\?next=%2Fcrowd%2F$/);
  // Enter does not start a locked level
  fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
  expect(
    screen.getByText("Level 6", { selector: ".crowd-level" }),
  ).toBeTruthy();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Replay level 5" })),
  );
  expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  expect(screen.getAllByText("Level 5").length).toBeGreaterThan(0);
});

test("waits for the session before deciding a level is locked", async () => {
  localStorage.setItem("dingn.crowd.level", "7");
  mocks.session = { user: null, ready: false };
  render(<CrowdGame />);
  expect(await screen.findByRole("status")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Save your progress to keep going" }),
  ).toBeNull();
});

test("signed-in players play past level 5 and merge progress with the account", async () => {
  localStorage.setItem("dingn.crowd.level", "6");
  localStorage.setItem("dingn.crowd.best", "5");
  mocks.session = { user: { uid: "u1" }, ready: true };
  mocks.readCrowdProgress.mockResolvedValue({ level: 9, best: 8 });
  render(<CrowdGame />);
  await waitFor(() =>
    expect(screen.getAllByText("Level 9").length).toBeGreaterThan(0),
  );
  expect(mocks.readCrowdProgress).toHaveBeenCalledWith("u1");
  expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  expect(localStorage.getItem("dingn.crowd.level")).toBe("9");
  expect(localStorage.getItem("dingn.crowd.best")).toBe("8");
  expect(screen.getByText(/Progress is saved to your account\./)).toBeTruthy();
  // the account already had the furthest progress, so nothing is written
  expect(mocks.saveCrowdProgress).not.toHaveBeenCalled();
});

test("progress made on this device is uploaded on sign-in", async () => {
  localStorage.setItem("dingn.crowd.level", "8");
  localStorage.setItem("dingn.crowd.best", "7");
  mocks.session = { user: { uid: "u2" }, ready: true };
  mocks.readCrowdProgress.mockResolvedValue({ level: 3, best: 2 });
  render(<CrowdGame />);
  await waitFor(() =>
    expect(mocks.saveCrowdProgress).toHaveBeenCalledWith("u2", {
      level: 8,
      best: 7,
    }),
  );
  expect(screen.getAllByText("Level 8").length).toBeGreaterThan(0);
});

test("explains when WebGL is unavailable and links back to the games", async () => {
  mocks.webgl = false;
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
  history.replaceState({}, "", "/zh/crowd/");
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

test("the sign-in prompt is translated into Simplified Chinese", async () => {
  history.replaceState({}, "", "/zh/crowd/");
  localStorage.setItem("dingn.crowd.level", "6");
  render(
    <LocaleProvider>
      <CrowdGame />
    </LocaleProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "保存进度，继续闯关" }),
  ).toBeTruthy();
  expect(
    screen.getByText(/你已经通过了前 5 关。免费登录即可挑战第 6 关/),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "登录继续玩" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "重玩第 5 关" })).toBeTruthy();
  localStorage.removeItem("dingn.locale");
});
