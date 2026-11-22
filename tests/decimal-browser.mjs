import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { fresh, start, storageKey } from "../src/session.ts";
import { worksheet } from "../src/engine.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const url = "http://127.0.0.1:49831/";
try {
  await page.goto(url);
  for (const nums of [
    ["739.0", "5.0"],
    ["12.5", "5"],
    ["0.12", "0.3"],
    ["1.2", "0.03"],
  ]) {
    const w = worksheet({ op: 3, nums }),
      d = fresh();
    d.config.op = 3;
    d.active = start([{ op: 3, nums }]);
    await page.evaluate(
      ({ data, key }) => localStorage.setItem(key, JSON.stringify(data)),
      { data: d, key: storageKey },
    );
    await page.goto(url + "#/practice");
    await page.reload();
    await page.locator('[data-step="0"].active').waitFor({ state: "visible" });
    assert.equal(await page.locator(".loan,.reduced,.slashed").count(), 0);
    if (nums[0] === "739.0") {
      assert.ok(
        (await page.locator(".normalization").innerText()).includes(
          "7390 ÷ 50",
        ),
      );
      assert.equal(
        (
          await page
            .locator(".division-digits .division-target:not(button)")
            .allTextContents()
        )
          .join("")
          .trim(),
        "",
      );
      await page
        .locator(".scrollboard")
        .screenshot({ path: "docs/screenshots/decimal-739-start.png" });
    }
    for (const [index, step] of w.steps.entries()) {
      await page
        .locator('[data-step="' + index + '"].active')
        .waitFor({ state: "visible" });
      if (nums[0] === "739.0" && index === 6) {
        const digits = await page.locator(".board").innerText();
        assert.ok(!digits.includes("."));
        await page
          .locator(".scrollboard")
          .screenshot({ path: "docs/screenshots/decimal-739-normalized.png" });
      }
      await page.getByRole("button", { name: step.value, exact: true }).click();
    }
    await page.getByRole("button", { name: "確認", exact: true }).click();
    await page.getByText("正解です！", { exact: true }).waitFor();
    assert.equal(await page.locator(".loan,.reduced,.slashed").count(), 0);
    if (nums[0] === "739.0") {
      const quotient = w.steps.filter(
        (s) => s.guide === "商を立てる" || s.guide === "商の小数点",
      );
      assert.equal(quotient.map((s) => s.value).join(""), "147.8");
      await page.locator(".scrollboard").evaluate((el) => (el.scrollTop = 0));
      await page
        .locator(".scrollboard")
        .screenshot({ path: "docs/screenshots/decimal-739-complete.png" });
    }
    console.log("PASS decimal", nums.join(" / "), w.result);
  }
} finally {
  await browser.close();
}
