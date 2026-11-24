import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
export async function serveDistribution() {
  const files = new Map();
  function collect(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) collect(file);
      else
        files.set(
          "/Masu-test/" + path.relative("dist", file),
          fs.readFileSync(file),
        );
    }
  }
  collect("dist");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };
  const server = createServer((req, res) => {
    const requested = new URL(req.url, "http://localhost").pathname;
    const file = requested.endsWith("/") ? requested + "index.html" : requested;
    const body = files.get(file);
    res.writeHead(body ? 200 : 404, {
      "Content-Type": types[path.extname(file)] ?? "text/plain",
    });
    res.end(body ?? "Not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}
