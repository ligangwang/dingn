// Player reports. Anyone signed in can report a game from its player page
// (POST /api/game-reports). Reports are kept in Firestore `gameReports` and
// emailed to the reviewers; admins see open ones on /admin/games/, where they
// dismiss a report or take the game down.
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import { ID, VERSION, cachedRecord } from "./game-registry.mjs";
import { queueMail, reviewers } from "./mail.mjs";
import { addDoc, listDocs, mergeDoc } from "./platform-store.mjs";

export const reportRoutes = ["/api/game-reports"];
export const REASONS = ["broken", "offensive", "unsafe", "copyright", "other"];
const MAX_DETAILS = 1000;
// Reports per account per hour, on each server instance.
const PER_HOUR = 10;
const recent = new Map();

function limit(uid, now = Date.now()) {
  const times = (recent.get(uid) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= PER_HOUR) throw new ApiError(429, "too-many-requests");
  times.push(now);
  recent.set(uid, times);
}

/** Checks a report from a player. Throws ApiError for a bad one. */
export function validateReport(body) {
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (
    typeof body.id !== "string" ||
    !ID.test(body.id) ||
    typeof body.version !== "string" ||
    !VERSION.test(body.version) ||
    !REASONS.includes(body.reason) ||
    details.length > MAX_DETAILS ||
    (body.reason === "other" && !details)
  )
    throw new ApiError(400, "invalid-request");
  return { id: body.id, version: body.version, reason: body.reason, details };
}

/** Open reports, newest first, for the admin page. */
export async function openReports() {
  return (await listDocs("gameReports", ["status", "open"]))
    .map((r) => ({
      id: r.id,
      game: r.game,
      version: r.version,
      reason: r.reason,
      details: r.details ?? "",
      reporter: r.reporterEmail || r.reporter || "",
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Closes a report: "dismiss" (nothing wrong) or "resolve" (acted on). */
export async function closeReport(id, action, admin) {
  if (
    typeof id !== "string" ||
    !/^[\w-]{1,64}$/.test(id) ||
    !["dismiss", "resolve"].includes(action)
  )
    throw new ApiError(400, "invalid-request");
  await mergeDoc("gameReports", id, {
    status: action === "dismiss" ? "dismissed" : "resolved",
    closedAt: new Date().toISOString(),
    closedBy: admin,
  });
}

/** POST /api/game-reports { id, version, reason, details } */
export async function handleGameReports(
  req,
  res,
  { verify, exchange = refresh } = {},
) {
  const send = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    throttle(req);
    const body = await readBody(req);
    const token = await exchange(req, res);
    let claims;
    try {
      const check =
        verify ??
        (async (t) =>
          (
            await (await import("./games-admin.mjs")).firebaseAuth()
          ).verifyIdToken(t));
      claims = await check(token);
    } catch {
      throw new ApiError(401, "invalid-credential");
    }
    const report = validateReport(body);
    const record = await cachedRecord(report.id);
    if (!record?.versions?.[report.version])
      throw new ApiError(404, "not-found");
    limit(claims.uid);
    const createdAt = new Date().toISOString();
    await addDoc("gameReports", {
      game: report.id,
      version: report.version,
      reason: report.reason,
      details: report.details,
      reporter: claims.uid,
      reporterEmail: claims.email ?? "",
      status: "open",
      createdAt,
    });
    console.log("game report", report.id, report.version, report.reason);
    await queueMail(
      reviewers(),
      `dingn: ${report.id} was reported (${report.reason})`,
      `${report.id} ${report.version} was reported as "${report.reason}".\n\n${report.details || "(no details)"}\n\nReview it at https://dingn.com/admin/games/`,
    );
    send(200, { ok: true });
  } catch (error) {
    if (error instanceof ApiError)
      return send(error.status, { error: error.message });
    console.error("game reports", error);
    send(503, { error: "unavailable" });
  }
}
