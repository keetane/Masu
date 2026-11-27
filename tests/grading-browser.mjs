import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
const bunsu =
  JSON.parse(fs.readFileSync("package.json", "utf8")).name === "bunsu-workbook";
const engine = await import("../src/engine.ts");
const store = await import(bunsu ? "../src/store.ts" : "../src/session.ts");
const name = bunsu ? "Bunsu" : "Masu",
  prefix = "/" + name + "-grading/",
  files = new Map();
function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) collect(file);
    else files.set(prefix + path.relative("dist", file), fs.readFileSync(file));
  }
}
collect("dist");
const server = createServer((req, res) => {
  const p = new URL(req.url, "http://localhost").pathname,
    body = files.get(p.endsWith("/") ? p + "index.html" : p);
  res.writeHead(body ? 200 : 404, {
    "Content-Type":
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".txt": "text/plain; charset=utf-8",
        ".json": "application/json",
      }[path.extname(p)] ?? "text/html; charset=utf-8",
  });
  res.end(body ?? "Not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port + prefix;
let browser, page;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      store.storageKey,
    );
  const primary = () => page.locator("[data-practice-action]");
  function plan(data, index = data.active.index) {
    return engine.worksheet(
      bunsu ? data.active.problems[index] : data.active.items[index].p,
    );
  }
  const stepId = (step, i) => (bunsu ? step.id : String(i));
  function firstCorrect(data, index = 0) {
    if (!bunsu) return data.active.items[index].first;
    const a = data.active.attempts[index];
    return a.first
      ? engine.assess(plan(data, index), a.first.answers).ok
      : null;
  }
  async function fixture() {
    const data = store.fresh();
    if (bunsu) {
      const c = {
        ...engine.defaults,
        unit: "reduce",
        level: 2,
        mode: "answer",
        nav: false,
      };
      data.config = c;
      const ps = [engine.fraction(12, 18), engine.fraction(8, 12)].map((o) => ({
        version: 1,
        c,
        operands: [o],
        direction: "toMixed",
      }));
      data.active = store.start(c, ps);
    } else {
      data.config.nav = false;
      data.active = store.start([
        { op: 0, nums: ["46", "38"] },
        { op: 2, nums: ["24", "3"] },
      ]);
    }
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: store.storageKey, data },
    );
    await page.goto(base + "#/practice");
    await page.reload();
    await primary().waitFor();
    return data;
  }
  async function fill(w, wrong = false) {
    for (let i = 0; i < w.steps.length; i++) {
      await page.locator('[data-step="' + stepId(w.steps[i], i) + '"]').click();
      await page.keyboard.press(
        wrong && i === 0
          ? w.steps[i].value === "9"
            ? "8"
            : "9"
          : w.steps[i].value,
      );
    }
  }
  function entry(data) {
    return bunsu
      ? data.active.attempts[data.active.index]
      : data.active.items[data.active.index];
  }
  let original = await fixture(),
    w = plan(original);
  assert.equal(await primary().count(), 1);
  assert.equal(await primary().innerText(), "確認");
  await primary().evaluate((n) => (window.__gradingButton = n));
  const last = w.steps.length - 1;
  await page
    .locator('[data-step="' + stepId(w.steps[last], last) + '"]')
    .click();
  await page.keyboard.press(w.steps[last].value);
  assert.equal(
    await primary().innerText(),
    "確認",
    "A hole must prevent Grade even if the final position is filled",
  );
  await primary().click();
  assert.equal(firstCorrect(await state()), null);
  await fill(w, true);
  assert.equal(await primary().innerText(), "採点");
  assert.equal(await primary().getAttribute("data-practice-action"), "grade");
  await primary().scrollIntoViewIfNeeded();
  const before = await primary().boundingBox();
  await primary().click();
  const after = await primary().boundingBox();
  assert.ok(
    await primary().evaluate((n) => n === window.__gradingButton),
    "Grading replaced the physical button",
  );
  for (const key of ["x", "y", "width", "height"])
    assert.ok(
      Math.abs(before[key] - after[key]) < 1,
      "Button moved when graded: " + key,
    );
  assert.equal(await primary().innerText(), "次へ");
  assert.ok(await primary().isEnabled());
  assert.equal(
    await page.locator('[data-grade-status="incorrect"]').count(),
    1,
  );
  assert.ok((await page.locator(".wrong").count()) > 0);
  assert.equal(firstCorrect(await state()), false);
  await page.locator(".mistake-count").click();
  assert.equal(entry(await state()).at, 0);
  assert.equal(await primary().innerText(), "次へ");
  await page.reload();
  assert.equal(await primary().getAttribute("data-practice-action"), "next");
  assert.equal(firstCorrect(await state()), false);
  const saved = await state();
  await page.getByRole("button", { name: "English", exact: true }).click();
  assert.equal(await primary().innerText(), "Next question");
  assert.deepEqual(await state(), saved);
  assert.ok(
    !/[\u3040-\u30ff\u3400-\u9fff]/.test(
      await page.locator("main").innerText(),
    ),
  );
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  fs.mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/grading-next-mobile.png" });
  await primary().click();
  let data = await state();
  assert.equal(data.active.index, 1);
  assert.equal(firstCorrect(data), false);
  assert.equal(await primary().innerText(), "確認");
  w = plan(data);
  await fill(w);
  assert.equal(await primary().innerText(), "採点");
  await primary().click();
  assert.equal(await primary().innerText(), "結果を見る");
  await primary().click();
  const finished = await state();
  assert.equal(finished.active, null);
  await page.locator(".assessment-item").first().waitFor();
  assert.equal(
    bunsu
      ? finished.history[0].correct
      : finished.history[0].items.filter((e) => e.first).length,
    1,
  );
  assert.equal(await page.locator(".assessment-item").count(), 2);
  assert.equal(
    await page.locator('[data-first-result="incorrect"]').count(),
    1,
  );
  await page.screenshot({ path: "docs/screenshots/grading-result-mobile.png" });
  await page.locator('[data-first-result="incorrect"]').click();
  await page.locator(".wrong").first().waitFor();
  assert.ok(
    (await page.locator(".wrong").count()) > 0,
    "Wrong answers were not visible in review",
  );
  original = await fixture();
  w = plan(original);
  await fill(w, true);
  await primary().click();
  const first = structuredClone(entry(await state()).first);
  await page.locator('[data-step="' + stepId(w.steps[0], 0) + '"]').click();
  await page.keyboard.press(w.steps[0].value);
  assert.equal(await primary().innerText(), "採点");
  await page.getByRole("button", { name: "消す", exact: true }).click();
  assert.equal(await primary().innerText(), "確認");
  await page.keyboard.press(w.steps[0].value);
  assert.equal(await primary().innerText(), "採点");
  assert.deepEqual(entry(await state()).first, first);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Enter");
  assert.equal(await primary().innerText(), "次へ");
  assert.equal(await page.locator('[data-grade-status="correct"]').count(), 1);
  assert.deepEqual(entry(await state()).first, first);
  await page.keyboard.press("Enter");
  assert.equal((await state()).active.index, 1);
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok((await primary().boundingBox()).height >= 44);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS " +
      name +
      ": Confirm/Grade/Next/Results in the same button and position, incomplete final entry, incorrect advance and saved review, error jump, immutable first grade, corrections, reload, JA/EN, Enter and responsive targets",
  );
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: "/tmp/" + name + "-grading-failure.png" });
  throw error;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
