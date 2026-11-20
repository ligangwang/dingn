import { afterEach, expect, it } from "vitest";
import {
  MAX_KEPT,
  madeHere,
  rememberChallenge,
} from "../src/lib/my-challenges";

afterEach(() => localStorage.clear());

it("remembers the challenge links made in this browser, newest kept", () => {
  expect(madeHere("Xq3v9TzK1bWm")).toBe(false);
  rememberChallenge("Xq3v9TzK1bWm");
  expect(madeHere("Xq3v9TzK1bWm")).toBe(true);
  for (let i = 0; i < MAX_KEPT; i++) rememberChallenge(`id${i}`);
  // The oldest falls off once the list is full.
  expect(madeHere("Xq3v9TzK1bWm")).toBe(false);
  expect(madeHere(`id${MAX_KEPT - 1}`)).toBe(true);
  // Junk in storage reads as nothing remembered.
  localStorage.setItem("dingn.challenges.mine.v1", "{oops");
  expect(madeHere("id1")).toBe(false);
  rememberChallenge("id1");
  expect(madeHere("id1")).toBe(true);
});
