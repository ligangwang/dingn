import { handleApi } from "./api.mjs";
import { handleBilling } from "./billing.mjs";
import { gameRoutes, handleGameApi } from "./game-api.mjs";
import { developerRedirect, localizedRedirect } from "./locale-redirect.mjs";
import {
  cachedRecord,
  cachedRecords,
  handleGames,
  isGamesPath,
} from "./game-registry.mjs";
import { gamePageHtml, sitemapWithGames } from "./game-seo.mjs";
import { adminGameRoutes, handleAdminGames } from "./games-admin.mjs";
import {
  developerGameRoutes,
  handleDeveloperGames,
} from "./developer-games.mjs";
import { handleGameReports, reportRoutes } from "./game-reports.mjs";
import { handleGamePlays, startFlushing, statsRoutes } from "./game-stats.mjs";
import { handleRewards, rewardRoutes } from "./rewards.mjs";
import { handleKingdom, kingdomRoutes } from "./kingdom.mjs";
// A failed background call in the XP API (for example missing Google
// credentials) must never take the website down with it.
process.on("unhandledRejection", (error) => {
  console.error("unhandled rejection", error);
});
import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
// `npm run preview -- --local-games` plays games published with
// `npm run publish:game -- <id> --local` instead of the production registry.
if (process.argv.includes("--local-games"))
  process.env.GAMES_LOCAL_DIR ||= path.resolve(".games-local");
const root = path.resolve("out"),
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";
// A 3D model's ETag is a hash of its bytes, worked out the first time it is
// asked for, so it stays the same across deploys that don't change the file.
const etags = new Map();
function etagOf(file) {
  let tag = etags.get(file);
  if (!tag) {
    const hash = createHash("sha1").update(readFileSync(file));
    etags.set(file, (tag = `"${hash.digest("base64url")}"`));
  }
  return tag;
}
/**
 * Sends an exported file after `change(text)` fills in what only the server
 * knows. If that fails or takes over two seconds (the registry is down, say),
 * the file goes out as exported.
 */
async function sendFilled(res, file, type, change) {
  const text = await readFile(file, "utf8");
  let filled = text;
  try {
    filled = await Promise.race([
      change(text),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000).unref(),
      ),
    ]);
  } catch (error) {
    console.error("page fill", error.message);
  }
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(filled);
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".ts": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".zip": "application/zip",
};
startFlushing();
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const developer = developerRedirect(req.headers, req.url);
    if (developer) {
      res.writeHead(301, { Location: developer, "Cache-Control": "no-cache" });
      res.end();
      return;
    }
    if (pathname.startsWith("/api/billing/")) {
      void handleBilling(req, res);
      return;
    }
    if (adminGameRoutes.includes(pathname)) {
      void handleAdminGames(req, res, pathname);
      return;
    }
    if (developerGameRoutes.includes(pathname)) {
      void handleDeveloperGames(req, res, pathname);
      return;
    }
    if (reportRoutes.includes(pathname)) {
      void handleGameReports(req, res);
      return;
    }
    if (rewardRoutes.includes(pathname)) {
      void handleRewards(req, res, pathname);
      return;
    }
    if (kingdomRoutes.includes(pathname)) {
      void handleKingdom(req, res, pathname);
      return;
    }
    if (statsRoutes.includes(pathname)) {
      void handleGamePlays(req, res);
      return;
    }
    if (isGamesPath(pathname)) {
      void handleGames(req, res, pathname);
      return;
    }
    if (gameRoutes.includes(pathname)) {
      void handleGameApi(req, res, pathname);
      return;
    }
    if (pathname.startsWith("/api/")) {
      void handleApi(req, res);
      return;
    }
    if (pathname === "/health") {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
      res.end("ok\n");
      return;
    }
    if (pathname.startsWith("/__/auth/")) {
      if (!["GET", "POST", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const upstream = https.request(
        {
          hostname: "dingn-193716.firebaseapp.com",
          path: req.url,
          method: req.method,
          headers: {
            "content-type":
              req.headers["content-type"] || "application/octet-stream",
            "user-agent": req.headers["user-agent"] || "dingn-auth-proxy",
          },
        },
        (response) => {
          res.writeHead(response.statusCode || 502, {
            ...response.headers,
            "cache-control": "no-store",
          });
          response.on("error", () => res.destroy());
          response.pipe(res);
        },
      );
      upstream.setTimeout(15000, () =>
        upstream.destroy(new Error("Upstream timeout")),
      );
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end("Sign-in helper temporarily unavailable");
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    const moved = localizedRedirect(req.url);
    if (moved) {
      res.writeHead(301, { Location: moved, "Cache-Control": "no-cache" });
      res.end();
      return;
    }
    let target;
    // Every published game shares the one exported player page.
    const play = /^\/(zh\/)?play\/[a-z][a-z0-9]{1,30}\/?$/.exec(pathname);
    if (play) {
      if (!pathname.endsWith("/")) {
        const url = new URL(req.url, "http://localhost");
        res.writeHead(308, { Location: pathname + "/" + url.search });
        res.end();
        return;
      }
      const id = pathname.split("/").filter(Boolean).at(-1);
      void sendFilled(
        res,
        path.join(root, play[1] ? "zh" : "", "play", "index.html"),
        types[".html"],
        async (html) => gamePageHtml(html, await cachedRecord(id), !!play[1]),
      ).catch(() => {
        res.writeHead(500);
        res.end();
      });
      return;
    }
    if (pathname === "/sitemap.xml") {
      void sendFilled(
        res,
        path.join(root, "sitemap.xml"),
        types[".xml"],
        async (xml) => sitemapWithGames(xml, await cachedRecords()),
      ).catch(() => {
        res.writeHead(500);
        res.end();
      });
      return;
    }
    if (!target)
      try {
        target = path.resolve(
          root,
          "." +
            decodeURIComponent(new URL(req.url, "http://localhost").pathname),
        );
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (existsSync(target) && statSync(target).isDirectory())
      target = path.join(target, "index.html");
    if (!existsSync(target)) {
      target = path.join(root, "404.html");
      res.statusCode = 404;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(target)] || "application/octet-stream",
    );
    if (pathname.startsWith("/sdk/") && res.statusCode !== 404) {
      // Games load the SDK from their own sandboxed (opaque) origin and from
      // developers' computers, so it must be readable from any origin.
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
    } else if (
      pathname.startsWith("/_next/static/") &&
      res.statusCode !== 404
    ) {
      // Next names these files after their contents, so a name never changes
      // what it holds and a browser may keep it for good.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (pathname.startsWith("/models/") && res.statusCode !== 404) {
      // The kingdom's models are many megabytes. A browser still asks about
      // each one on every visit, but gets a short "unchanged" answer instead
      // of the file when it already holds the same bytes.
      const tag = etagOf(target);
      res.setHeader("ETag", tag);
      res.setHeader("Cache-Control", "no-cache");
      if (req.headers["if-none-match"] === tag) {
        res.statusCode = 304;
        res.end();
        return;
      }
    } else res.setHeader("Cache-Control", "no-cache");
    createReadStream(target)
      .on("error", () => {
        res.statusCode = 404;
        res.end("Not found");
      })
      .pipe(res);
  })
  .listen(port, host, () =>
    console.log(`dingn server: http://${host}:${port}`),
  );
