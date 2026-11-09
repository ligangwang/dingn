import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LocaleProvider,
  LanguageSwitcher,
  Text,
} from "../src/components/locale";
import { localeFromPath, localePath, translate } from "../src/lib/i18n";
import { safeDestination } from "../src/lib/models";
import { pageMetadata } from "../src/lib/seo";
import {
  developerRedirect,
  movedPage,
  localizedRedirect,
} from "../scripts/locale-redirect.mjs";
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
    catalog["Round {0} · {1} digits"].replace("{0}", "2").replace("{1}", "4"),
  );
  expect(translate("Remember 0, 0, 7", "zh-CN")).toContain("0, 0, 7");
  expect(translate("Mia's feedback", "zh-CN")).toBe("Mia's feedback");
});
test("explicit language switching persists and moves to the other language's URL", async () => {
  history.replaceState({}, "", "/zh/word/?x=1#top");
  render(
    <LocaleProvider>
      <LanguageSwitcher />
      <Text>Sign in</Text>
    </LocaleProvider>,
  );
  expect(screen.getByText(catalog["Sign in"])).toBeTruthy();
  expect(document.documentElement.lang).toBe("zh-CN");
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "en");
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem("dingn.locale")).toBe("en");
  expect(location.pathname + location.search + location.hash).toBe(
    "/word/?x=1#top",
  );
});
test("old ?lang= links open the Chinese URL and remember the choice", () => {
  history.replaceState({}, "", "/crowd/?lang=zh-CN");
  render(
    <LocaleProvider>
      <Text>Sign in</Text>
    </LocaleProvider>,
  );
  expect(screen.getByText(catalog["Sign in"])).toBeTruthy();
  expect(location.pathname + location.search).toBe("/zh/crowd/");
  expect(localStorage.getItem("dingn.locale")).toBe("zh-CN");
});
test("language paths map between English and /zh/ URLs", () => {
  expect(localePath("/word/", "zh-CN")).toBe("/zh/word/");
  expect(localePath("/", "zh-CN")).toBe("/zh/");
  expect(localePath("/zh/word/", "en")).toBe("/word/");
  expect(localePath("/zh/", "en")).toBe("/");
  expect(localePath("/zh/word/", "zh-CN")).toBe("/zh/word/");
  expect(localePath("/zhuyin/", "en")).toBe("/zhuyin/");
  expect(localeFromPath("/zh/")).toBe("zh-CN");
  expect(localeFromPath("/zhuyin/")).toBe("en");
  expect(safeDestination("/zh/logic/")).toBe("/zh/logic/");
  expect(safeDestination("https://evil.example/", "zh-CN")).toBe("/zh/");
});
test("the server redirects legacy language URLs permanently", () => {
  expect(localizedRedirect("/word/")).toBeNull();
  expect(localizedRedirect("/zh/word/")).toBeNull();
  expect(localizedRedirect("/word/?lang=zh-CN")).toBe("/zh/word/");
  expect(localizedRedirect("/?lang=zh-CN&a=1")).toBe("/zh/?a=1");
  expect(localizedRedirect("/zh/crowd/?lang=en")).toBe("/crowd/");
  expect(localizedRedirect("/zh/?lang=en")).toBe("/");
  expect(localizedRedirect("/account/?purchase=pending&lang=zh-CN")).toBe(
    "/zh/account/?purchase=pending",
  );
  expect(localizedRedirect("/en/word/")).toBe("/word/");
  expect(localizedRedirect("/en")).toBe("/");
});
test("every Chinese page declares its own canonical URL and hreflang alternates", () => {
  const meta = pageMetadata("/logic/", "zh-CN");
  expect(meta.alternates?.canonical).toBe("https://dingn.com/zh/logic/");
  expect(meta.alternates?.languages).toEqual({
    en: "https://dingn.com/logic/",
    "zh-CN": "https://dingn.com/zh/logic/",
    "x-default": "https://dingn.com/logic/",
  });
});

test("Crowd Rush's old addresses move to its game page", () => {
  expect(movedPage("/crowd/")).toBe("/play/crowdrush/");
  expect(movedPage("/crowd")).toBe("/play/crowdrush/");
  expect(movedPage("/zh/crowd/?from=home")).toBe(
    "/zh/play/crowdrush/?from=home",
  );
  expect(movedPage("/pop/")).toBe("/play/crowdrush/");
  expect(movedPage("/play/crowd/")).toBe("/play/crowdrush/");
  expect(movedPage("/play/crowdrush/")).toBeNull();
  expect(movedPage("/crowded/")).toBeNull();
  expect(movedPage("/word/")).toBeNull();
});

test("developer.dingn.com and dev.dingn.com open the developer pages", () => {
  const at = (host: string, url: string, header = "host") =>
    developerRedirect({ [header]: host }, url);
  expect(at("developer.dingn.com", "/")).toBe("https://dingn.com/developers/");
  expect(at("dev.dingn.com", "/playground/")).toBe(
    "https://dingn.com/developers/playground/",
  );
  expect(at("dev.dingn.com", "/zh/games/?x=1")).toBe(
    "https://dingn.com/zh/developers/games/?x=1",
  );
  expect(at("dev.dingn.com", "/zh")).toBe("https://dingn.com/zh/developers/");
  expect(at("developer.dingn.com", "/sdk/v1/dingn-sdk.js")).toBe(
    "https://dingn.com/sdk/v1/dingn-sdk.js",
  );
  expect(at("developer.dingn.com", "/developers")).toBe(
    "https://dingn.com/developers",
  );
  // A proxy in front sends the visitor's host in X-Forwarded-Host.
  expect(at("Developer.dingn.com", "/", "x-forwarded-host")).toBe(
    "https://dingn.com/developers/",
  );
  expect(at("dingn.com", "/")).toBeNull();
  expect(at("dingn-web-hlue2fivja-uc.a.run.app", "/")).toBeNull();
});
