import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Developers } from "../src/components/developers";
import { DevPlayground, gameAddress } from "../src/components/dev-playground";
import { LocaleProvider } from "../src/components/locale";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  history.replaceState({}, "", "/");
});

it("links the guide to the starter, the type definitions and the playground", () => {
  render(<Developers />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Make a game for dingn" }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Download the starter game" })
      .getAttribute("href"),
  ).toBe("/sdk/v1/starter.zip");
  expect(
    screen.getByRole("link", { name: "dingn-sdk.d.ts" }).getAttribute("href"),
  ).toBe("/sdk/v1/dingn-sdk.d.ts");
  expect(
    screen
      .getByRole("link", { name: "Open the playground" })
      .getAttribute("href"),
  ).toMatch(/^\/developers\/playground\/?$/);
  expect(
    screen.getByText(/https:\/\/dingn\.com\/sdk\/v1\/dingn-sdk\.js/),
  ).toBeTruthy();
  expect(screen.getByText(/dingn\.challengeResult\(score\)/)).toBeTruthy();
});

it("is translated into Simplified Chinese", () => {
  history.replaceState({}, "", "/zh/developers/");
  render(
    <LocaleProvider>
      <Developers />
    </LocaleProvider>,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "为 dingn 制作游戏" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "打开试玩场" }).getAttribute("href"),
  ).toMatch(/^\/zh\/developers\/playground\/?$/);
  expect(screen.getByRole("heading", { name: "沙盒规则" })).toBeTruthy();
});

it("accepts only http and https game addresses", () => {
  expect(gameAddress(" http://localhost:5173 ")).toBe("http://localhost:5173/");
  expect(gameAddress("https://example.com/game/")).toBe(
    "https://example.com/game/",
  );
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "localhost",
    "",
  ])
    expect(gameAddress(bad)).toBeNull();
});

/** Sends an SDK request from the game frame and waits for the reply. */
async function ask(
  frame: HTMLIFrameElement,
  replies: unknown[],
  method: string,
  params?: Record<string, unknown>,
) {
  const id = replies.length + 100;
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { dingn: "game", v: 1, id, method, params },
        source: frame.contentWindow,
      }),
    );
  });
  let reply: unknown;
  await waitFor(() => {
    reply = replies.find((r) => (r as { id?: number }).id === id);
    expect(reply).toBeTruthy();
  });
  return reply as { result?: unknown; error?: { code: string } };
}

function currentFrame() {
  const frame = screen.getByTitle("Your game") as HTMLIFrameElement;
  const replies: unknown[] = [];
  vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
    (message: unknown) => void replies.push(message),
  );
  return {
    frame,
    request: (method: string, params?: Record<string, unknown>) =>
      ask(frame, replies, method, params),
  };
}

it("runs a game with a test player and logs every SDK call", async () => {
  const user = userEvent.setup();
  render(<DevPlayground />);
  const address = screen.getByLabelText("Game address");
  await user.clear(address);
  await user.type(address, "not a url");
  await user.click(screen.getByRole("button", { name: "Load" }));
  expect(screen.getByRole("alert").textContent).toMatch(/http:\/\//);

  await user.clear(address);
  await user.type(address, "http://localhost:5173/");
  await user.click(screen.getByRole("button", { name: "Load" }));
  expect(localStorage.getItem("dingn.playground.address")).toBe(
    "http://localhost:5173/",
  );
  const frame = screen.getByTitle("Your game") as HTMLIFrameElement;
  expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  const replies: unknown[] = [];
  vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
    (message: unknown) => void replies.push(message),
  );

  const init = await ask(frame, replies, "init");
  expect(init.result).toMatchObject({
    gameId: "playground",
    locale: "en",
    player: { signedIn: false },
  });
  await ask(frame, replies, "storage.set", { key: "best", value: 7 });
  expect(
    (await ask(frame, replies, "storage.get", { key: "best" })).result,
  ).toBe(7);
  expect(
    (await ask(frame, replies, "progress.save", { data: { level: 2 } })).error
      ?.code,
  ).toBe("signed_out");

  // Signing the test player in tells the game and allows progress.
  await user.click(screen.getByLabelText("Test player signed in"));
  await waitFor(() =>
    expect(replies).toContainEqual(
      expect.objectContaining({
        event: "player",
        data: expect.objectContaining({ signedIn: true, name: "Test player" }),
      }),
    ),
  );
  await ask(frame, replies, "progress.save", { data: { level: 2 } });
  expect((await ask(frame, replies, "progress.load")).result).toEqual({
    level: 2,
  });

  const log = within(screen.getByRole("region", { name: "SDK calls" }));
  expect(log.getByText('storage.set("best", 7)')).toBeTruthy();
  expect(log.getByText(/^signed_out:/)).toBeTruthy();
});

