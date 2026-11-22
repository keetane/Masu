import test from "node:test";
import assert from "node:assert/strict";
import { worksheet } from "../src/engine.ts";
import {
  entry,
  validSession,
  defaults,
  generate,
  start,
  load,
  storageKey,
} from "../src/session.ts";
const cases = [
  [0, ["46", "38"], "84"],
  [0, ["99", "1"], "100"],
  [0, ["99", "99", "99"], "297"],
  [1, ["100", "1"], "99"],
  [1, ["302", "178"], "124"],
  [1, ["100", "100"], "0"],
  [2, ["27", "13"], "351"],
  [2, ["105", "20"], "2100"],
  [2, ["99", "99"], "9801"],
  [2, ["0", "7"], "0"],
  [3, ["1005", "5"], "201"],
  [3, ["123", "12"], "10", 3],
  [3, ["3", "5"], "0", 3],
  [3, ["0", "7"], "0"],
  [2, ["12.3", "0.4"], "4.92"],
  [3, ["1.2", "0.3"], "4"],
  [3, ["1", "8"], "0.125", 0, true],
  [3, ["12.50", "0.5"], "25.0"],
  [2, ["0.1", "0.1"], "0.01"],
];
for (const [op, nums, out, rem = 0, fractional = false] of cases)
  test(nums.join(" / "), () => {
    const w = worksheet({ op, nums, fractional });
    assert.equal(w.result, out);
    assert.equal(w.remainder, rem);
    assert.ok(w.steps.length);
    assert.ok(w.steps.every((x) => /^[0-9.]$/.test(x.value)));
    const coords = new Set();
    for (const c of w.cells) {
      const k = [c.row, c.col, !!c.point].join(":");
      assert.ok(!coords.has(k), "overlapping cell " + k);
      coords.add(k);
    }
  });
