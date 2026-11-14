import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Privacy, Terms } from "../src/components/legal";
import { LocaleProvider } from "../src/components/locale";
import zh from "../src/data/zh-CN.json";

afterEach(() => {
  cleanup();
  history.replaceState({}, "", "/");
});

it("shows the refund policy in the terms", () => {
  render(<Terms />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Terms of use" }),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Refunds" })).toBeTruthy();
  expect(screen.getByText(/within 14 days/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Contact us" }).getAttribute("href"),
  ).toMatch(/^\/feedback\/?$/);
});

it("translates every line of both pages into Simplified Chinese", () => {
  history.replaceState({}, "", "/zh/terms/");
  const view = render(
    <LocaleProvider>
      <Terms />
      <Privacy />
    </LocaleProvider>,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "使用条款" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { level: 1, name: "隐私政策" }),
  ).toBeTruthy();
  const english = Object.keys(zh as Record<string, string>);
  for (const node of view.container.querySelectorAll("li, h2, p"))
    expect(english).not.toContain(node.textContent);
});
