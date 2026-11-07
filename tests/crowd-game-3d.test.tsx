import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CrowdGame3D } from "../src/components/crowd-game-3d";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("shares saved progress with the 2D game and starts from the keyboard", async () => {
  localStorage.setItem("dingn.crowd.level", "6");
  render(<CrowdGame3D />);
  expect(
    await screen.findByRole("heading", { name: "Crowd Rush 3D" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Level 6").length).toBeGreaterThan(0);
  expect(
    screen
      .getByRole("link", { name: "Play the 2D version" })
      .getAttribute("href"),
  ).toMatch(/^\/crowd\/?$/);
});

test("falls back to a link to the 2D game when WebGL is unavailable", async () => {
  render(<CrowdGame3D />);
  expect(
    await screen.findByRole("heading", { name: "3D isn't available here" }),
  ).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
});