test("carry and cascading borrow order", () => {
  assert.deepEqual(
    worksheet({ op: 0, nums: ["46", "38"] }).steps.map((s) => s.value),
    ["1", "4", "8"],
  );
  assert.deepEqual(
    worksheet({ op: 1, nums: ["100", "1"] }).steps.map((s) => s.value),
    ["1", "0", "1", "9", "9", "9"],
  );
});
test("seeded generation, exact integer and fractional identities", () => {
  for (let seed = 0; seed < 120; seed++)
    for (const op of [0, 1, 2, 3]) {
      const cfg = {
        ...defaults,
        op,
        da: op >= 2 ? seed % 2 : 0,
        db: op >= 2 ? Math.floor(seed / 2) % 2 : 0,
        terms: (seed % 2) + 2,
      };
      const p = generate(cfg, seed),
        w = worksheet(p),
        ns = p.nums.map(Number);
      assert.deepEqual(p, generate(cfg, seed));
      const n = Number(w.result);
      if (op === 3) assert.ok(Math.abs(ns[0] - ns[1] * n - w.remainder) < 1e-8);
      else
        assert.ok(
          Math.abs(
            n -
              (op === 2
                ? ns[0] * ns[1]
                : op === 1
                  ? ns[0] - ns[1]
                  : ns.reduce((a, b) => a + b)),
          ) < 1e-8,
        );
    }
});
test("invalid and incompatible settings", () => {
  assert.throws(() => worksheet({ op: 3, nums: ["0", "0"] }));
  assert.throws(() => generate({ ...defaults, op: 1, a: 1, b: 3 }, 15));
  assert.throws(() => generate({ ...defaults, op: 3, a: 0, da: 0 }, 1));
});
test("storage validation and recovery", () => {
  const s = start([{ op: 2, nums: ["3", "6"] }]);
  assert.ok(validSession(s));
  s.items[0].values[0] = "<";
  assert.equal(validSession(s), false);
  globalThis.localStorage = {
    getItem: (key) => {
      assert.equal(key, storageKey);
      return "{";
    },
  };
  assert.ok(load().warning);
  assert.deepEqual(entry({ op: 0, nums: ["1", "2"] }).values, [""]);
});
test("4000 generated layouts keep distinct cells", () => {
  for (let seed = 0; seed < 1000; seed++)
    for (const op of [0, 1, 2, 3]) {
      const p = generate({ ...defaults, op, a: 3, b: op === 1 ? 3 : 2 }, seed),
        w = worksheet(p),
        seen = new Set();
      for (const c of w.cells) {
        const key = [c.row, c.col, !!c.point].join(":");
        assert.ok(!seen.has(key), JSON.stringify(p));
        seen.add(key);
      }
    }
});
test("history is limited to 100 review questions", async () => {
  const { limitHistory } = await import("../src/session.ts");
  const session = start(
    Array.from({ length: 20 }, () => ({ op: 0, nums: ["1", "2"] })),
  );
  assert.equal(
    limitHistory(Array.from({ length: 30 }, () => session)).length,
    5,
  );
});
test("multiplication finishes all partial products before summing each place", () => {
  for (const nums of [
    ["27", "13"],
    ["24", "3"],
    ["105", "20"],
    ["12.3", "0.4"],
  ]) {
    const w = worksheet({ op: 2, nums });
    const first = w.steps.findIndex((s) => s.phase === "sum");
    assert.ok(first > 0);
    const lastPartial = w.steps.filter(
      (s) =>
        s.cell.row < w.steps[first].cell.row &&
        s.phase !== "sum" &&
        !s.cell.point,
    );
    assert.ok(lastPartial.every((s) => w.steps.indexOf(s) < first));
    const finalDigits = w.steps.filter(
      (s) => s.phase === "sum" && !s.guide.includes("繰り上がり"),
    );
    assert.equal(
      finalDigits
        .map((s) => s.value)
        .reverse()
        .join(""),
      String(
        Number(nums[0].replace(".", "")) * Number(nums[1].replace(".", "")),
      ),
    );
    assert.ok(w.cells.some((c) => c.text === "＋"));
  }
});
test("division omits borrow notes and bring-down shares the remainder row", () => {
  const w = worksheet({ op: 3, nums: ["201", "13"] });
  assert.ok(
    !w.steps.some((s) => s.guide === "借りた1" || s.guide === "借り元の数字"),
  );
  assert.ok(!w.cells.some((c) => c.slash !== undefined));
  const original = w.cells.filter((c) => c.label === "割られる数");

  const firstDifference = w.steps.find((s) => s.guide.endsWith("位の差"));
  const down = w.steps.find((s) => s.guide === "次の数字を下ろす");
  assert.equal(firstDifference.value, "7");
  assert.equal(down.value, "1");
  assert.equal(down.cell.row, firstDifference.cell.row);
  assert.equal(down.cell.col, firstDifference.cell.col + 1);
  assert.equal(down.related[0].col, down.cell.col);
  const products = w.steps.filter((s) => s.guide === "積の数字");
  assert.ok(original[0].row < products[0].cell.row);
  assert.ok(products[0].cell.row < firstDifference.cell.row);
  assert.ok(w.steps.indexOf(firstDifference) < w.steps.indexOf(down));
});
test("old single-digit multiplication answers survive the inserted sum phase", async () => {
  const { upgradeSession } = await import("../src/session.ts");
  for (const nums of [
    ["24", "3"],
    ["0.1", "0.1"],
  ]) {
    const p = { op: 2, nums },
      w = worksheet(p),
      legacy = w.steps.filter((s) => s.phase !== "sum");
    const old = {
      id: "old",
      index: 0,
      items: [
        {
          p,
          values: legacy.map((s) => s.value),
          at: legacy.length - 1,
          checked: true,
          first: true,
          hints: 0,
          revealed: false,
        },
      ],
    };
    const migrated = upgradeSession(old);
    assert.ok(validSession(migrated));
    assert.ok(
      migrated.items[0].values.every((value, i) => value === w.steps[i].value),
    );
    assert.deepEqual(upgradeSession(migrated), migrated);
    old.items[0].checked = false;
    const pending = upgradeSession(old);
    assert.ok(
      w.steps.filter(
        (step, i) => step.phase === "sum" && pending.items[0].values[i] === "",
      ).length,
    );
  }
});
test("220 divided by 6 follows 22-18, bring down 0, 40-36, remainder 4", () => {
  const w = worksheet({ op: 3, nums: ["220", "6"] });
  assert.equal(w.result, "36");
  assert.equal(w.remainder, 4);
  assert.deepEqual(
    w.steps.map((s) => s.value),
    ["3", "1", "8", "4", "0", "6", "3", "6", "4", "4"],
  );
  assert.equal(w.steps[3].cell.row, w.steps[4].cell.row);
  assert.equal(w.steps[4].cell.col, 2);
  assert.equal(w.steps[4].related[0].col, 2);
  assert.ok(
    !w.steps.some(
      (s) =>
        s.cell.annotation?.kind === "loan" ||
        s.cell.annotation?.kind === "reduced",
    ),
  );
  assert.equal(w.cells.find((c) => c.label === "余り").span, 2);
});
test("division visual notes anchor to their operands without adding main rows", () => {
  for (const nums of [
    ["220", "6"],
    ["201", "13"],
    ["1005", "5"],
    ["1000", "16"],
    ["1.2", "0.3"],
  ]) {
    const w = worksheet({ op: 3, nums });
    for (const c of w.cells.filter((c) => c.annotation)) {
      const anchor = w.cells.find(
        (other) =>
          !other.annotation &&
          other.row === c.annotation.row &&
          other.col === c.annotation.col &&
          !other.point,
      );
      assert.ok(anchor, JSON.stringify({ nums, c }));
    }
  }
});
test("decimal division starts with a separate normalized expression", () => {
  const w = worksheet({ op: 3, nums: ["739.0", "5.0"] });
  assert.equal(w.result, "147.8");
  assert.deepEqual(w.normalization, {
    dividend: "7390",
    divisor: "50",
    shift: 1,
  });
  assert.ok(!w.cells.some((c) => c.row === 0));
  assert.equal(
    w.steps
      .filter((s) => s.guide === "同じ倍率にした割られる数")
      .map((s) => s.value)
      .join(""),
    "7390",
  );
  assert.ok(
    w.cells
      .filter((c) => c.label === "補った0" || c.label === "補った小数点")
      .every((c) => c.revealAt > 0),
  );
  assert.ok(
    !w.steps.some((s) => s.guide === "借りた1" || s.guide === "借り元の数字"),
  );
});
test("division saved answers survive removal of borrow steps", async () => {
  const { upgradeSession } = await import("../src/session.ts");
  for (const nums of [
    ["220", "6"],
    ["739.0", "5.0"],
    ["1000", "16"],
  ]) {
    const p = { op: 3, nums },
      old = worksheet(p, { divisionBorrowNotes: true });
    const session = {
      id: "legacy",
      index: 0,
      items: [
        {
          engineRevision: 2,
          p,
          values: old.steps.map((s) => s.value),
          at: old.steps.length - 1,
          first: true,
          checked: true,
          hints: 0,
          revealed: false,
        },
      ],
    };
    const migrated = upgradeSession(session);
    assert.ok(validSession(migrated));
    assert.deepEqual(
      migrated.items[0].values,
      worksheet(p).steps.map((s) => s.value),
    );
    assert.equal(migrated.items[0].first, true);
    assert.deepEqual(upgradeSession(migrated), migrated);
  }
});
test("division layers keep digit columns fixed when a decimal point appears", async () => {
  const { divisionLayout } = await import("../src/divisionLayout.ts");
  const w = worksheet({ op: 3, nums: ["739.0", "5.0"] }),
    e = entry({ op: 3, nums: ["739.0", "5.0"] });
  const before = divisionLayout(w, e, true, true, false);
  const point = w.steps.findIndex((s) => s.guide === "商の小数点");
  e.at = point;
  const after = divisionLayout(w, e, true, true, false);
  assert.equal(before.x(2) - before.x(1), 44);
  assert.equal(after.x(2) - after.x(1), 44);
  assert.equal(before.x(1), after.x(1));
  assert.ok(after.points.length > before.points.length);
});
test("carry notes share their digit's row without increasing row spacing", async () => {
  const { divisionLayout } = await import("../src/divisionLayout.ts");
  const p = { op: 3, nums: ["1000", "16"] },
    w = worksheet(p),
    e = entry(p);
  e.at = w.steps.findIndex((s) => s.cell.annotation?.kind === "carry");
  const layout = divisionLayout(w, e, true, true, false),
    note = layout.notes.find((c) => c.step === e.at);
  assert.ok(note);
  assert.ok(layout.rows.includes(note.annotation.row));
  assert.ok(layout.height >= layout.rows.length * 52);
  assert.equal(
    layout.y(note.annotation.row),
    layout.rows.indexOf(note.annotation.row) * 52,
  );
});
test("normalization moves divisor before dividend and preserves later answers", async () => {
  const { normalizationSteps, applyDecimalMove } =
    await import("../src/normalization.ts");
  const p = { op: 3, nums: ["739.0", "5.0"] },
    w = worksheet(p),
    e = entry(p),
    groups = normalizationSteps(w);
  assert.equal(applyDecimalMove(w, e, "dividend"), null);
  e.values[groups.count] = "9";
  const afterDivisor = { ...e, ...applyDecimalMove(w, e, "divisor") };
  assert.equal(afterDivisor.at, 2);
  assert.deepEqual(afterDivisor.values.slice(0, 2), ["5", "0"]);
  assert.ok(afterDivisor.values.slice(2, 6).every((v) => v === ""));
  const done = {
    ...afterDivisor,
    ...applyDecimalMove(w, afterDivisor, "dividend"),
  };
  assert.equal(done.at, 6);
  assert.deepEqual(done.values.slice(0, 6), ["5", "0", "7", "3", "9", "0"]);
  assert.equal(done.values[6], "9");
  assert.ok(validSession({ id: "test", index: 0, items: [done] }));
  const reset = { ...done, ...applyDecimalMove(w, done, "reset") };
  assert.equal(reset.at, 0);
  assert.ok(reset.values.slice(0, 6).every((v) => v === ""));
  assert.equal(reset.values[6], "9");
});
test("session IDs also work without secure-context randomUUID", async () => {
  const { createSessionId } = await import("../src/session.ts");
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    const ids = new Set(Array.from({ length: 100 }, () => createSessionId()));
    assert.equal(ids.size, 100);
    for (const id of ids)
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  } finally {
    Object.defineProperty(crypto, "randomUUID", {
      value: original,
      configurable: true,
    });
  }
});
test("all arithmetic layouts use compact source rows and separate annotations", async () => {
  const { arithmeticLayout } = await import("../src/arithmeticLayout.ts");
  for (const p of [
    { op: 0, nums: ["46", "38"] },
    { op: 1, nums: ["100", "1"] },
    { op: 2, nums: ["99", "99"] },
  ]) {
    const w = worksheet(p),
      e = entry(p);
    e.values = w.steps.map((s) => s.value);
    e.at = w.steps.length - 1;
    const layout = arithmeticLayout(w, e, true, true, false);
    assert.ok(layout.numbers.every((c) => !c.annotation));
    assert.ok(layout.notes.every((c) => c.annotation));
    assert.ok(layout.height >= layout.rows.length * 52);
    assert.equal(layout.x(0) - layout.x(-1), 44);
    assert.ok(layout.rows.length <= 5);
    if (p.op === 1)
      assert.equal(
        layout.notes.filter((c) => c.annotation.col === -1).length,
        2,
      );
    if (p.op === 2) {
      assert.ok(layout.notes.every((c) => w.steps[c.step].phase === "sum"));
      e.at = w.steps.findIndex((s) => s.phase === "sum") - 1;
      assert.ok(
        arithmeticLayout(w, e, true, true, false).notes.every(
          (c) => w.steps[c.step].phase !== "sum",
        ),
      );
    }
  }
});
test("multiplication leaves room for carry notes after the operand rule", async () => {
  const { arithmeticLayout } = await import("../src/arithmeticLayout.ts");
  const p = { op: 2, nums: ["27", "13"] },
    w = worksheet(p),
    e = entry(p);
  e.values = w.steps.map((step) => step.value);
  e.at = w.steps.findIndex((step) => step.phase === "sum");
  const layout = arithmeticLayout(w, e, true, true, false);
  assert.ok(layout.y(4) - layout.y(1) >= 76);
  assert.ok(
    layout.notes.every(
      (note) => layout.y(note.annotation.row) - 12 > layout.y(1) + 51,
    ),
  );
});
