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
import type {
  DingnGame,
  Locale,
} from "../../../packages/game-sdk/dingn-sdk.js";
import { CrowdGame } from "../src/crowd-game";
import { DingnProvider } from "../src/dingn";
import { loadStore } from "../src/crowd-shared";

const mocks = vi.hoisted(() => ({
  webgl: true,
  scene: null as { translate: (text: string) => string } | null,
}));
// A stand-in for the three.js scene, so overlays stay up while a test runs.
vi.mock("../src/crowd-scene", () => ({
  CrowdScene: class {
    translate = (text: string) => text;
    constructor() {
      if (!mocks.webgl) throw new Error("no WebGL");
      mocks.scene = this;
    }
    resize() {}
    load() {}
    relabel() {}
    loadModels = () => Promise.resolve();
    render() {}
    project = () => ({ x: 0, y: 0, visible: false });
    dispose() {}
  },
}));

/** A fake dingn website: device storage, account progress and calls made. */
let stored: Map<string, string>;
let sdk: DingnGame;
const calls = {
  load: vi.fn<() => Promise<unknown>>(),
  save: vi.fn<(data: unknown) => Promise<void>>(),
  signIn: vi.fn<() => void>(),
  navigate: vi.fn<(path: string) => void>(),
};
function fakeSdk(signedIn: boolean, locale: Locale = "en") {
  stored = new Map();
  calls.load.mockReset().mockResolvedValue(null);
  calls.save.mockReset().mockResolvedValue(undefined);
  calls.signIn.mockReset();
  calls.navigate.mockReset();
  sdk = {
    gameId: "crowd",
    version: "1.0.0",
    locale,
    player: { signedIn, name: signedIn ? "Ada" : "", avatar: "" },
    embedded: true,
    onPlayer: () => () => {},
    storage: {
      get: async (key) => stored.get(key) ?? null,
      set: async (key, value) => void stored.set(key, String(value)),
    },
    progress: {
      load: calls.load as DingnGame["progress"]["load"],
      save: calls.save as DingnGame["progress"]["save"],
    },
    requestSignIn: calls.signIn,
    navigate: calls.navigate,
    ready() {},
  };
}
async function play(saved: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(saved)) stored.set(k, v);
  await loadStore(sdk.storage);
  return render(
    <DingnProvider sdk={sdk}>
      <CrowdGame />
    </DingnProvider>,
  );
}

beforeEach(() => {
  fakeSdk(false);
  mocks.webgl = true;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("starts at the saved level and names the game for screen readers", async () => {
  await play({ level: "4" });
  expect(
    await screen.findByRole("heading", { name: "Crowd Rush" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Level 4").length).toBeGreaterThan(0);
});

test("levels 1 to 5 play without an account", async () => {
  await play({ level: "5" });
  expect(await screen.findByRole("button", { name: "Start" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Save your progress to keep going" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Sign in to save it across devices." }),
  );
  expect(calls.signIn).toHaveBeenCalled();
});

test("level 6 asks a signed-out player to sign in, with a way back", async () => {
  await play({ level: "6", best: "5" });
  expect(
    await screen.findByRole("heading", {
      name: "Save your progress to keep going",
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Sign in to keep playing" }),
  );
  expect(calls.signIn).toHaveBeenCalledTimes(1);
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

test("signed-in players play past level 5 and merge progress with the account", async () => {
  fakeSdk(true);
  calls.load.mockResolvedValue({ level: 9, best: 8 });
  await play({ level: "6", best: "5" });
  await waitFor(() =>
    expect(screen.getAllByText("Level 9").length).toBeGreaterThan(0),
  );
  expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  await waitFor(() => expect(stored.get("level")).toBe("9"));
  expect(stored.get("best")).toBe("8");
  expect(screen.getByText(/Progress is saved to your account\./)).toBeTruthy();
  // the account already had the furthest progress, so nothing is written
  expect(calls.save).not.toHaveBeenCalled();
});

test("progress made on this device is uploaded on sign-in", async () => {
  fakeSdk(true);
  calls.load.mockResolvedValue({ level: 3, best: 2 });
  await play({ level: "8", best: "7" });
  await waitFor(() =>
    expect(calls.save).toHaveBeenCalledWith({ level: 8, best: 7 }),
  );
  expect(screen.getAllByText("Level 8").length).toBeGreaterThan(0);
});

test("explains when WebGL is unavailable and goes back to the games", async () => {
  mocks.webgl = false;
  await play();
  expect(
    await screen.findByRole("heading", { name: "3D isn't available here" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to games" }));
  expect(calls.navigate).toHaveBeenCalledWith("/");
  fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
});

test("sound preference is remembered", async () => {
  await play();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Sound on" })),
  );
  expect(stored.get("sound")).toBe("off");
});

test("the game is translated into Simplified Chinese", async () => {
  fakeSdk(false, "zh-CN");
  await play();
  expect(await screen.findByRole("heading", { name: "人潮突击" })).toBeTruthy();
  expect(screen.getAllByText("第 1 关").length).toBeGreaterThan(0);
});

test("words painted on the 3D crates are translated into Simplified Chinese", async () => {
  fakeSdk(false, "zh-CN");
  mocks.scene = null;
  await play();
  await waitFor(() => expect(mocks.scene).not.toBeNull());
  await waitFor(() => expect(mocks.scene!.translate("RATE")).toBe("射速"));
  expect(mocks.scene!.translate("POWER")).toBe("伤害");
  expect(mocks.scene!.translate("RATE+")).toBe("射速+");
  expect(mocks.scene!.translate("DMG+")).toBe("伤害+");
});

test("the sign-in prompt is translated into Simplified Chinese", async () => {
  fakeSdk(false, "zh-CN");
  await play({ level: "6" });
  expect(
    await screen.findByRole("heading", { name: "保存进度，继续闯关" }),
  ).toBeTruthy();
  expect(
    screen.getByText(/你已经通过了前 5 关。免费登录即可挑战第 6 关/),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "登录继续玩" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "重玩第 5 关" })).toBeTruthy();
});
