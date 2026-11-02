import { handleApi } from "./api.mjs";
import { gameRoutes, handleGameApi } from "./game-api.mjs";
// A failed background call in the XP API (for example missing Google
// credentials) must never take the website down with it.
process.on("unhandledRejection", (error) => {
  console.error("unhandled rejection", error);
});
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
const root = path.resolve("out"),
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
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
    let target;
    try {
      target = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
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
