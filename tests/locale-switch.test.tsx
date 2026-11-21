import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LanguageSwitcher,
  LocaleProvider,
  Text,
} from "../src/components/locale";
import es from "../locales/es.json";

// The router's view of the address, which catches up after a switch.
const nav = vi.hoisted(() => ({ path: "/es/casual/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  history.replaceState({}, "", "/");
});

test("switching away from a language page holds once the router catches up", async () => {
  history.replaceState({}, "", "/es/casual/");
  // A new element each time, so React renders the provider again.
  const page = () => (
    <LocaleProvider locale="es" strings={es.strings}>
      <LanguageSwitcher />
      <Text>Sign in</Text>
    </LocaleProvider>
  );
  const { rerender } = render(page());
  expect(screen.getByText(es.strings["Sign in"])).toBeTruthy();
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "en");
  expect(location.pathname).toBe("/casual/");
  expect(screen.getByText("Sign in")).toBeTruthy();
  // The router now reports the new address: still English.
  nav.path = "/casual/";
  rerender(page());
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});
