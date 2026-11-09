import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeveloperGames } from "../src/components/developer-games";
import { GameHost } from "../src/components/game-host";
import type { DeveloperGame } from "../src/lib/developer-games";

const mocks = vi.hoisted(() => ({
  session: { user: { uid: "ada" } as { uid: string } | null, ready: true },
  listMyGames: vi.fn(),
  uploadGame: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
  useOptionalSession: () => null,
}));
vi.mock("../src/lib/developer-games", () => ({
  listMyGames: mocks.listMyGames,
  uploadGame: mocks.uploadGame,
}));

const title = { en: "Sky Hop", zh: "跳跳云" };
const skyhop: DeveloperGame = {
  id: "skyhop",
  status: "unlisted",
  live: "1.0.0",
  beta: "1.1.0",
  versions: [
    { version: "1.1.0", title, publishedAt: null, reviewed: false },
    { version: "1.0.0", title, publishedAt: null, reviewed: true },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session = { user: { uid: "ada" }, ready: true };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("asks visitors to sign in and uninvited accounts to get in touch", async () => {
  mocks.session.user = null;
  const view = render(<DeveloperGames />);
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  expect(mocks.listMyGames).not.toHaveBeenCalled();
  view.unmount();

  mocks.session.user = { uid: "eve" };
  mocks.listMyGames.mockResolvedValue({ developer: false, games: [] });
  render(<DeveloperGames />);
  expect(await screen.findByText(/open to invited developers/)).toBeTruthy();
  expect(screen.queryByLabelText("Game zip")).toBeNull();
});

it("uploads a zip and shows its review status", async () => {
  const user = userEvent.setup();
  mocks.listMyGames.mockResolvedValue({ developer: true, games: [] });
  mocks.uploadGame
    .mockRejectedValueOnce(
      Object.assign(new Error("invalid-manifest"), {
        code: "invalid-manifest",
        detail: "version must look like 1.2.3",
      }),
    )
    .mockResolvedValueOnce({
      game: skyhop,
      version: "1.1.0",
      play: "/play/skyhop/?v=1.1.0",
    });
  render(<DeveloperGames />);
  expect(
    await screen.findByText("You have not uploaded a game yet."),
  ).toBeTruthy();
  const upload = screen.getByRole("button", { name: "Upload" });
  expect((upload as HTMLButtonElement).disabled).toBe(true);
  const zip = new File(["zip"], "skyhop.zip", { type: "application/zip" });
  await user.upload(screen.getByLabelText("Game zip"), zip);

  await user.click(upload);
  expect(screen.getByRole("alert").textContent).toBe(
    "game.json needs fixing: version must look like 1.2.3",
  );

  await user.click(upload);
  expect(mocks.uploadGame).toHaveBeenLastCalledWith(zip);
  const done = await screen.findByText(/Uploaded Sky Hop 1\.1\.0\./);
  expect(
    within(done).getByRole("link", { name: "Try it" }).getAttribute("href"),
  ).toBe("/play/skyhop/?v=1.1.0");
  const rows = within(
    screen.getByRole("region", { name: /Sky Hop/ }),
  ).getAllByRole("row");
  expect(rows[1].textContent).toContain("Waiting for review");
  expect(rows[2].textContent).toContain("Live");
});

it("marks a developer's unreviewed version on the player page", async () => {
  history.replaceState({}, "", "/play/skyhop/?v=beta");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "skyhop",
        version: "1.1.0",
        title,
        description: { en: "", zh: "" },
        entry: "index.html",
        url: "/g/skyhop/1.1.0/index.html",
        preview: true,
      }),
    ),
  );
  render(<GameHost />);
  expect((await screen.findByRole("note")).textContent).toMatch(
    /has not reviewed it yet/,
  );
  history.replaceState({}, "", "/");
});
