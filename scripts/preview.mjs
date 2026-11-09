import { handleApi } from "./api.mjs";
import { handleBilling } from "./billing.mjs";
import { gameRoutes, handleGameApi } from "./game-api.mjs";
import { localizedRedirect } from "./locale-redirect.mjs";
import { handleGames, isGamesPath } from "./game-registry.mjs";
import { adminGameRoutes, handleAdminGames } from "./games-admin.mjs";
// A failed background call in the XP API (for example missing Google
// credentials) must never take the website down with it.
process.on("unhandledRejection", (error) => {
  console.error("unhandled rejection", error);
});
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
// `npm run preview -- --local-games` plays games published with
// `npm run publish:game -- <id> --local` instead of the production registry.
if (process.argv.includes("--local-games"))
  process.env.GAMES_LOCAL_DIR ||= path.resolve(".games-local");
const root = path.resolve("out"),
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";
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
};
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/billing/")) {
      void handleBilling(req, res);
      return;
    }
    if (adminGameRoutes.includes(pathname)) {
      void handleAdminGames(req, res, pathname);
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
      target = path.join(root, play[1] ? "zh" : "", "play", "index.html");
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
    res.setHeader("Cache-Control", "no-cache");
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
