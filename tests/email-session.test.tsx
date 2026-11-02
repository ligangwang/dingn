import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession } from "../src/components/session";
import { readNumbers } from "../src/lib/repository";
vi.mock("../src/lib/firebase", () => {
  throw new Error("Email flow must never load Firebase SDK");
});
vi.mock("firebase/auth", () => {
  throw new Error("Email flow must never load Google auth");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Probe() {
  const session = useSession();
  return (
    <>
      <span>
        {session.ready ? session.user?.email || "signed out" : "loading"}
      </span>
      <button
        onClick={() =>
          void session.loginEmail(
            "player@example.com",
            "example-password",
            false,
          )
        }
      >
        Email login
      </button>
      <button onClick={() => void readNumbers(2)}>Load game</button>
      <button onClick={() => void session.logout()}>Logout</button>
    </>
  );
}
it("email login, session restore, profile and games use only same-origin requests and never initialize Google SDK", async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      requests.push(url);
      expect(url.startsWith("/api/")).toBe(true);
      expect(options.credentials).toBe("same-origin");
      const body = JSON.parse(options.body as string);
      const data = url.endsWith("session")
        ? null
        : url.endsWith("login")
          ? { uid: "u1", email: "player@example.com", isAdmin: false }
          : url === "/api/data"
            ? body.operation === "query"
              ? []
              : null
            : {};
      return { ok: true, json: async () => data };
    }),
  );
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText("signed out");
  await userEvent.click(screen.getByText("Email login"));
  await screen.findByText("player@example.com");
  await userEvent.click(screen.getByText("Load game"));
  await userEvent.click(screen.getByText("Logout"));
  await screen.findByText("signed out");
  // The XP stats load (/api/me) runs alongside the profile read after login.
  expect(requests.filter((r) => r === "/api/me")).toHaveLength(1);
  expect(requests.filter((r) => r !== "/api/me")).toEqual([
    "/api/auth/session",
    "/api/auth/login",
    "/api/data",
    "/api/data",
    "/api/auth/logout",
  ]);
});
