import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import { serveDistribution } from "./static-server.mjs";
import { fresh, start, storageKey } from "../src/session.ts";
import { worksheet } from "../src/engine.ts";
const server = await serveDistribution();
const origin = "http://127.0.0.1:" + server.address().port,
  base = origin + "/Masu-test/";
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedReport = text;
        },
      },
    });
  });
  const page = await context.newPage(),
    errors = [],
    outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin + "/") && !r.url().startsWith("blob:"))
      outside.push(r.url());
  });
  await page.goto(base);
  const p = { op: 2, nums: ["66", "8"] },
    w = worksheet(p),
    data = fresh();
  data.config.op = 2;
  data.active = start([p]);
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: storageKey, data },
  );
  await page.goto(base + "#/practice");
  await page.reload();
  await page.getByRole("button", { name: w.steps[0].value, exact: true }).tap();
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  const screenshot = await page.screenshot({ type: "png" });
  await page
    .getByRole("button", { name: "スクショで不具合を報告", exact: true })
    .tap();
  const dialog = page.getByRole("dialog", { name: "スクショで不具合を報告" });
  await dialog.waitFor();
  const input = dialog.locator('input[type="file"]'),
    description = dialog.getByRole("textbox", {
      name: "起きたこと（必須）",
      exact: true,
    }),
    draft = dialog.getByRole("textbox", {
      name: "報告文（送る前に確認）",
      exact: true,
    });
  assert.ok(
    await dialog
      .getByRole("button", { name: "報告メールを開く", exact: true })
      .isDisabled(),
  );
  await description.pressSequentially("Bug 123");
  await description.press("Backspace");
  await description.press("ArrowLeft");
  await description.press("Enter");
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    before,
    "Typing in report changed arithmetic answers",
  );
  await input.setInputFiles({
    name: "test.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await dialog.getByRole("alert").filter({ hasText: "PNG" }).waitFor();
  await input.setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await dialog
    .getByRole("alert")
    .filter({ hasText: "画像を読み込めません" })
    .waitFor();
  await input.setInputFiles({
    name: "empty.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(0),
  });
  await dialog.getByRole("alert").filter({ hasText: "10MB" }).waitFor();
  await input.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await dialog.getByRole("alert").filter({ hasText: "10MB" }).waitFor();
  await input.setInputFiles({
    name: "private-name.png",
    mimeType: "image/png",
    buffer: screenshot,
  });
  await dialog
    .getByRole("img", { name: "選んだスクショのプレビュー" })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "スクショと報告文を共有" })
      .count(),
    0,
  );
  assert.ok(!(await draft.inputValue()).includes(w.expr));
  await dialog
    .getByRole("checkbox", { name: "現在の問題と入力位置を報告に含める" })
    .check();
  assert.ok((await draft.inputValue()).includes(w.expr));
  assert.ok(!(await draft.inputValue()).includes("private-name.png"));
  await dialog
    .getByRole("checkbox", {
      name: "ブラウザ・画面サイズ・表示言語を報告に含める",
    })
    .uncheck();
  assert.ok(!(await draft.inputValue()).includes("Mozilla"));
  const email = new URL(
    await dialog
      .getByRole("link", { name: "報告メールを開く", exact: true })
      .getAttribute("href"),
  );
  assert.equal(email.pathname, "nobodyknowsxx@gmail.com");
  assert.equal(email.searchParams.get("body"), await draft.inputValue());
  assert.ok((await dialog.innerText()).includes("画像を自動添付できません"));
  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("link", { name: "スクショを保存", exact: true })
    .click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "masu-bug-report.png");
  assert.deepEqual(fs.readFileSync(await download.path()), screenshot);
  await dialog
    .getByRole("button", { name: "報告文をコピー", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => window.__copiedReport),
    await draft.inputValue(),
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    before,
  );
  assert.ok(
    await page
      .getByRole("button", { name: "スクショで不具合を報告", exact: true })
      .evaluate((node) => document.activeElement === node),
  );
  await page
    .getByRole("button", { name: "スクショで不具合を報告", exact: true })
    .tap();
  await dialog.waitFor();
  assert.ok((await description.inputValue()).includes("Bug"));
  await dialog
    .getByRole("img", { name: "選んだスクショのプレビュー" })
    .waitFor();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    window.__shareMode = "cancel";
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        window.__sharedReport = {
          text: data.text,
          files: await Promise.all(
            data.files.map(async (file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
              bytes: [...new Uint8Array(await file.arrayBuffer())].slice(0, 8),
            })),
          ),
        };
        if (window.__shareMode === "cancel")
          throw new DOMException("cancelled", "AbortError");
        if (window.__shareMode === "error")
          throw new DOMException("blocked", "NotAllowedError");
      },
    });
  });
  await description.fill("Shared bug 123");
  const share = dialog.getByRole("button", {
    name: "スクショと報告文を共有",
    exact: true,
  });
  await share.click();
  await dialog
    .getByRole("status")
    .filter({ hasText: "共有をキャンセルしました" })
    .waitFor();
  assert.equal(await description.inputValue(), "Shared bug 123");
  await page.evaluate(() => {
    window.__shareMode = "error";
  });
  await share.click();
  await dialog
    .getByRole("status")
    .filter({ hasText: "共有できませんでした" })
    .waitFor();
  await page.evaluate(() => {
    window.__shareMode = "success";
  });
  await share.click();
  await dialog
    .getByRole("status")
    .filter({ hasText: "共有先に渡しました" })
    .waitFor();
  const shared = await page.evaluate(() => window.__sharedReport);
  assert.ok(shared.text.includes("nobodyknowsxx@gmail.com"));
  assert.ok(shared.text.includes(w.expr));
  assert.deepEqual(shared.files, [
    {
      name: "masu-bug-report.png",
      type: "image/png",
      size: screenshot.length,
      bytes: [137, 80, 78, 71, 13, 10, 26, 10],
    },
  ]);
  await dialog
    .getByRole("checkbox", {
      name: "ブラウザ・画面サイズ・表示言語を報告に含める",
    })
    .check();
  assert.equal(await dialog.locator(".report-status").count(), 0);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    }),
  );
  await dialog
    .getByRole("button", { name: "報告文をコピー", exact: true })
    .click();
  await dialog
    .getByRole("status")
    .filter({ hasText: "手動でコピー" })
    .waitFor();
  assert.ok(
    await draft.evaluate(
      (node) =>
        document.activeElement === node &&
        node.selectionStart === 0 &&
        node.selectionEnd === node.value.length,
    ),
  );
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).tap();
  await page
    .getByRole("button", {
      name: "Report a bug with a screenshot",
      exact: true,
    })
    .tap();
  const en = page.getByRole("dialog", {
    name: "Report a bug with a screenshot",
  });
  await en.waitFor();
  await en
    .getByRole("textbox", { name: "What happened (required)", exact: true })
    .fill("Digits are misplaced 123");
  await en.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Home", exact: true }).tap();
  await page.getByRole("heading", { name: "One digit at a time." }).waitFor();
  await page
    .getByRole("button", {
      name: "Report a bug with a screenshot",
      exact: true,
    })
    .tap();
  assert.ok(
    (
      await en
        .getByRole("textbox", {
          name: "Report text (review before sending)",
          exact: true,
        })
        .inputValue()
    ).includes(w.expr),
  );
  assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(await en.innerText()));
  for (const width of [320, 390, 651, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await en.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.ok(
      await en.evaluate((node) => node.scrollWidth <= node.clientWidth),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await en.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.screenshot({ path: "docs/screenshots/bug-report-mobile.png" });
  await en.getByRole("button", { name: "Close", exact: true }).click();
  for (const width of [320, 390, 651, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(
      await page.locator("header nav > a, header nav > button").count(),
      4,
    );
  }
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    before,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  console.log(
    "PASS screenshot preview/validation/download, safe report context, keyboard isolation, clipboard and email fallback, mocked share/cancel/failure, JA/EN, modal focus and responsive menu; no automatic requests or sends",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
