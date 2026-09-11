import { beforeEach, expect, test } from "vitest";
import {
  analyticsPage,
  syncAnalytics,
  measurementId,
  clearAnalyticsCookies,
} from "../src/lib/analytics";

const state = window as unknown as Record<string, any>;
const commands = () =>
  (state.dataLayer || []).map((entry: ArrayLike<unknown>) => Array.from(entry));
const views = () =>
  commands().filter(
    (entry: unknown[]) => entry[0] === "event" && entry[1] === "page_view",
  );
beforeEach(() => {
  for (const key of [
    "gtag",
    "dataLayer",
    "dingnAnalyticsStarted",
    "dingnAnalyticsPage",
    `ga-disable-${measurementId}`,
  ])
    delete state[key];
  document.getElementById("dingn-google-analytics")?.remove();
});
test("no tag or events before permission, on previews, or on private pages", () => {
  for (const consent of [null, "denied"] as const)
    syncAnalytics(consent, "/", "dingn.com");
  syncAnalytics("granted", "/", "localhost");
  syncAnalytics("granted", "/", "dingn-web.run.app");
  syncAnalytics("granted", "/admin/feedback/", "dingn.com");
  syncAnalytics("granted", "/account/", "dingn.com");
  expect(document.getElementById("dingn-google-analytics")).toBeNull();
  expect(commands()).toEqual([]);
});
test("tracks one sanitized view per route and disables automatic page views", () => {
  syncAnalytics("granted", "/?email=private@example.com", "dingn.com");
  syncAnalytics("granted", "/word?search=secret#private", "dingn.com");
  syncAnalytics("granted", "/word/", "dingn.com");
  expect(views()).toHaveLength(2);
  expect(views()[1][2]).toMatchObject({
    page_location: "https://dingn.com/word/",
    page_title: "Words",
    page_referrer: "https://dingn.com/",
  });
  expect(JSON.stringify(commands())).not.toMatch(/private|secret/);
  expect(
    commands().find((entry: unknown[]) => entry[0] === "config")?.[2],
  ).toMatchObject({ send_page_view: false, allow_google_signals: false });
  expect(document.querySelectorAll("#dingn-google-analytics")).toHaveLength(1);
});
test("revocation stops collection and re-grant resumes without adding a second tag", () => {
  syncAnalytics("granted", "/", "dingn.com");
  syncAnalytics("denied", "/word/", "dingn.com");
  expect(state[`ga-disable-${measurementId}`]).toBe(true);
  expect(views()).toHaveLength(1);
  syncAnalytics("granted", "/word/", "dingn.com");
  expect(state[`ga-disable-${measurementId}`]).toBe(false);
  expect(views()).toHaveLength(2);
  expect(document.querySelectorAll("#dingn-google-analytics")).toHaveLength(1);
  syncAnalytics("granted", "/admin/feedback/", "dingn.com");
  expect(state[`ga-disable-${measurementId}`]).toBe(true);
  expect(views()).toHaveLength(2);
});
test("clears Analytics cookies while preserving other cookies", () => {
  document.cookie = "_ga=test; path=/";
  document.cookie = "_ga_QDV6QLR932=test; path=/";
  document.cookie = "preference=keep; path=/";
  clearAnalyticsCookies();
  expect(document.cookie).not.toContain("_ga");
  expect(document.cookie).toContain("preference=keep");
  expect(analyticsPage("/unknown/")).toBeNull();
});
