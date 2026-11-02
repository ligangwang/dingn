import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleApi } from "../scripts/api.mjs";
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});
async function request(path, body = {}, headers = {}, method = "POST") {
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url: path,
    socket: { remoteAddress: "test" },
    headers: {
      origin: "http://127.0.0.1:3001",
      "content-type": "application/json",
      "x-dingn-request": "1",
      ...headers,
    },
  });
  const result = { status: 200, headers: {}, body: null };
  const res = {
    setHeader: (k, v) => {
      result.headers[k] = v;
    },
    set statusCode(v) {
      result.status = v;
    },
    end: (v) => {
      result.body = JSON.parse(v);
    },
  };
  await handleApi(req, res);
  return result;
}
function stub(responses) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const next = responses.shift();
    assert.ok(next, "unexpected upstream request");
    return {
      ok: !next.status,
      status: next.status || 200,
      json: async () => next.data,
    };
  };
  return calls;
}
const idToken = `header.${Buffer.from(JSON.stringify({ admin: false })).toString("base64url")}.signature`;
test("password sign-in exchanges credentials only on server and stores refresh token in HttpOnly cookie", async () => {
  const calls = stub([
    { data: { idToken, refreshToken: "private-refresh" } },
    { data: { users: [{ localId: "u1", email: "me@example.com" }] } },
  ]);
  const result = await request("/api/auth/login", {
    email: "me@example.com",
    password: "secret-password",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.uid, "u1");
  assert.match(result.headers["Set-Cookie"], /HttpOnly; SameSite=Lax/);
  assert.match(result.headers["Set-Cookie"], /private-refresh/);
  assert.equal(JSON.stringify(result.body).includes("private-refresh"), false);
  assert.equal(JSON.stringify(result.body).includes(idToken), false);
  assert.match(calls[0].url, /^https:\/\/identitytoolkit.googleapis.com/);
});
test("rejects cross-origin, simple-form and non-POST requests before contacting upstream", async () => {
  const calls = stub([]);
  assert.equal(
    (await request("/api/auth/login", {}, { origin: "https://evil.example" }))
      .status,
    403,
  );
  assert.equal(
    (await request("/api/auth/login", {}, { "x-dingn-request": "" })).status,
    403,
  );
  assert.equal((await request("/api/auth/logout", {}, {}, "GET")).status, 405);
  assert.equal(calls.length, 0);
});
test("anonymous session does not contact Google; data requires a session", async () => {
  const calls = stub([]);
  assert.equal((await request("/api/auth/session")).body, null);
  assert.equal(
    (
      await request("/api/data", {
        operation: "get",
        collection: "accounts",
        id: "u1",
      })
    ).status,
    401,
  );
  assert.equal(calls.length, 0);
});
test("refreshes server-side and forwards user identity so Firestore rules reject unauthorized reads", async () => {
  const calls = stub([
    { data: { id_token: "fresh-id", refresh_token: "rotated" } },
    { status: 403, data: { error: { message: "PERMISSION_DENIED" } } },
  ]);
  const result = await request(
    "/api/data",
    { operation: "get", collection: "feedback", id: "private" },
    { cookie: "dingn-session=old" },
  );
  assert.equal(result.status, 403);
  assert.equal(calls[1].headers.Authorization, "Bearer fresh-id");
  assert.match(calls[0].url, /^https:\/\/securetoken.googleapis.com/);
});
test("expired sessions clear cookie and hide upstream details", async () => {
  stub([
    {
      status: 400,
      data: { error: { message: "TOKEN_EXPIRED sensitive detail" } },
    },
  ]);
  const result = await request(
    "/api/auth/session",
    {},
    { cookie: "dingn-session=expired" },
  );
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid-credential");
  assert.match(result.headers["Set-Cookie"], /Max-Age=0/);
});
test("logout clears local session without a Google request", async () => {
  const calls = stub([]);
  const result = await request(
    "/api/auth/logout",
    {},
    { cookie: "dingn-session=valid" },
  );
  assert.match(result.headers["Set-Cookie"], /Max-Age=0/);
  assert.equal(calls.length, 0);
});
test("feedback uses server timestamp transform and cannot choose upstream host", async () => {
  const calls = stub([
    { data: { id_token: "fresh", refresh_token: "token" } },
    { data: {} },
  ]);
  await request(
    "/api/data",
    {
      operation: "add",
      collection: "feedback",
      fields: {
        uid: { stringValue: "u1" },
        createdAt: { serverTimestamp: true },
      },
    },
    { cookie: "dingn-session=token" },
  );
  const write = JSON.parse(calls[1].body).writes[0];
  assert.deepEqual(write.updateTransforms, [
    { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
  ]);
  assert.deepEqual(write.currentDocument, { exists: false });
  assert.equal(write.update.fields.createdAt, undefined);
});
