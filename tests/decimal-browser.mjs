import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { fresh, start, storageKey } from "../src/session.ts";
import { worksheet } from "../src/engine.ts";
import { normalizationSteps } from "../src/normalization.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const url = "http://127.0.0.1:49831/";
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function drag(kind, shift, touch = false, wrong = false) {
  const handle = page.getByRole("slider", {
    name: (kind === "divisor" ? "除数" : "被除数") + "の小数点",
  });
  const b = await handle.boundingBox(),
    x = b.x + b.width / 2,
    y = b.y + b.height / 2,
    dx = wrong ? -36 : 36 * shift;
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + dx, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 8 });
    await page.mouse.up();
  }
}
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
    const groups = normalizationSteps(w);
    if (w.normalization) {
      await page.getByRole("slider", { name: "除数の小数点" }).waitFor();
      assert.equal(
        await page.getByRole("slider", { name: "被除数の小数点" }).count(),
        0,
      );
      const handle = page.getByRole("slider", { name: "除数の小数点" });
      assert.equal(
        await handle.evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgba(0, 0, 0, 0)",
      );
      assert.equal(
        await handle.evaluate((el) => getComputedStyle(el, "::before").width),
        "18px",
      );

      assert.equal(
        await page
          .locator('[data-operand="divisor"] .decimal-digits')
          .textContent(),
        nums[1].replace(".", ""),
      );
      assert.equal(
        await page
          .locator('[data-operand="dividend"] .decimal-digits')
          .textContent(),
        nums[0].replace(".", ""),
      );
      if (nums[0] === "739.0") {
        for (const width of [320, 375, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          assert.ok(
            await page
              .locator(".normalization-scroll")
              .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          );
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page
          .locator(".normalization-card")
          .screenshot({ path: "docs/screenshots/decimal-739-start.png" });
        await drag("divisor", 1, false, true);
        assert.equal(
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)).active.items[0].at,
            storageKey,
          ),
          0,
        );
        await page
          .getByRole("status")
          .filter({ hasText: "同じ数だけ" })
          .waitFor();
      }
      if (nums[1] === "0.03") {
        const slider = page.getByRole("slider", { name: "除数の小数点" });
        await slider.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
      } else await drag("divisor", w.normalization.shift, nums[0] === "0.12");
      await page.getByRole("slider", { name: "被除数の小数点" }).waitFor();
      if (nums[0] === "739.0") {
        await page
          .getByRole("button", { name: "小数点の移動をやり直す" })
          .click();
        await page.getByRole("slider", { name: "除数の小数点" }).waitFor();
        await drag("divisor", 1);
        await page.reload();
        await page.getByRole("slider", { name: "被除数の小数点" }).waitFor();
        await page.locator(".normalization-card").screenshot({
          path: "docs/screenshots/decimal-739-after-divisor.png",
        });
      }
      if (nums[1] === "0.03") {
        for (let i = 0; i < w.normalization.shift; i++)
          await page
            .getByRole("button", { name: "右へ1桁動かす", exact: true })
            .click();
      } else await drag("dividend", w.normalization.shift, nums[0] === "0.12");
      await page.getByRole("button", { name: "ナビ ON" }).waitFor();
      if (nums[0] === "739.0")
        await page
          .locator(".scrollboard")
          .screenshot({ path: "docs/screenshots/decimal-739-normalized.png" });
    }
    for (let index = groups.count; index < w.steps.length; index++) {
      await page
        .locator('[data-step="' + index + '"].active')
        .waitFor({ state: "visible" });
      await page
        .getByRole("button", { name: w.steps[index].value, exact: true })
        .click();
    }
    await page.getByRole("button", { name: "採点", exact: true }).click();
    await page.getByText("正解です！", { exact: true }).waitFor();
    assert.equal(await page.locator(".loan,.reduced,.slashed").count(), 0);
    if (nums[0] === "739.0") {
      assert.equal(
        w.steps
          .filter((s) => s.guide === "商を立てる" || s.guide === "商の小数点")
          .map((s) => s.value)
          .join(""),
        "147.8",
      );
      await page.locator(".scrollboard").evaluate((el) => (el.scrollTop = 0));
      await page
        .locator(".scrollboard")
        .screenshot({ path: "docs/screenshots/decimal-739-complete.png" });
    }
    console.log("PASS decimal", nums.join("/"), w.result);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS pointer drag, invalid drop, touch drag, keyboard, button alternative, reset, reload after divisor",
  );
} finally {
  await browser.close();
}
