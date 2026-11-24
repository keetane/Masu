import test from "node:test";
import assert from "node:assert/strict";
import { translate, isLanguage, readLanguage } from "../src/i18n.ts";
import { worksheet } from "../src/engine.ts";
import { defaults, generate, preset } from "../src/session.ts";
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
test("only supported language preferences are accepted, including blocked storage", () => {
  assert.ok(isLanguage("ja"));
  assert.ok(isLanguage("en"));
  assert.ok(!isLanguage("fr"));
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const [stored, expected] of [
      ["en", "en"],
      ["ja", "ja"],
      [null, "ja"],
      ["fr", "ja"],
    ]) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: { getItem: () => stored },
      });
      assert.equal(readLanguage(), expected);
    }
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw Error("blocked");
      },
    });
    assert.equal(readLanguage(), "ja");
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete globalThis.localStorage;
  }
});
test("dynamic summaries, place values, guides and error feedback translate completely", () => {
  for (const source of [
    "前回の続きから　1 / 5 問",
    "初回正答率 80%　ヒント 2回",
    "最後の足し算・百の位の答え",
    "一万の位の差",
    "　このマスは「8」です。",
    "右へ2桁、同じ数だけ動かそう。",
    "まず、割る数の小数点を右へ1桁ドラッグ",
    "次に、割られる数の小数点を右へ2桁ドラッグ",
    "両方の小数点を右へ1桁動かす",
    "7390 ÷ 50 にして計算",
    "1 / 5 問",
    "1 / 20 マス",
    "1 / 2 操作",
    "5問",
    "初回正解 3問　→",
  ]) {
    assert.ok(!japanese.test(translate(source, "en")), source);
    assert.equal(translate(source, "ja"), source);
  }
  assert.equal(translate("前回の続きから　1 / 5 問", "en"), "Resume · 1 / 5");
});
test("generated arithmetic guides, hints and accessibility labels have English translations", () => {
  const problems = [
    { op: 2, nums: ["0.1", "0.1"] },
    { op: 2, nums: ["9999", "9999"] },
    { op: 3, nums: ["739.0", "5.0"] },
    { op: 3, nums: ["1.2", "0.03"] },
    { op: 3, nums: ["220", "6"] },
    { op: 3, nums: ["1", "8"], fractional: true },
  ];
  for (let op = 0; op < 4; op++)
    for (let level = 0; level < 3; level++)
      for (let seed = 0; seed < 60; seed++)
        problems.push(generate({ ...defaults, ...preset(op, level) }, seed));
  for (const problem of problems) {
    const sheet = worksheet(problem);
    for (const text of [
      ...sheet.cells.map((c) => c.label),
      ...sheet.steps.flatMap((s) => [s.guide, s.hint]),
    ])
      assert.ok(!japanese.test(translate(text, "en")), text);
  }
});
