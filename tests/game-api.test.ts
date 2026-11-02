import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { gameRoutes, handleGameApi } from "../scripts/game-api.mjs";

const origin = "http://127.0.0.1:3001";
function call(
  method: string,
  path: string,
  headers: Record<string, string> = {},
) {
  const req = Object.assign(new EventEmitter(), { method, headers });
  let status = 0,
    body = "";
  const res = {
    setHeader: () => {},
    writeHead: (s: number) => (status = s),
    end: (b: string) => (body = b),
  };
  return handleGameApi(req, res, path).then((handled) => ({
    handled,
    status,
    body: body ? JSON.parse(body) : null,
  }));
}
const json = {
  origin,
  "x-dingn-request": "1",
  "content-type": "application/json",
};

test("XP routes are POST-only, CSRF-checked and need a session", async () => {
  assert.deepEqual(gameRoutes.sort(), [
    "/api/leaderboard",
    "/api/me",
    "/api/play/finish",
    "/api/play/start",
  ]);
  assert.equal((await call("GET", "/logic/")).handled, false);
  assert.equal((await call("POST", "/api/auth/login", json)).handled, false);
  assert.equal((await call("GET", "/api/me", json)).status, 405);
  // Cross-site or header-less requests are refused before anything else.
  assert.equal((await call("POST", "/api/play/finish")).status, 403);
  assert.equal(
    (
      await call("POST", "/api/play/finish", {
        ...json,
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  for (const path of ["/api/play/start", "/api/play/finish", "/api/me"]) {
    const r = await call("POST", path, json);
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "signed_out");
  }
});

test("the runtime image pins the same firebase-admin as development", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = JSON.parse(await readFile("package.json", "utf8"));
  const server = JSON.parse(await readFile("server/package.json", "utf8"));
  assert.equal(
    server.dependencies["firebase-admin"],
    root.dependencies["firebase-admin"],
  );
});