it("replays a challenge through the SDK bridge without posting to dingn", async () => {
  const user = userEvent.setup();
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<DevPlayground />);
  const replay = screen.getByRole("button", { name: "Replay last challenge" });
  expect((replay as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Load" }));

  const original = currentFrame();
  expect(
    (await original.request("challenge.result", { score: 5 })).error?.code,
  ).toBe("no_challenge");
  const round = {
    mode: "tap",
    seed: "day-1",
    rules: "standard",
    score: 5,
    unit: "points",
  };
  expect((await original.request("challenge.link", round)).error?.code).toBe(
    "unpublished_game",
  );

  await user.click(replay);
  const played = currentFrame();
  expect(played.frame).not.toBe(original.frame);
  expect((await played.request("init")).result).toMatchObject({
    challenge: round,
  });
  expect((await played.request("challenge.result", { score: 5 })).result).toEqual({
    beat: false,
    posted: false,
    best: 5,
    rank: null,
    players: 1,
    test: true,
  });

  await user.click(screen.getByLabelText("Test player signed in"));
  expect((await played.request("challenge.result", { score: 6 })).result).toEqual({
    beat: true,
    posted: false,
    best: 6,
    rank: 1,
    players: 2,
    test: true,
  });

  await user.click(screen.getByRole("button", { name: "Exit challenge" }));
  expect((await currentFrame().request("init")).result).toMatchObject({
    challenge: null,
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("creates a live game's share link with the ID from the challenge API", async () => {
  const entry = "/g/skyhop/1.0.0/index.html";
  const fetch = vi.spyOn(globalThis, "fetch");
  const game = () => Response.json({ id: "skyhop", url: entry });
  fetch
    .mockResolvedValueOnce(game())
    .mockResolvedValueOnce(Response.json({ id: "Xq3v9TzK1bWm" }))
    .mockResolvedValueOnce(game())
    .mockResolvedValueOnce(
      Response.json({ error: "unavailable" }, { status: 503 }),
    )
    .mockResolvedValueOnce(game())
    .mockResolvedValueOnce(Response.json({ id: "invalid-id" }))
    .mockResolvedValueOnce(
      Response.json({ id: "skyhop", url: "/g/skyhop/1.1.0/index.html" }),
    );

  localStorage.setItem(
    "dingn.playground.address",
    `${location.origin}${entry}`,
  );
  render(<DevPlayground />);
  await userEvent.click(screen.getByRole("button", { name: "Load" }));
  const { request } = currentFrame();
  const round = {
    mode: "run",
    seed: "day-1",
    score: 42,
    unit: "points",
    rules: "standard",
  };

  expect((await request("challenge.link", round)).result).toBe(
    `${location.origin}/play/skyhop/?c=Xq3v9TzK1bWm`,
  );
  expect(fetch).toHaveBeenNthCalledWith(1, "/api/games/skyhop");
  expect(fetch).toHaveBeenNthCalledWith(2, "/api/challenges", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Dingn-Request": "1" },
    body: JSON.stringify({ ...round, game: "skyhop" }),
  });
  for (const code of ["unavailable", "unavailable", "unpublished_game"]) {
    expect((await request("challenge.link", round)).error?.code).toBe(code);
  }
  expect(fetch).toHaveBeenCalledTimes(7);
});
