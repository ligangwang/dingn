import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LocaleProvider } from "../src/components/locale";
import { MorrowglintFeature } from "../src/components/morrowglint";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
test("English brand cards omit the Chinese subtitle", () => {
  localStorage.setItem("dingn.locale", "en");
  render(
    <LocaleProvider>
      <MorrowglintFeature full />
    </LocaleProvider>,
  );
  expect(screen.getByRole("heading", { name: "Morrowglint" })).toBeTruthy();
  expect(screen.queryByText("拾光幻境")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Play the first chapter →" })
      .getAttribute("href")
      ?.replace(/\/$/, ""),
  ).toBe("/morrowglint/play");
});
test("Chinese brand cards retain the localized title", () => {
  localStorage.setItem("dingn.locale", "zh-CN");
  render(
    <LocaleProvider>
      <MorrowglintFeature />
    </LocaleProvider>,
  );
  expect(screen.getByRole("heading", { name: "拾光幻境" })).toBeTruthy();
});
