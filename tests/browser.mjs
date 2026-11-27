import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import { worksheet } from "../src/engine.ts";
import { fresh, start, storageKey } from "../src/session.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push(e.message));
const url = "http://127.0.0.1:49831/";
fs.mkdirSync("docs/screenshots", { recursive: true });
try {
  await page.goto(url);
  await page.getByRole("heading", { name: "今日の筆算。" }).waitFor();
  await page.screenshot({ path: "docs/screenshots/home.png" });
  for (const width of [320, 375, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  const problems = [
    { op: 0, nums: ["46", "38"] },
    { op: 1, nums: ["100", "1"] },
    { op: 2, nums: ["27", "13"] },
    { op: 2, nums: ["24", "3"] },
    { op: 3, nums: ["1005", "5"] },
    { op: 3, nums: ["201", "13"] },
    { op: 2, nums: ["12.3", "0.4"] },
    { op: 3, nums: ["1", "8"], fractional: true },
  ];
  for (const p of problems) {
    await page.setViewportSize({ width: 390, height: 844 });
    const data = fresh();
    data.active = start([p]);
    data.config.op = p.op;
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: storageKey, data },
    );
    await page.goto(url + "#/practice");
    await page.reload();
    const w = worksheet(p);
    await page.getByRole("button", { name: "ナビ ON" }).waitFor();
    await page.getByRole("button", { name: "9", exact: true }).click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.items[0].at,
        storageKey,
      ),
      1,
    );
    await page.getByRole("button", { name: "消す", exact: true }).click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.items[0].at,
        storageKey,
      ),
      0,
    );
    await page.getByRole("button", { name: "ナビ ON" }).click();
    await page
      .getByRole("button", { name: w.steps[0].value, exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.items[0].at,
        storageKey,
      ),
      0,
    );
    await page.getByRole("button", { name: "ナビ OFF" }).click();
    // ON selects the next blank. Reload validates persisted answers.
    await page.reload();
    for (let i = 1; i < w.steps.length; i++) {
      if (w.steps[i].phase === "sum" && w.steps[i - 1].phase !== "sum") {
        await page.getByText(w.steps[i].guide, { exact: true }).waitFor();
        await page.screenshot({
          path: "docs/screenshots/multiplication-sum.png",
        });
      }
      if (
        p.nums.join("/") === "201/13" &&
        w.steps[i].guide === "次の数字を下ろす"
      ) {
        const previous = w.steps
          .slice(0, i)
          .findLastIndex((step) => step.guide.endsWith("位の差"));
        const before = await page
          .locator(".board button")
          .nth(previous)
          .boundingBox();
        const down = await page.locator(".board button").nth(i).boundingBox();
        assert.ok(Math.abs(before.y - down.y) < 1);
        assert.ok(down.x > before.x);
        await page.screenshot({
          path: "docs/screenshots/division-bring-down.png",
        });
      }
      await page
        .getByRole("button", { name: w.steps[i].value, exact: true })
        .click();
    }
    await page.getByRole("button", { name: "採点", exact: true }).click();
    await page.getByText("正解です！", { exact: true }).waitFor();
    if (p.op === 3)
      await page.screenshot({ path: "docs/screenshots/division.png" });
    await page.getByRole("button", { name: "結果を見る" }).click();
    await page
      .getByRole("heading", { name: "練習の結果", exact: true })
      .waitFor();
    assert.ok(
      await page.getByText("初回正答率 100%", { exact: false }).count(),
    );
    console.log("PASS UI", p.nums.join("/"));
  }
  await page.goto(url + "#/home");
  await page
    .getByRole("button", { name: "練習をはじめる", exact: false })
    .click();
  await page.getByRole("button", { name: "ナビ ON" }).waitFor();
  await page.reload();
  assert.ok(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).active.items.length === 5,
      storageKey,
    ),
  );
  await page.goto(url + "#/home");
  await page
    .getByRole("button", { name: "練習をはじめる", exact: false })
    .click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  const wrong = fresh();
  wrong.active = start([{ op: 0, nums: ["46", "38"] }]);
  wrong.active.items[0].values = ["9", "9", "9"];
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: storageKey, data: wrong },
  );
  await page.goto(url + "#/practice");
  await page.reload();
  await page.getByRole("button", { name: "採点", exact: true }).click();
  await page.getByText("印のついたマスを見直そう", { exact: true }).waitFor();
  await page.getByRole("button", { name: "ヒント", exact: true }).click();
  await page.getByRole("button", { name: "答えを見る", exact: true }).click();
  for (const digit of ["1", "4", "8"])
    await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "採点", exact: true }).click();
  await page.getByText("正解です！", { exact: true }).waitFor();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.screenshot({ path: "docs/screenshots/practice-mobile.png" });
  await page.getByRole("button", { name: "結果を見る" }).click();
  await page.getByText("初回正答率 0%", { exact: false }).waitFor();
  console.log(
    "PASS home start, replace cancellation, incorrect correction, hints, mobile practice",
  );
  await page.goto(url + "#/settings");
  await page.getByText("保存したデータ", { exact: true }).click();
  await page.getByRole("button", { name: "データを削除", exact: true }).click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  assert.ok(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  );
  await page.getByRole("button", { name: "データを削除", exact: true }).click();
  await page
    .getByRole("button", { name: "すべて削除する", exact: true })
    .click();
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    null,
  );
  for (const slug of ["about", "privacy", "terms", "licenses"]) {
    const response = await page.goto(url + slug + "/index.html");
    assert.equal(response.status(), 200);
  }
  assert.deepEqual(errors, []);
  console.log("PASS responsive widths, persistence, reset, policies, console");
} finally {
  await browser.close();
}
