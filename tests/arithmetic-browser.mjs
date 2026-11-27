import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { worksheet } from "../src/engine.ts";
import { fresh, start, storageKey } from "../src/session.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const url = "http://127.0.0.1:49831/";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(url);
  for (const p of [
    { op: 0, nums: ["46", "38"] },
    { op: 0, nums: ["99", "99", "99"] },
    { op: 1, nums: ["100", "1"] },
    { op: 1, nums: ["302", "178"] },
    { op: 2, nums: ["66", "8"] },
    { op: 2, nums: ["0", "7"] },
    { op: 2, nums: ["27", "13"] },
    { op: 2, nums: ["99", "99"] },
    { op: 2, nums: ["105", "20"] },
    { op: 2, nums: ["12.3", "0.4"] },
    { op: 2, nums: ["0.1", "0.1"] },
    { op: 2, nums: ["9999", "9999"] },
  ]) {
    const w = worksheet(p),
      data = fresh();
    data.active = start([p]);
    data.config.op = p.op;
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: storageKey, data },
    );
    await page.goto(url + "#/practice");
    await page.reload();
    await page.getByRole("button", { name: "ナビ ON" }).waitFor();
    assert.equal(
      await page
        .locator(".division-paper")
        .evaluate((el) => getComputedStyle(el).backgroundImage),
      "none",
    );
    assert.equal(await page.locator(".tile").count(), 0);
    for (const [index, step] of w.steps.entries()) {
      const current = page.locator('[data-step="' + index + '"].active');
      await current.waitFor({ state: "visible" });
      const box = await current.boundingBox(),
        paper = await page.locator(".scrollboard").boundingBox();
      assert.ok(
        box.y >= paper.y && box.y + box.height <= paper.y + paper.height + 1,
        JSON.stringify({ p, index, box, paper }),
      );
      if (step.cell.annotation) {
        const notes = page.locator(".division-notes button");
        const rectangles = await notes.evaluateAll((nodes) =>
          nodes.map((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const r = range.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
        );
        const rules = await page
          .locator(".division-rules path")
          .evaluateAll((nodes) =>
            nodes.map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, y: r.top };
            }),
          );
        for (const text of rectangles)
          for (const rule of rules) {
            const overlapsX =
              Math.min(text.right, rule.right) > Math.max(text.left, rule.left);
            assert.ok(
              !overlapsX || rule.y < text.top || rule.y > text.bottom,
              "annotation crosses rule",
            );
          }
        for (let a = 0; a < rectangles.length; a++)
          for (let b = a + 1; b < rectangles.length; b++) {
            const x = rectangles[a],
              y = rectangles[b];
            assert.ok(
              Math.min(x.right, y.right) <= Math.max(x.left, y.left) + 1 ||
                Math.min(x.bottom, y.bottom) <= Math.max(x.top, y.top) + 1,
              "overlapping annotations",
            );
          }
      }
      if (
        p.op === 2 &&
        step.phase === "sum" &&
        w.steps[index - 1]?.phase !== "sum"
      )
        await page.locator(".scrollboard").screenshot({
          path: "docs/screenshots/multiplication-paper-sum.png",
        });
      await page.getByRole("button", { name: step.value, exact: true }).click();
    }
    await page.getByRole("button", { name: "採点", exact: true }).click();
    await page.getByText("正解です！", { exact: true }).waitFor();
    if (p.op === 2 && Number(p.nums[1].replace(".", "")) < 10) {
      assert.equal(
        await page
          .locator('.division-target[aria-label="部分積を足す"]')
          .count(),
        0,
      );
      assert.equal(await page.locator(".division-rules path").count(), 1);
      assert.equal(
        await page.locator(".division-digits").evaluate(
          (el) =>
            getComputedStyle(el)
              .gridTemplateRows.split(" ")
              .filter((size) => size === "52px").length,
        ),
        3,
      );
    }
    if (p.op === 1) assert.ok(await page.locator(".slashed").count());
    await page.locator(".scrollboard").evaluate((el) => (el.scrollTop = 0));
    await page.locator(".scrollboard").screenshot({
      path: "docs/screenshots/arithmetic-" + p.nums.join("-") + ".png",
    });
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    console.log("PASS paper arithmetic", p.nums.join("/"), w.result);
  }
  // Resume a real saved worksheet paused at the obsolete final sum.
  const p = { op: 2, nums: ["66", "8"] },
    old = worksheet(p, { singleDigitSum: true }),
    data = fresh(),
    sumAt = old.steps.findIndex((step) => step.phase === "sum");
  data.active = start([p]);
  data.active.items[0] = {
    ...data.active.items[0],
    engineRevision: 3,
    at: sumAt,
    values: old.steps.map((step, index) => (index < sumAt ? step.value : "")),
  };
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: storageKey, data },
  );
  await page.reload();
  await page.getByRole("button", { name: "採点", exact: true }).click();
  await page.getByText("正解です！", { exact: true }).waitFor();
  const resumed = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).active.items[0],
    storageKey,
  );
  assert.equal(resumed.values.length, 4);
  assert.deepEqual(resumed.values, ["4", "8", "5", "2"]);
  console.log("PASS saved single-digit multiplication resumes without sum");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
