import http from "node:http";
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
