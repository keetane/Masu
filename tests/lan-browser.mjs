import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { worksheet } from "../src/engine.ts";
import { storageKey } from "../src/session.ts";
const url = process.env.MASU_LAN_URL;
if (!url) throw Error("Set MASU_LAN_URL to the Mac LAN address.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const desktop = await browser.newPage();
  desktop.on("pageerror", (error) => errors.push(error.message));
  await desktop.goto(url);
  assert.equal(await desktop.evaluate(() => window.isSecureContext), false);
  assert.equal(
    await desktop.evaluate(() => typeof crypto.randomUUID),
    "undefined",
  );
  await desktop
    .getByRole("button", { name: "練習をはじめる", exact: false })
    .click();
  await desktop.getByRole("button", { name: "ナビ ON" }).waitFor();
  const desktopState = await desktop.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  assert.match(
    desktopState.active.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await desktop.getByRole("button", { name: "9", exact: true }).click();
  await desktop.reload();
  assert.equal(
    await desktop.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).active.items[0].values[0],
      storageKey,
    ),
    "9",
  );
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(url);
  assert.equal(
    await phone.getByRole("heading", { name: "今日の筆算。" }).count(),
    1,
  );
  await phone.getByRole("button", { name: /わり算/ }).click();
  await phone
    .getByRole("button", { name: "練習をはじめる", exact: false })
    .click();
  await phone.getByRole("button", { name: "ナビ ON" }).waitFor();
  const state = await phone.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  for (let i = 0; i < state.active.items.length; i++) {
    const w = worksheet(state.active.items[i].p);
    for (const step of w.steps)
      await phone.getByRole("button", { name: step.value, exact: true }).tap();
    await phone.getByRole("button", { name: "確認", exact: true }).tap();
    await phone.getByText("正解です！", { exact: true }).waitFor();
    await phone
      .getByRole("button", {
        name:
          i === state.active.items.length - 1 ? "結果を見る →" : "次の問題へ →",
        exact: true,
      })
      .tap();
  }
  await phone
    .getByRole("heading", { name: "練習の結果", exact: true })
    .waitFor();
  await phone.reload();
  await phone
    .getByRole("heading", { name: "練習の結果", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  await phone.screenshot({ path: "docs/screenshots/lan-mobile-result.png" });
  console.log(
    "PASS LAN HTTP, UUID fallback, desktop save/reload, isolated phone storage, touch division session, persisted result, no browser errors",
  );
} finally {
  await browser.close();
}
