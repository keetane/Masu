import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { fresh, start, storageKey } from "../src/session.ts";
import { worksheet } from "../src/engine.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const url = "http://127.0.0.1:49831/";
const box = (i) => page.locator('[data-step="' + i + '"]').boundingBox();
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 2, `not aligned: ${a}, ${b}`);
try {
  await page.goto(url);
  const data = fresh();
  data.config.op = 3;
  data.active = start([{ op: 3, nums: ["220", "6"] }]);
  await page.evaluate(
    ({ data, key }) => localStorage.setItem(key, JSON.stringify(data)),
    { data, key: storageKey },
  );
  await page.goto(url + "#/practice");
  await page.reload();
  for (const digit of ["3", "1", "8", "4"])
    await page.getByRole("button", { name: digit, exact: true }).click();
  const difference = await box(3),
    down = await box(4),
    product = await box(2);
  assert.equal(await page.locator(".loan,.reduced,.slashed").count(), 0);
  near(difference.y, down.y);
  near(down.x - difference.x, 44);
  assert.ok(difference.y - product.y < 80);
  assert.equal(await page.locator(".bracket").textContent(), "");
  assert.equal(await page.locator(".division-rules .bracket").count(), 1);
  assert.ok(
    (await page.locator(".division-rules .bracket").getAttribute("d")).includes(
      "C",
    ),
  );
  assert.equal(
    await page
      .locator(".division-digits")
      .evaluate((el) => getComputedStyle(el).display),
    "grid",
  );
  assert.equal(
    await page
      .locator(".division-paper")
      .evaluate((el) => getComputedStyle(el).backgroundImage),
    "none",
  );
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/division-220-6-bring-down.png",
  });
  // An incorrect quotient is marked immediately while navigation still advances.
  await page.getByRole("button", { name: "1", exact: true }).click();
  assert.ok(await page.locator('[data-step="5"].wrong').count());
  await page.getByRole("button", { name: "前のマス", exact: true }).click();
  await page.getByRole("button", { name: "6", exact: true }).click();
  for (const digit of ["3", "6", "4", "4"])
    await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "確認", exact: true }).click();
  await page.getByText("正解です！", { exact: true }).waitFor();
  await page
    .locator(".scrollboard")
    .screenshot({ path: "docs/screenshots/division-corrected.png" });
  const caption = page.getByText("余り", { exact: true }),
    captionBox = await caption.boundingBox();
  assert.ok(captionBox.width >= 80 && captionBox.height <= 45);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator(".scrollboard").evaluate((el) => (el.scrollTop = 0));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/division-220-6-${width}.png`,
    });
  }
  // A carry note is an active input even before its product digit exists.
  const carryData = fresh();
  carryData.active = start([{ op: 3, nums: ["1000", "16"] }]);
  await page.evaluate(
    ({ data, key }) => localStorage.setItem(key, JSON.stringify(data)),
    { data: carryData, key: storageKey },
  );
  await page.reload();
  const carrySheet = worksheet({ op: 3, nums: ["1000", "16"] });
  for (const [index, step] of carrySheet.steps.entries()) {
    await page
      .locator('[data-step="' + index + '"].active')
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: step.value, exact: true }).click();
  }
  for (const nums of [
    ["201", "13"],
    ["1005", "5"],
    ["1000", "16"],
    ["1.2", "0.3"],
    ["123", "12"],
  ]) {
    const w = worksheet({ op: 3, nums }),
      d = fresh();
    d.config.op = 3;
    d.active = start([{ op: 3, nums }]);
    d.active.items[0].values = w.steps.map((s) => s.value);
    d.active.items[0].at = w.steps.length - 1;
    d.active.items[0].checked = true;
    await page.evaluate(
      ({ data, key }) => localStorage.setItem(key, JSON.stringify(data)),
      { data: d, key: storageKey },
    );
    await page.reload();
    await page.getByRole("button", { name: "ナビ ON" }).waitFor();
    await page.locator(".scrollboard").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({
      path: `docs/screenshots/division-${nums.join("-")}.png`,
    });
    for (const c of w.cells.filter((c) => c.annotation)) {
      const current = await box(c.step);
      const anchor = w.cells.find(
        (o) =>
          !o.annotation &&
          o.step !== undefined &&
          o.row === c.annotation.row &&
          o.col === c.annotation.col &&
          !o.point,
      );
      if (anchor) {
        const target = await box(anchor.step);
        near(current.x + current.width / 2, target.x + target.width / 2);
        const ink = async (step) =>
          page.locator('[data-step="' + step + '"]').evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const rect = range.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom };
          });
        const noteInk = await ink(c.step),
          digitInk = await ink(anchor.step);
        assert.ok(
          noteInk.bottom <= digitInk.top + 1,
          JSON.stringify({ noteInk, digitInk }),
        );
        const previous = w.cells
          .filter(
            (other) =>
              !other.annotation &&
              !other.point &&
              other.step !== undefined &&
              other.col === c.annotation.col &&
              other.row < c.annotation.row,
          )
          .sort((a, b) => b.row - a.row)[0];
        if (previous) {
          const previousInk = await ink(previous.step);
          assert.ok(
            previousInk.bottom <= noteInk.top + 1,
            JSON.stringify({ previousInk, noteInk }),
          );
        }
      }
    }
  }
  console.log(
    "PASS 220/6 manual input, 40 alignment, compact notes, bracket, remainder, wrong-input marker, four mobile widths, five additional worksheets",
  );
} finally {
  await browser.close();
}
