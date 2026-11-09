// Play counts. The player page reports each time a game starts
// (POST /api/game-plays), and each server instance adds them up in memory and
// writes them to Firestore `gameStats/{id}` about once a minute, as a total
// and one count per day (UTC). Developers see their games' counts on
// /developers/games/ and admins on /admin/games/.
import { ApiError, readBody, throttle, validateOrigin } from "./api.mjs";
import { ID, VERSION, cachedRecord, publicGame } from "./game-registry.mjs";
import { getDoc, incrementDoc, listDocs } from "./platform-store.mjs";

export const statsRoutes = ["/api/game-plays"];
const FLUSH_MS = 60_000;
const pending = new Map();

const day = (date) => date.toISOString().slice(0, 10);

export function recordPlay(id, now = new Date()) {
  const key = `${id}|${day(now)}`;
  pending.set(key, (pending.get(key) ?? 0) + 1);
}

/** Writes the counted plays. Counts that fail to save are kept for later. */
export async function flushPlays() {
  const batch = [...pending];
  pending.clear();
  const byGame = new Map();
  for (const [key, n] of batch) {
    const [id, date] = key.split("|");
    const counts = byGame.get(id) ?? { total: 0 };
    counts.total += n;
    counts[`days.${date}`] = (counts[`days.${date}`] ?? 0) + n;
    byGame.set(id, counts);
  }
  for (const [id, counts] of byGame) {
    try {
      await incrementDoc("gameStats", id, counts);
    } catch (error) {
      console.error("game stats", id, error);
      for (const [name, n] of Object.entries(counts))
        if (name.startsWith("days.")) {
          const key = `${id}|${name.slice(5)}`;
          pending.set(key, (pending.get(key) ?? 0) + n);
        }
    }
  }
}

let timer;
export function startFlushing() {
  if (timer) return;
  timer = setInterval(() => void flushPlays(), FLUSH_MS);
  timer.unref();
  process.once("SIGTERM", () => void flushPlays());
}

/** Total plays and plays in the last 7 and 30 days. */
export function summarize(doc, now = new Date()) {
  const days = doc?.days ?? {};
  const since = (n) => day(new Date(now.getTime() - (n - 1) * 86_400_000));
  const sum = (from) =>
    Object.entries(days)
      .filter(([d]) => d >= from)
      .reduce((total, [, n]) => total + n, 0);
  return { total: doc?.total ?? 0, week: sum(since(7)), month: sum(since(30)) };
}

export async function playsFor(id) {
  return summarize(await getDoc("gameStats", id));
}

export async function allPlays() {
  const result = {};
  for (const doc of await listDocs("gameStats"))
    result[doc.id] = summarize(doc);
  return result;
}

/** POST /api/game-plays { id, version } from the player page. */
export async function handleGamePlays(req, res) {
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
    if (
      typeof body.id !== "string" ||
      !ID.test(body.id) ||
      (body.version != null &&
        (typeof body.version !== "string" || !VERSION.test(body.version)))
    )
      throw new ApiError(400, "invalid-request");
    if (!publicGame(await cachedRecord(body.id), body.version ?? ""))
      throw new ApiError(404, "not-found");
    recordPlay(body.id);
    send(200, { ok: true });
  } catch (error) {
    if (error instanceof ApiError)
      return send(error.status, { error: error.message });
    console.error("game plays", error);
    send(503, { error: "unavailable" });
  }
}
