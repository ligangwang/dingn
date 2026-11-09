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
  joinDevelopers: vi.fn(),
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
  useOptionalSession: () => null,
}));
vi.mock("../src/lib/developer-games", () => ({
  listMyGames: mocks.listMyGames,
  uploadGame: mocks.uploadGame,
  joinDevelopers: mocks.joinDevelopers,
}));

const title = { en: "Sky Hop", zh: "跳跳云" };
const skyhop: DeveloperGame = {
  id: "skyhop",
  status: "unlisted",
  removedReason: null,
  plays: { total: 40, week: 7, month: 30 },
  live: "1.0.0",
  beta: "1.1.0",
  versions: [
    {
      version: "1.1.0",
      title,
      publishedAt: null,
      reviewed: false,
      rejected: null,
    },
    {
      version: "1.0.0",
      title,
      publishedAt: null,
      reviewed: true,
      rejected: null,
    },
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

it("asks visitors to sign in, and others to accept the agreement", async () => {
  mocks.session.user = null;
  const view = render(<DeveloperGames />);
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  expect(mocks.listMyGames).not.toHaveBeenCalled();
  view.unmount();

  mocks.session.user = { uid: "eve" };
  mocks.listMyGames
    .mockResolvedValueOnce({
      developer: false,
      emailVerified: true,
      agreement: "2026-11-09",
      games: [],
    })
    .mockResolvedValueOnce({
      developer: true,
      agreement: "2026-11-09",
      games: [],
    });
  mocks.joinDevelopers.mockResolvedValue({ developer: true });
  render(<DeveloperGames />);
  const signUp = await screen.findByRole("button", {
    name: "Sign up as a developer",
  });
  expect(screen.queryByLabelText("Game zip")).toBeNull();
  expect((signUp as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen
      .getByRole("link", { name: "developer agreement" })
      .getAttribute("href"),
  ).toMatch(/^\/developers\/agreement\/?$/);
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(signUp);
  expect(mocks.joinDevelopers).toHaveBeenCalledWith("2026-11-09");
  expect(await screen.findByLabelText("Game zip")).toBeTruthy();
});

it("explains when an account cannot sign up", async () => {
  mocks.listMyGames.mockResolvedValue({
    developer: false,
    blocked: true,
    agreement: "2026-11-09",
    games: [],
  });
  const view = render(<DeveloperGames />);
  expect(await screen.findByText(/can no longer upload games/)).toBeTruthy();
  view.unmount();
  mocks.listMyGames.mockResolvedValue({
    developer: false,
    emailVerified: false,
    agreement: "2026-11-09",
    games: [],
  });
  render(<DeveloperGames />);
  expect(await screen.findByText(/email is verified/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Sign up as a developer" }),
  ).toBeNull();
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
  expect(screen.getByText(/Plays: 7 this week/)).toBeTruthy();
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

it("lets signed-in players report a game", async () => {
  history.replaceState({}, "", "/play/skyhop/");
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).startsWith("/api/games/")
            ? {
                id: "skyhop",
                version: "1.0.0",
                title,
                description: { en: "", zh: "" },
                entry: "index.html",
                url: "/g/skyhop/1.0.0/index.html",
              }
            : { ok: true },
        ),
      ),
  );
  render(<GameHost />);
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Report a problem with this game",
    }),
  );
  // useOptionalSession is mocked as signed out.
  expect(screen.getByText("Sign in to report a game.")).toBeTruthy();
  const plays = fetch.mock.calls.filter(([url]) => url === "/api/game-plays");
  expect(plays.length).toBe(1);
  expect(JSON.parse(String(plays[0][1]?.body))).toEqual({
    id: "skyhop",
    version: "1.0.0",
  });
  history.replaceState({}, "", "/");
});
