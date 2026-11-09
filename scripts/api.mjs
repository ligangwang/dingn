import { randomUUID } from "node:crypto";
const key =
  process.env.FIREBASE_API_KEY || "AIzaSyDzWk1JfjsMi9o_yPBz69XSQmWBXfC8dWs";
const project = "dingn-193716";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const secure = process.env.NODE_ENV === "production";
const cookieName = secure ? "__Host-dingn-session" : "dingn-session";
const buckets = new Map();
export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
async function upstream(url, body, token, method = "POST") {
  const response = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.error?.message || "unavailable";
    if (response.status === 404) throw new ApiError(404, "not-found");
    if (response.status === 429 || message.includes("TOO_MANY"))
      throw new ApiError(429, "too-many-requests");
    if (response.status === 403) throw new ApiError(403, "permission-denied");
    if (/INVALID_|USER_DISABLED|TOKEN_EXPIRED|EMAIL_NOT_FOUND/.test(message))
      throw new ApiError(401, "invalid-credential");
    if (message.includes("EMAIL_EXISTS"))
      throw new ApiError(400, "email-already-in-use");
    if (message.includes("WEAK_PASSWORD"))
      throw new ApiError(400, "weak-password");
    throw new ApiError(502, "unavailable");
  }
  return data;
}
function cookie(res, token = "") {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 604800 : 0}${secure ? "; Secure" : ""}`,
  );
}
function readCookie(req) {
  const value = (req.headers.cookie || "")
    .split(";")
    .find((v) => v.trim().startsWith(cookieName + "="));
  try {
    return value
      ? decodeURIComponent(value.trim().slice(cookieName.length + 1))
      : "";
  } catch {
    return "";
  }
}
export async function refresh(req, res) {
  const token = readCookie(req);
  if (!token) throw new ApiError(401, "sign-in-required");
  try {
    const result = await upstream(
      `https://securetoken.googleapis.com/v1/token?key=${key}`,
      { grant_type: "refresh_token", refresh_token: token },
    );
    cookie(res, result.refresh_token);
    return result.id_token;
  } catch (e) {
    if (e.status === 401) cookie(res);
    throw e;
  }
}
async function identity(token) {
  const result = await upstream(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
    { idToken: token },
  );
  const user = result.users?.[0];
  if (!user || user.disabled) throw new ApiError(401, "invalid-credential");
  // Claims are read only after Google's lookup has validated this token.
  const claims = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  return {
    uid: user.localId,
    email: user.email || null,
    displayName: user.displayName || null,
    // Google (or another provider) profile photo, used as the default avatar.
    photoURL:
      typeof user.photoUrl === "string" && user.photoUrl.startsWith("https://")
        ? user.photoUrl
        : null,
    isAdmin: claims.admin === true,
  };
}
export async function readBody(req) {
  let body = "";
  for await (const part of req) {
    body += part;
    if (Buffer.byteLength(body) > 65536)
      throw new ApiError(413, "request-too-large");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new ApiError(400, "invalid-request");
  }
}
export function validateOrigin(req, contentType = "application/json") {
  const allowed = secure
    ? [
        "https://dingn.com",
        "https://www.dingn.com",
        "https://dingn-web-211238433635.us-central1.run.app",
        "https://dingn-web-hlue2fivja-uc.a.run.app",
      ]
    : ["http://127.0.0.1:3001", "http://localhost:3001"];
  if (
    !allowed.includes(req.headers.origin) ||
    req.headers["x-dingn-request"] !== "1" ||
    !req.headers["content-type"]?.startsWith(contentType)
  )
    throw new ApiError(403, "invalid-origin");
}
export function throttle(req) {
  const now = Date.now();
  // Per-instance burst protection (Cloud Run may share a proxy address), in addition to Firebase account/project quotas.
  const ip = req.socket.remoteAddress || "unknown";
  for (const [id, bucket] of buckets)
    if (bucket.until < now) buckets.delete(id);
  const bucket = buckets.get(ip) || { count: 0, until: now + 60000 };
  if (++bucket.count > 300) throw new ApiError(429, "too-many-requests");
  buckets.set(ip, bucket);
}
export async function handleApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    const route = new URL(req.url, "http://localhost").pathname;
    const body = await readBody(req);
    let data;
    if (route === "/api/auth/logout") {
      cookie(res);
      data = {};
    } else if (route === "/api/auth/login" || route === "/api/auth/signup") {
      throttle(req);
      if (
        typeof body.email !== "string" ||
        body.email.length > 254 ||
        typeof body.password !== "string" ||
        body.password.length > 4096 ||
        !body.password
      )
        throw new ApiError(400, "invalid-request");
      const action = route.endsWith("signup") ? "signUp" : "signInWithPassword";
      if (action === "signUp" && body.password.length < 8)
        throw new ApiError(400, "weak-password");
      const result = await upstream(
        `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${key}`,
        {
          email: body.email.trim(),
          password: body.password,
          returnSecureToken: true,
        },
      );
      data = await identity(result.idToken);
      cookie(res, result.refreshToken);
    } else if (route === "/api/auth/google") {
      throttle(req);
      if (
        typeof body.refreshToken !== "string" ||
        body.refreshToken.length > 4096
      )
        throw new ApiError(400, "invalid-request");
      const result = await upstream(
        `https://securetoken.googleapis.com/v1/token?key=${key}`,
        { grant_type: "refresh_token", refresh_token: body.refreshToken },
      );
      data = await identity(result.id_token);
      cookie(res, result.refresh_token);
    } else if (route === "/api/auth/session") {
      data = readCookie(req) ? await identity(await refresh(req, res)) : null;
    } else if (route === "/api/data") {
      const token = await refresh(req, res);
      // Fixed upstream, user ID token (never service-account credentials): Firestore rules still enforce access.
      const { operation, collection, id } = body;
      if (
        ![
          "accounts",
          "numbers",
          "words",
          "number_favorites",
          "feedback",
        ].includes(collection)
      )
        throw new ApiError(400, "invalid-request");
      if (operation === "query") {
        if (
          !body.query ||
          body.query.from?.length !== 1 ||
          body.query.from[0].collectionId !== collection ||
          body.query.from[0].allDescendants ||
          !(body.query.limit > 0 && body.query.limit <= 25)
        )
          throw new ApiError(400, "invalid-request");
        data = await upstream(
          base + ":runQuery",
          { structuredQuery: body.query },
          token,
        );
      } else {
        if (
          operation !== "add" &&
          (typeof id !== "string" ||
            !id ||
            id.includes("/") ||
            id === "." ||
            id === "..")
        )
          throw new ApiError(400, "invalid-request");
        const document = `${base}/${collection}/${encodeURIComponent(id || randomUUID())}`;
        if (operation === "get") {
          try {
            data = await upstream(document, undefined, token, "GET");
          } catch (e) {
            if (e.status === 404) data = null;
            else throw e;
          }
        } else if (operation === "set" || operation === "add") {
          const fields = body.fields;
          if (!fields || typeof fields !== "object")
            throw new ApiError(400, "invalid-request");
          const transforms = [];
          for (const [field, value] of Object.entries(fields)) {
            if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(field))
              throw new ApiError(400, "invalid-request");
            if (value?.serverTimestamp) {
              delete fields[field];
              transforms.push({
                fieldPath: field,
                setToServerValue: "REQUEST_TIME",
              });
            }
          }
          const write = {
            update: {
              name: decodeURIComponent(
                document.slice("https://firestore.googleapis.com/v1/".length),
              ),
              fields,
            },
            ...(operation === "set"
              ? { updateMask: { fieldPaths: Object.keys(fields) } }
              : { currentDocument: { exists: false } }),
            ...(transforms.length ? { updateTransforms: transforms } : {}),
          };
          data = await upstream(base + ":commit", { writes: [write] }, token);
        } else throw new ApiError(400, "invalid-request");
      }
    } else throw new ApiError(404, "not-found");
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e instanceof ApiError ? e.status : 503;
    res.end(
      JSON.stringify({ error: e instanceof ApiError ? e.code : "unavailable" }),
    );
  }
}
