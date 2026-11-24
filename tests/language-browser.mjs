import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import { serveDistribution } from "./static-server.mjs";
import { worksheet } from "../src/engine.ts";
import { fresh, start, storageKey } from "../src/session.ts";
import { languageKey } from "../src/i18n.ts";
import { normalizationSteps } from "../src/normalization.ts";
const server = await serveDistribution();
const origin = "http://127.0.0.1:" + server.address().port;
const url = origin + "/Masu-test/";
let browser;
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [],
    outside = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin + "/")) outside.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  async function englishOnly() {
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.ok(
      !japanese.test(await page.locator("body").innerText()),
      "Japanese visible in English UI",
    );
    const labels = await page
      .locator("[aria-label]:visible")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getAttribute("aria-label") !== "日本語")
          .map((node) => node.getAttribute("aria-label")),
      );
    assert.ok(
      !labels.some((label) => japanese.test(label)),
      JSON.stringify(labels),
    );
  }
  await page.goto(url);
  await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  const flags = page.locator(".language-switch button");
  assert.equal(await flags.count(), 2);
  assert.deepEqual(await flags.allTextContents(), ["", ""]);
  assert.equal(await page.locator(".language-switch img").count(), 2);
  await page.getByRole("button", { name: "English", exact: true }).tap();
  await page.getByRole("heading", { name: "One digit at a time." }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "English", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await englishOnly();
  await page.reload();
  await page.getByRole("heading", { name: "One digit at a time." }).waitFor();
  for (const width of [320, 375, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await page
        .locator(".operations button")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.scrollWidth <= node.clientWidth + 1),
        ),
      "Operation labels overflow at " + width,
    );
    for (const flag of await flags.all()) {
      const box = await flag.boundingBox();
      assert.ok(
        Math.round(box.width) >= 44 && Math.round(box.height) >= 44,
        JSON.stringify({ width, box }),
      );
    }
    const layout = await page.locator("header").evaluate((header) => {
      const rect = (selector) => {
        const box = header.querySelector(selector).getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          width: box.width,
          height: box.height,
        };
      };
      return {
        inner: rect(".header-inner"),
        brand: rect(".brand"),
        nav: rect("nav"),
        flags: rect(".language-switch"),
        links: [...header.querySelectorAll("nav a")].map(
          (node) => node.getBoundingClientRect().width,
        ),
      };
    });
    if (width <= 650) {
      assert.ok(
        Math.abs(
          layout.brand.y +
            layout.brand.height / 2 -
            layout.flags.y -
            layout.flags.height / 2,
        ) < 1,
      );
      assert.ok(Math.abs(layout.nav.x - layout.inner.x) < 1);
      assert.ok(Math.abs(layout.nav.width - layout.inner.width) < 1);
      assert.ok(Math.max(...layout.links) - Math.min(...layout.links) < 1);
    } else {
      assert.ok(
        Math.abs(
          layout.nav.y +
            layout.nav.height / 2 -
            layout.flags.y -
            layout.flags.height / 2,
        ) < 1,
      );
      assert.ok(layout.nav.right < layout.flags.x);
    }
    if (width === 1024)
      await page.screenshot({ path: "docs/screenshots/toolbar-desktop.png" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "One digit at a time." }).waitFor();
  await page.screenshot({ path: "docs/screenshots/english-home.png" });
  await page.getByText("More options", { exact: true }).tap();
  await englishOnly();
  await page.getByRole("button", { name: /^Start practice/ }).tap();
  await page.getByRole("button", { name: "Auto ON", exact: true }).waitFor();
  await page.getByRole("button", { name: "Check", exact: true }).tap();
  await page.getByText("Enter a digit here", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Hint", exact: true }).tap();
  await page.getByRole("button", { name: "Show answer", exact: true }).tap();
  await englishOnly();
  for (const p of [
    { op: 0, nums: ["46", "38"] },
    { op: 1, nums: ["100", "1"] },
    { op: 2, nums: ["66", "8"] },
    { op: 2, nums: ["27", "13"] },
    { op: 3, nums: ["220", "6"] },
    { op: 3, nums: ["739.0", "5.0"] },
  ]) {
    const w = worksheet(p),
      data = fresh();
    data.config.op = p.op;
    data.active = start([p]);
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: storageKey, data },
    );
    await page.goto(url + "#/practice");
    await page.reload();
    const first = normalizationSteps(w).count;
    if (w.normalization) {
      for (const label of ["Divisor decimal point", "Dividend decimal point"]) {
        await page.getByRole("slider", { name: label }).waitFor();
        await englishOnly();
        for (let n = 0; n < w.normalization.shift; n++)
          await page
            .getByRole("button", { name: "Move right one place", exact: true })
            .tap();
      }
    }
    await page.getByRole("button", { name: "Auto ON", exact: true }).waitFor();
    for (let i = first; i < w.steps.length; i++) {
      await page
        .locator('[data-step="' + i + '"].active')
        .waitFor({ state: "visible" });
      await englishOnly();
      if (i === first + 1) {
        const before = await page.evaluate(
          (key) => localStorage.getItem(key),
          storageKey,
        );
        await page.getByRole("button", { name: "日本語", exact: true }).tap();
        await page.getByRole("button", { name: "確認", exact: true }).waitFor();
        await page.getByRole("button", { name: "English", exact: true }).tap();
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), storageKey),
          before,
          "Switch changed learning data",
        );
        await page.reload();
        await page
          .locator('[data-step="' + i + '"].active')
          .waitFor({ state: "visible" });
      }
      await page
        .getByRole("button", { name: w.steps[i].value, exact: true })
        .tap();
    }
    await page.getByRole("button", { name: "Check", exact: true }).tap();
    await page.getByText("Correct!", { exact: true }).waitFor();
    if (p.op === 3 && p.nums[0] === "220")
      await page.getByText("Remainder", { exact: true }).waitFor();
    await englishOnly();
    if (p.op === 3)
      await page.screenshot({ path: "docs/screenshots/english-division.png" });
    await page.getByRole("button", { name: "See results" }).tap();
    await page.getByRole("heading", { name: "Practice results" }).waitFor();
    await englishOnly();
    await page.getByRole("link", { name: "History", exact: true }).tap();
    await page.getByRole("heading", { name: "Practice history" }).waitFor();
    await englishOnly();
    console.log(
      "PASS English calculation, switch while answering, saved progress, results and history",
      p.nums.join("/"),
    );
  }
  for (const [slug, title] of [
    ["about", "Help & support"],
    ["privacy", "Privacy & external communication"],
    ["terms", "Terms of use"],
    ["licenses", "Licenses & free use"],
  ]) {
    await page.goto(url + slug + "/index.html");
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await englishOnly();
    await page.getByRole("button", { name: "日本語", exact: true }).tap();
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    await page.getByRole("button", { name: "English", exact: true }).tap();
    await page.reload();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    if (slug === "licenses")
      assert.ok(
        (await page.locator("main").innerText()).includes(
          fs.readFileSync("LICENSE.en", "utf8").trim(),
        ),
      );
    await page.getByRole("link", { name: "← Masu Home", exact: true }).tap();
    await page.getByRole("heading", { name: "One digit at a time." }).waitFor();
  }
  await page.getByRole("link", { name: "Help & support", exact: true }).tap();
  await page
    .getByRole("heading", { name: "Help & support", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "日本語", exact: true }).tap();
  await page.goBack();
  await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  await page.getByRole("button", { name: "English", exact: true }).tap();
  await page.getByRole("link", { name: "Settings", exact: true }).tap();
  await page.getByText("Saved data", { exact: true }).tap();
  await page.getByRole("button", { name: "Delete data", exact: true }).tap();
  await page.getByRole("button", { name: "Cancel", exact: true }).tap();
  await page.getByRole("button", { name: "Delete data", exact: true }).tap();
  await page
    .getByRole("button", { name: "Delete all data", exact: true })
    .tap();
  await page.getByText("Data deleted", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    null,
  );
  await englishOnly();
  await page.evaluate(
    (key) => localStorage.setItem(key, "unsupported"),
    languageKey,
  );
  await page.goto(url);
  await page.reload();
  await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  const blocked = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await blocked.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value() {
        throw Error("blocked");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw Error("blocked");
      },
    });
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(url);
  await blockedPage
    .getByRole("button", { name: "English", exact: true })
    .click();
  await blockedPage
    .getByRole("heading", { name: "One digit at a time." })
    .waitFor();
  await blockedPage.getByRole("button", { name: /^Start practice/ }).click();
  await blockedPage
    .getByRole("button", { name: "Check", exact: true })
    .waitFor();
  await blockedPage.goto(url + "about/index.html");
  await blockedPage
    .getByRole("button", { name: "English", exact: true })
    .click();
  await blockedPage
    .getByRole("heading", { name: "Help & support", exact: true })
    .waitFor();
  await blocked.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  assert.deepEqual(failed, []);
  console.log(
    "PASS flags without text, five widths, language persistence, bilingual policies, English deletion, invalid preference, blocked storage, no external requests/errors",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
