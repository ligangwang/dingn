// The growth funnel: where players come from and whether they come back.
// The website (src/lib/funnel.ts) reports, with no id and only from browsers
// that have not opted out:
//
//   POST /api/funnel { event: "visit", source, new, returning, returner, referred }
//   POST /api/funnel { event: "start" | "finish" | "share", source, game }
//
// A visit is counted at most once a day per browser. Each server instance
// adds the counts up in memory and writes them to Firestore
// `funnelStats/{YYYY-MM-DD}` about once a minute, by source and by game:
//
//   { sources: { google: { visitors: 3, new: 2, starts: 4, … } },
//     games: { memory: { starts: 4, finishes: 2, shares: 1 } } }
//
// Admins read the sums on /admin/funnel/ (POST /api/admin/funnel { days }).
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import { ID, cachedRecord } from "./game-registry.mjs";
import { getDoc, incrementDoc } from "./platform-store.mjs";
import { hasRole } from "./roles.mjs";

export const funnelRoutes = ["/api/funnel", "/api/admin/funnel"];
// Starts with a letter or digit: Firestore refuses field names like `__x__`.
export const SOURCE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
/** Most fields one write adds to (Firestore allows 500 transforms a commit). */
export const MAX_FIELDS_PER_WRITE = 400;
/** Source metrics, in the order the admin page shows them. */
export const SOURCE_METRICS = [
  "visitors",
  "new",
  "starts",
  "finishes",
  "shares",
  "returning",
  "returners",
  "referred",
];
export const GAME_METRICS = ["starts", "finishes", "shares"];
/** New sources one instance accepts a day before calling the rest "other". */
export const MAX_SOURCES = 200;
const FLUSH_MS = 60_000;

const pending = new Map();
const seen = new Map();
const day = (date) => date.toISOString().slice(0, 10);

/** Turns a checked report into the counts it adds, as dotted field names. */
export function countsFor(body) {
  const counts = {};
  const add = (path, n = 1) => (counts[path] = (counts[path] ?? 0) + n);
  const s = `sources.${body.source}`;
  if (body.event === "visit") {
    add(`${s}.visitors`);
    if (body.new) add(`${s}.new`);
    if (body.returning) add(`${s}.returning`);
    if (body.returner) add(`${s}.returners`);
    if (body.referred) add(`${s}.referred`);
    return counts;
  }
  const metric = { start: "starts", finish: "finishes", share: "shares" }[
    body.event
  ];
  add(`${s}.${metric}`);
  add(`games.${body.game}.${metric}`);
  return counts;
}

/** A checked report, or an ApiError. */
export function checkReport(body) {
  const { event, source } = body ?? {};
  if (typeof source !== "string" || !SOURCE.test(source))
    throw new ApiError(400, "invalid-request");
  if (event === "visit") {
    const flags = ["new", "returning", "returner", "referred"];
    if (flags.some((f) => body[f] != null && typeof body[f] !== "boolean"))
      throw new ApiError(400, "invalid-request");
    return {
      event,
      source,
      ...Object.fromEntries(flags.map((f) => [f, body[f] === true])),
    };
  }
  if (!["start", "finish", "share"].includes(event))
    throw new ApiError(400, "invalid-request");
  if (typeof body.game !== "string" || !ID.test(body.game))
    throw new ApiError(400, "invalid-request");
  return { event, source, game: body.game };
}

/** Keeps the number of sources in a day's document bounded. */
function boundSource(date, source) {
  for (const d of seen.keys()) if (d !== date) seen.delete(d);
  const sources = seen.get(date) ?? new Set();
  seen.set(date, sources);
  if (sources.has(source)) return source;
  if (sources.size >= MAX_SOURCES) return "other";
  sources.add(source);
  return source;
}

export function recordReport(report, now = new Date()) {
  const date = day(now);
  const counts = countsFor({
    ...report,
    source: boundSource(date, report.source),
  });
  const doc = pending.get(date) ?? {};
  for (const [name, n] of Object.entries(counts))
    doc[name] = (doc[name] ?? 0) + n;
  pending.set(date, doc);
}

/** Writes the counts. Counts that fail to save are kept for later. */
export async function flushFunnel() {
  const batch = [...pending];
  pending.clear();
  for (const [date, counts] of batch) {
    const entries = Object.entries(counts);
    for (let i = 0; i < entries.length; i += MAX_FIELDS_PER_WRITE) {
      const part = entries.slice(i, i + MAX_FIELDS_PER_WRITE);
      try {
        await incrementDoc("funnelStats", date, Object.fromEntries(part));
      } catch (error) {
        console.error("funnel stats", date, error);
        const doc = pending.get(date) ?? {};
        for (const [name, n] of part) doc[name] = (doc[name] ?? 0) + n;
        pending.set(date, doc);
      }
    }
  }
}

let timer;
export function startFunnelFlushing() {
  if (timer) return;
  timer = setInterval(() => void flushFunnel(), FLUSH_MS);
  timer.unref();
  process.once("SIGTERM", () => void flushFunnel());
}

/** Adds up days of `funnelStats` documents into totals by source and game. */
export function sumFunnel(docs) {
  const sources = {};
  const games = {};
  const add = (into, metrics, from) => {
    for (const [name, values] of Object.entries(from ?? {})) {
      const row = (into[name] ??= Object.fromEntries(
        metrics.map((m) => [m, 0]),
      ));
      for (const m of metrics)
        if (typeof values?.[m] === "number") row[m] += values[m];
    }
  };
  for (const doc of docs) {
    add(sources, SOURCE_METRICS, doc?.sources);
    add(games, GAME_METRICS, doc?.games);
  }
  const total = Object.fromEntries(SOURCE_METRICS.map((m) => [m, 0]));
  for (const row of Object.values(sources))
    for (const m of SOURCE_METRICS) total[m] += row[m];
  return { sources, games, total };
}

/** The last `days` days (UTC), newest first, as YYYY-MM-DD. */
export function lastDays(days, now = new Date()) {
  return Array.from({ length: days }, (_, i) =>
    day(new Date(now.getTime() - i * 86_400_000)),
  );
}

const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

export async function handleFunnel(
  req,
  res,
  pathname,
  { verify, exchange = refresh } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    const body = await readBody(req);
    if (pathname === "/api/funnel") {
      throttle(req);
      const report = checkReport(body);
      // Games must exist, so made-up ids can't pile up in the statistics.
      if (report.game && !(await cachedRecord(report.game)))
        throw new ApiError(404, "not-found");
      recordReport(report);
      return send(res, 200, { ok: true });
    }
    // /api/admin/funnel
    const token = await exchange(req, res);
    let claims;
    try {
      claims = await (
        verify ??
        (async (t) =>
          (
            await (await import("./games-admin.mjs")).firebaseAuth()
          ).verifyIdToken(t))
      )(token);
    } catch {
      throw new ApiError(401, "invalid-credential");
    }
    if (!hasRole(claims, "admin")) throw new ApiError(403, "admin-required");
    const days = [1, 7, 30, 90].includes(body.days) ? body.days : 7;
    // Today's counts still waiting in this instance are added in, so a test
    // visit shows up at once.
    await flushFunnel();
    const dates = lastDays(days);
    const docs = await Promise.all(dates.map((d) => getDoc("funnelStats", d)));
    return send(res, 200, {
      days,
      from: dates.at(-1),
      to: dates[0],
      ...sumFunnel(docs),
    });
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("funnel", error);
    send(res, 503, { error: "unavailable" });
  }
}
