// The kingdom's pages from the live plugin version: dingn draws them into an
// element with plain values, or its built-in copy when none is live.
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { KingdomCard, KingdomVisit } from "../src/components/kingdom";

const mocks = vi.hoisted(() => ({
  loadKingdomUi: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../src/lib/reward-plugin", async (real) => ({
  ...(await real<typeof import("../src/lib/reward-plugin")>()),
  loadKingdomUi: mocks.loadKingdomUi,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/account/",
}));
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: { uid: "ada" }, ready: true }),
}));
vi.mock("kingdom/scene", () => ({
  KingdomScene: class {},
  webglAvailable: () => false,
}));

const plugin = {
  version: "0.3.0",
  base: "/rewards/kingdom/0.3.0/",
  rules: "/rewards/kingdom/0.3.0/rules.mjs",
  ui: "/rewards/kingdom/0.3.0/ui.js",
  css: "/rewards/kingdom/0.3.0/kingdom.css",
  assets: "/rewards/kingdom/0.3.0/assets/kingdom/",
};

beforeEach(() => {
  mocks.loadKingdomUi.mockReset();
  mocks.push.mockReset();
});
afterEach(cleanup);

it("draws the live plugin's card into an element, with plain values", async () => {
  const unmount = vi.fn();
  const mountKingdomCard = vi.fn((element: Element) => {
    element.textContent = "plugin card";
    return { update: vi.fn(), unmount };
  });
  mocks.loadKingdomUi.mockResolvedValue({
    ui: {
      mountKingdomCard,
      mountKingdomPage: vi.fn(),
      mountKingdomVisit: vi.fn(),
    },
    plugin,
  });
  const view = render(<KingdomCard />);
  expect(await screen.findByText("plugin card")).toBeTruthy();
  const [, props] = mountKingdomCard.mock.calls[0] as unknown as [
    Element,
    { host: Record<string, unknown> & { navigate: (to: string) => void } },
  ];
  expect(props.host.assets).toBe(plugin.assets);
  expect(props.host.coin).toBe("/coin.svg");
  expect(props.host.links).toEqual({
    kingdom: "/kingdom/",
    signIn: "/signin/?next=%2Fkingdom%2F",
    play: "/play/memory/",
  });
  // No React components cross over: the plugin has its own React.
  expect(props.host.Link).toBeUndefined();
  props.host.navigate("/kingdom/");
  expect(mocks.push).toHaveBeenCalledWith("/kingdom/");
  view.unmount();
  await waitFor(() => expect(unmount).toHaveBeenCalled());
});

it("draws the built-in copy when no version is live", async () => {
  mocks.loadKingdomUi.mockResolvedValue(null);
  render(
    <KingdomVisit
      kingdom={{ stage: "camp", size: 5, hall: "camp", tiles: {} } as never}
      label="Ada's kingdom"
    />,
  );
  expect(
    await screen.findByRole("img", { name: "Ada's kingdom" }),
  ).toBeTruthy();
});
