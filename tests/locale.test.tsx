import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LocaleProvider,
  LanguageSwitcher,
  Text,
} from "../src/components/locale";
import { translate } from "../src/lib/i18n";
import games from "../src/data/mind-games.json";
import catalog from "../src/data/zh-CN.json";
afterEach(() => {
  cleanup();
  localStorage.clear();
  history.replaceState({}, "", "/");
});
test("all authored game questions, explanations and word choices have Chinese translations", () => {
  for (const rounds of Object.values(games))
    for (const game of rounds) {
      for (const text of [game.title, game.prompt, game.why, ...game.options]) {
        if (/[a-z]/i.test(text)) expect(catalog).toHaveProperty(text);
      }
    }
});
test("specific sentence templates take priority over generic digit templates", () => {
  expect(translate("Round 2 · 4 digits", "zh-CN")).toBe(
    catalog["Round {0} · {1} digits"]
      .replace("{0}", "2")
      .replace("{1}", "4"),
  );
  expect(translate("Remember 0, 0, 7", "zh-CN")).toContain("0, 0, 7");
  expect(translate("Mia's feedback", "zh-CN")).toBe("Mia's feedback");
});
test("explicit language switching persists and updates URL and document language", async () => {
  history.replaceState({}, "", "/?lang=zh-CN");
  render(
    <LocaleProvider>
      <LanguageSwitcher />
      <Text>Sign in</Text>
    </LocaleProvider>,
  );
  expect(screen.getByText(catalog["Sign in"])).toBeTruthy();
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "en");
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem("dingn.locale")).toBe("en");
  expect(location.search).toBe("?lang=en");
});
