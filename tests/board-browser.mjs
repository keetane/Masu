import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import { worksheet } from "../src/engine.ts";
import { fresh, start, storageKey } from "../src/session.ts";
import { normalizationSteps } from "../src/normalization.ts";
import { serveDistribution } from "./static-server.mjs";
const server = await serveDistribution();
const base = "http://127.0.0.1:" + server.address().port + "/Masu-test/";
let browser, page;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(10000);
  const errors = [],
    outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(base)) outside.push(r.url());
  });
  const primary = () => page.locator("[data-practice-action]");
  async function geometry() {
    return page.locator(".division-sheet").evaluate((board) => ({
      width: board.style.width,
      height: board.style.height,
      tracks: board.querySelector(".division-digits").getAttribute("style"),
      cells: [...board.querySelectorAll("[data-step]")].map((n) => [
        n.dataset.step,
        n.getAttribute("style"),
      ]),
      rules: [...board.querySelectorAll("path")].map((n) =>
        n.getAttribute("d"),
      ),
    }));
  }
  async function assertAllCells(w, count = 1) {
    assert.equal(await page.locator("[data-step]").count(), w.steps.length);
    assert.equal(await page.locator(".answer-cell").count(), w.steps.length);
    assert.deepEqual(
      (
        await page
          .locator("[data-step]")
          .evaluateAll((nodes) => nodes.map((n) => Number(n.dataset.step)))
      ).sort((a, b) => a - b),
      w.steps.map((_, i) => i),
    );
    assert.equal(await page.locator(".division-target.active").count(), count);
    const active = count
      ? await page.locator(".division-target.active").getAttribute("data-step")
      : null;
    const expectedSources =
      active === null
        ? []
        : w.steps[Number(active)].related
            .filter((cell) => cell !== w.steps[Number(active)].cell)
            .map((cell) => w.cells.indexOf(cell))
            .sort((a, b) => a - b);
    const actualSources = await page
      .locator(".related")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number(n.dataset.cell)).sort((a, b) => a - b),
      );
    assert.deepEqual(
      actualSources,
      expectedSources,
      "Only the current calculation sources should be lightly highlighted",
    );
    if (actualSources.length) {
      assert.notEqual(
        await page
          .locator(".related")
          .first()
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        await page
          .locator(".active")
          .evaluate((n) => getComputedStyle(n).backgroundColor),
      );
    }
    assert.ok(
      await page
        .locator("[data-step]")
        .evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              getComputedStyle(n).display !== "none" &&
              getComputedStyle(n).visibility === "visible",
          ),
        ),
    );
  }
  fs.mkdirSync("docs/screenshots", { recursive: true });
  for (const p of [
    { op: 0, nums: ["46", "38"] },
    { op: 0, nums: ["99", "99", "99"] },
    { op: 1, nums: ["100", "1"] },
    { op: 1, nums: ["302", "178"] },
    { op: 2, nums: ["27", "13"] },
    { op: 2, nums: ["776", "46"] },
    { op: 2, nums: ["9999", "9999"] },
    { op: 2, nums: ["66", "8"] },
    { op: 2, nums: ["0.1", "0.1"] },
    { op: 3, nums: ["220", "6"] },
    { op: 3, nums: ["1000", "16"] },
    { op: 3, nums: ["1", "8"], fractional: true },
    { op: 3, nums: ["739.0", "5.0"] },
    { op: 3, nums: ["0.12", "0.3"] },
  ]) {
    const data = fresh(),
      w = worksheet(p),
      groups = normalizationSteps(w);
    data.config.op = p.op;
    data.active = start([p]);
    await page.goto(base);
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: storageKey, data },
    );
    await page.goto(base + "#/practice");
    await page.reload();
    await page.locator(".division-sheet").waitFor();
    await assertAllCells(w, groups.count ? 0 : 1);
    assert.ok(
      (await page.locator("[data-step]").allTextContents()).every(
        (v) => v.trim() === "",
      ),
      "Answers must start empty",
    );
    const initial = await geometry();
    if (p.nums[0] === "27" || p.nums[0] === "220" || p.nums[0] === "739.0")
      await page.screenshot({
        path:
          "docs/screenshots/all-cells-" +
          (p.op === 2
            ? "multiplication"
            : groups.count
              ? "decimal"
              : "division") +
          "-start.png",
      });
    if (groups.count) {
      assert.ok(
        await page
          .locator("[data-step]")
          .evaluateAll((nodes) => nodes.every((n) => n.disabled)),
      );
      for (const kind of ["除数", "被除数"]) {
        const slider = page.getByRole("slider", { name: kind + "の小数点" });
        await slider.focus();
        for (let i = 0; i < w.normalization.shift; i++)
          await page.keyboard.press("ArrowRight");
        assert.deepEqual(
          await geometry(),
          initial,
          "Normalization must not add cells or resize the board",
        );
      }
    }
    await primary().waitFor();
    await page.getByRole("button", { name: "ナビ ON", exact: true }).click();
    await assertAllCells(w);
    assert.deepEqual(await geometry(), initial);
    await page.getByRole("button", { name: "ナビ OFF", exact: true }).click();
    const firstStep = w.steps[groups.count];
    await page.keyboard.press(firstStep.value === "9" ? "8" : "9");
    assert.equal(
      await page.locator(".wrong").count(),
      0,
      "Only grading may mark mistakes",
    );
    await page.getByRole("button", { name: "消す", exact: true }).click();
    for (let i = groups.count; i < w.steps.length; i++) {
      const step = w.steps[i];
      assert.equal(
        await page.locator(".division-target.active").getAttribute("data-step"),
        String(i),
      );
      await assertAllCells(w);
      if (p.nums[0] === "776" && i === 2)
        await page.locator(".scrollboard").screenshot({
          path: "docs/screenshots/related-multiplication-776-46.png",
        });
      assert.ok(
        await page.locator(".division-target.active").evaluate((n) => {
          const r = n.getBoundingClientRect(),
            b = n.closest(".scrollboard").getBoundingClientRect();
          return (
            r.top >= b.top - 1 &&
            r.bottom <= b.bottom + 1 &&
            r.left >= b.left - 1 &&
            r.right <= b.right + 1
          );
        }),
      );
      await page.keyboard.press(step.value);
      assert.deepEqual(
        await geometry(),
        initial,
        "Input must not add cells, move notes or reveal rows",
      );
    }
    await primary().click();
    assert.equal(
      await page.locator('[data-grade-status="correct"]').count(),
      1,
    );
    await page.reload();
    await primary().waitFor();
    assert.deepEqual(await geometry(), initial);
    const saved = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    );
    await page.getByRole("button", { name: "English", exact: true }).click();
    await assertAllCells(w);
    assert.deepEqual(await geometry(), initial);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      saved,
    );
    await page.getByRole("button", { name: "日本語", exact: true }).click();
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await assertAllCells(w);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    console.log("PASS full worksheet", p.nums.join("/"));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  console.log(
    "PASS all required cells and notes from start, fixed geometry, precise calculation-source highlights, normalization, navigation, grading, reload, JA/EN and responsive widths",
  );
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: "/tmp/masu-all-cells-failure.png" });
  throw error;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
