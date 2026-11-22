import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";

// Serve the actual distribution below a repository-like subpath, without Vite.
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
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const origin = "http://127.0.0.1:" + server.address().port;
  const base = origin + "/Masu-test/";
  const errors = [],
    outside = [],
    failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin + "/")) outside.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto(base);
  await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  await page.getByRole("link", { name: "ライセンス", exact: true }).click();
  await page
    .getByRole("heading", { name: "ライセンス・無償利用条件" })
    .waitFor();
  const text = await page.locator("main").innerText();
  assert.ok(text.includes(fs.readFileSync("LICENSE", "utf8").trim()));
  assert.ok(
    text.includes(fs.readFileSync("THIRD_PARTY_NOTICES.md", "utf8").trim()),
  );
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/screenshots/licenses-mobile.png" });
  for (const anchor of await page
    .locator("a")
    .evaluateAll((nodes) => nodes.map((node) => node.href))) {
    const response = await page.request.get(anchor);
    assert.equal(response.status(), 200, anchor);
  }
  for (const slug of ["about", "terms", "privacy", "licenses"]) {
    await page.goto(base + slug + "/index.html");
    await page.reload();
    const home = page.getByRole("link", { name: "← Masu ホーム" });
    assert.equal(await home.getAttribute("href"), "../index.html");
    await home.click();
    await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  }
  const report = await page.request.get(base + "licenses/bundle-audit.json");
  assert.equal(report.status(), 200);
  assert.equal((await report.json()).notices.length, 5);
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  assert.deepEqual(failures, []);
  console.log(
    "PASS publication subpath, full license texts, notice links, policy reload/home, mobile widths, no external requests or browser errors",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
