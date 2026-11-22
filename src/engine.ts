// Columns increase to the right. Auxiliary rows are real cells, so their
// values, focus order and deletion obey the same rules as answer digits.
export const names = ["足し算", "引き算", "かけ算", "わり算"] as const;
export const signs = ["＋", "−", "×", "÷"] as const;
export type Op = 0 | 1 | 2 | 3;
export type Problem = { op: Op; nums: string[]; fractional?: boolean };
export type Cell = {
  row: number;
  col: number;
  text: string;
  label: string;
  step?: number;
  slash?: number;
  point?: boolean;
  annotation?: { row: number; col: number; kind: "loan" | "reduced" | "carry" };
  span?: number;
  revealAt?: number;
};
export type Step = {
  cell: Cell;
  value: string;
  guide: string;
  hint: string;
  related: Cell[];
  phase?: "sum";
};
export type Sheet = ReturnType<typeof worksheet>;
const digits = (n: number) => Array.from(String(n), Number).reverse();
const scale = (s: string) => s.split(".")[1]?.length ?? 0;
const coeff = (s: string) => Number(s.replace(".", ""));
const place = (p: number) =>
  ["一", "十", "百", "千", "一万", "十万", "百万", "千万"][p] ??
  String(10 ** p);
export function worksheet(
  problem: Problem,
  options: { divisionBorrowNotes?: boolean } = {},
) {
  const { op, nums } = problem;
  if (
    ![0, 1, 2, 3].includes(op) ||
    nums.length < 2 ||
    nums.length > (op === 0 ? 3 : 2) ||
    nums.some(
      (s) =>
        typeof s !== "string" ||
        !/^(0|[1-9]\d{0,4})(\.\d{1,5})?$/.test(s) ||
        s.replace(/^0\./, "").replace(".", "").length > 5,
    )
  )
    throw Error("問題の数値が範囲外です");
  const [a, b] = nums.map(coeff);
  if (
    (op < 2 && nums.some((s) => scale(s) > 0)) ||
    (op === 1 && a < b) ||
    (op === 3 && b === 0)
  )
    throw Error("出題できない式です");
  const cells: Cell[] = [],
    steps: Step[] = [],
    lines: { row: number; left: number; right: number }[] = [];
  let bracket: Cell | undefined;
  let normalization:
    | { dividend: string; divisor: string; shift: number }
    | undefined;
  function cell(
    row: number,
    col: number,
    text: string,
    label: string,
    point = false,
  ) {
    const c: Cell = { row, col, text, label, point };
    cells.push(c);
    return c;
  }
  function fixedNumber(s: string, row: number, end = 0) {
    const characters = s.replace(".", "");
    const start = end - characters.length + 1;
    if (s.includes("."))
      cell(row, start + s.indexOf(".") - 1, ".", "小数点", true);
    return Array.from(characters, (v, i) =>
      cell(row, start + i, v, "問題の数字"),
    );
  }
  function write(
    row: number,
    col: number,
    value: number | string,
    guide: string,
    hint: string,
    related: Cell[] = [],
    point = false,
  ) {
    const c = cell(row, col, "", guide, point);
    c.step = steps.length;
    steps.push({ cell: c, value: String(value), guide, hint, related });
    return c;
  }
  function sum(values: number[], refs: Cell[][], row: number, aux: number) {
    const total = values.reduce((x, y) => x + y, 0),
      ds = values.map(digits);
    let carry = 0,
      previous: Cell | undefined;
    const width = Math.max(...ds.map((d) => d.length));
    for (let p = 0; p < width; p++) {
      const addends = ds.map((d) => d[p] ?? 0),
        n = carry + addends.reduce((x, y) => x + y, 0);
      const related = refs.flat().filter((c) => c.col === -p);
      if (previous) related.push(previous);
      const hint =
        [...addends, ...(carry ? [carry] : [])].join(" ＋ ") + " を計算しよう";
      carry = Math.floor(n / 10);
      previous = undefined;
      if (carry)
        previous = write(
          p + 1 === width ? row : aux,
          -p - 1,
          carry,
          "次の位への繰り上がり",
          hint,
          related,
        );
      write(row, -p, n % 10, place(p) + "の位の答え", hint, related);
    }
    return String(total);
  }
  function difference(
    top: number,
    bot: number,
    end: number,
    row: number,
    source: Cell[],
    bottom: Cell[],
    reducedRow: number,
    tenRow: number,
    anchorRow?: number,
  ) {
    const working = digits(top),
      lower = digits(bot),
      result = top - bot;
    const current = [...source].reverse();
    for (let p = 0; p < working.length; p++) {
      const sub = lower[p] ?? 0;
      if (working[p] < sub) {
        let donor = p + 1;
        while (!working[donor]) donor++;
        for (let k = donor; k > p; k--) {
          working[k]--;
          working[k - 1] += 10;
          if (anchorRow !== undefined && !options.divisionBorrowNotes) continue;
          const origin = current[k];
          const loan = write(
            tenRow,
            end - k + 1,
            1,
            "借りた1",
            "左の位から10を借りよう",
            origin ? [origin] : [],
          );
          if (anchorRow !== undefined)
            loan.annotation = {
              row: anchorRow,
              col: end - k + 1,
              kind: "loan",
            };
          if (origin) origin.slash = loan.step;
          current[k] = write(
            reducedRow,
            end - k,
            working[k],
            "借り元の数字",
            "貸した位を1減らそう",
            [loan],
          );
          if (anchorRow !== undefined)
            current[k].annotation = {
              row: anchorRow,
              col: end - k,
              kind: "reduced",
            };
          current[k - 1] = loan;
        }
      }
      if (p < String(result).length)
        write(
          row,
          end - p,
          working[p] - sub,
          place(p) + "の位の差",
          working[p] + " から " + sub + " を引こう",
          [
            current[p],
            source.find((c) => c.col === end - p),
            bottom.find((c) => c.col === end - p),
          ].filter((c): c is Cell => !!c),
        );
    }
  }
  function product(
    top: number,
    m: number,
    end: number,
    row: number,
    refs: Cell[],
    compact = false,
  ) {
    let carry = 0;
    const ds = digits(top),
      out: Cell[] = [];
    if (!m)
      return [
        write(row, end, 0, "部分積", "0をかけるといくつになるかな", refs),
      ];
    ds.forEach((d, p) => {
      const n = d * m + carry;
      const hint =
        d + " × " + m + (carry ? " ＋ " + carry : "") + " を計算しよう";
      carry = Math.floor(n / 10);
      if (carry) {
        const last = p + 1 === ds.length;
        const c = write(
          last ? row : row - 1,
          end - p - 1,
          carry,
          last ? "積の左端" : "積の繰り上がり",
          hint,
          refs,
        );
        if (compact && !last)
          c.annotation = { row, col: end - p - 1, kind: "carry" };
        if (last) out.push(c);
      }
      out.push(write(row, end - p, n % 10, "積の数字", hint, refs));
    });
    return out.sort((x, y) => x.col - y.col);
  }
  let result = "",
    remainder = 0;
  const expr = nums.join(" " + signs[op] + " ");
  if (op < 2) {
    const refs = nums.map((s, i) => fixedNumber(s, 2 + i));
    const endRow = 2 + nums.length;
    const left = -Math.max(
      ...nums.map((s) => s.length),
      String(op === 0 ? nums.reduce((n, s) => n + Number(s), 0) : a - b).length,
    );
    cell(endRow - 1, left, signs[op], "演算記号");
    lines.push({ row: endRow, left, right: 0 });
    if (op === 0) result = sum(nums.map(Number), refs, endRow + 1, 0);
    else {
      difference(a, b, 0, 6, refs[0], refs[1], 0, 1);
      result = String(a - b);
    }
  } else if (op === 2) {
    const refs = nums.map((s, i) => fixedNumber(s, i));
    const width = Math.max(
      ...nums.map((s) => s.replace(".", "").length),
      String(a * b).length,
      scale(nums[0]) + scale(nums[1]) + 1,
    );
    cell(1, -width, "×", "演算記号");
    lines.push({ row: 2, left: -width, right: 0 });
    const factors = digits(b),
      parts: number[] = [],
      rows: Cell[][] = [];
    factors.forEach((m, p) => {
      rows.push(
        product(a, m, -p, 4 + 2 * p, [
          ...refs[0],
          refs[1][refs[1].length - 1 - p],
        ]),
      );
      parts.push(a * m * 10 ** p);
    });
    const last = 4 + 2 * (factors.length - 1),
      final = last + 3;
    cell(last, -width, "＋", "部分積を足す");
    lines.push({ row: last + 1, left: -width, right: 0 });
    const sumStart = steps.length;
    sum(parts, rows, final, final - 1);
    for (const step of steps.slice(sumStart)) {
      step.phase = "sum";
      step.guide = "最後の足し算・" + step.guide;
      step.cell.label = step.guide;
    }
    const decimals = scale(nums[0]) + scale(nums[1]);
    const raw = String(a * b).padStart(decimals + 1, "0");
    if (decimals) {
      for (let p = String(a * b).length; p < raw.length; p++)
        write(final, -p, 0, "小数の位取り", "小数点に必要な0を書こう");
      write(
        final,
        -decimals,
        ".",
        "積の小数点",
        "かける数とかけられる数の小数の桁数を合わせよう",
        [],
        true,
      );
    }
    result = decimals
      ? raw.slice(0, -decimals) + "." + raw.slice(-decimals)
      : raw;
  } else {
    const shift = scale(nums[1]),
      remScale = Math.max(0, scale(nums[0]) - shift);
    const dividend = a * 10 ** Math.max(0, shift - scale(nums[0])),
      divisor = b;
    let raw = String(dividend).padStart(remScale + 1, "0"),
      integerLength = raw.length - remScale;
    const decimal = !!problem.fractional || nums.some((s) => scale(s) > 0);
    const topRow = shift ? 6 : 3;
    let normalized: Cell[] = [];
    const divisorEnd = -2;
    if (shift) {
      normalization = {
        dividend: remScale
          ? raw.slice(0, integerLength) + "." + raw.slice(integerLength)
          : raw,
        divisor: String(divisor),
        shift,
      };
      Array.from(String(divisor), (d, i) =>
        write(
          topRow,
          divisorEnd - String(divisor).length + 1 + i,
          d,
          "整数にした割る数",
          "小数点を右に" + shift + "桁移そう",
        ),
      );
      normalized = Array.from(raw, (d, i) =>
        write(
          topRow,
          i,
          d,
          "同じ倍率にした割られる数",
          "割る数と同じだけ小数点を動かそう",
        ),
      );
    } else {
      fixedNumber(String(divisor), topRow, divisorEnd);
      normalized = Array.from(raw, (d, i) => cell(topRow, i, d, "割られる数"));
    }
    if (remScale) cell(topRow, integerLength - 1, ".", "小数点", true);
    bracket = cell(topRow, -1, "⟌", "割り算の括弧");
    let working = 0,
      cycle = 0,
      q = "",
      r = 0,
      prev: Cell[] = [];
    for (let i = 0; i < raw.length || (decimal && r > 0); i++) {
      if (i >= 22) throw Error("有限小数で表せる範囲を超えました");
      if (i === raw.length) {
        raw += "0";
        const zero = cell(topRow, i, "0", "補った0");
        zero.revealAt = steps.length;
        normalized.push(zero);
      }
      if (i === integerLength) {
        if (!remScale) {
          const point = cell(
            topRow,
            integerLength - 1,
            ".",
            "補った小数点",
            true,
          );
          point.revealAt = steps.length;
        }
        const quotientPoint = write(
          topRow - 3,
          i - 1,
          ".",
          "商の小数点",
          "割られる数の小数点にそろえよう",
          [],
          true,
        );
        quotientPoint.revealAt = quotientPoint.step;
        q += ".";
      }
      const next = Number(raw[i]);
      working = r * 10 + next;
      if (cycle)
        prev.push(
          write(
            topRow + cycle * 7,
            i,
            next,
            "次の数字を下ろす",
            "割られる数の次の桁を見よう",
            [normalized[i]],
          ),
        );
      if (!cycle && working < divisor && i < integerLength - 1) {
        r = working;
        continue;
      }
      const digit = Math.floor(working / divisor);
      q += String(digit);
      const quotient = write(
        topRow - 3,
        i,
        digit,
        "商を立てる",
        working + " に " + divisor + " がいくつ入るかな",
        [normalized[i]],
      );
      quotient.revealAt = quotient.step;
      r = working % divisor;
      if (dividend === 0) break;
      const base = topRow + cycle * 7;
      const prod = product(divisor, digit, i, base + 3, [quotient], true);
      cell(base + 3, i - String(working).length, "−", "途中の引き算");
      lines.push({
        row: base + 4,
        left: i - String(working).length + 1,
        right: i,
      });
      const source = cycle
        ? prev
        : normalized.slice(i - String(working).length + 1, i + 1);
      difference(
        working,
        divisor * digit,
        i,
        base + 7,
        source,
        prod,
        base - 2,
        base - 1,
        base,
      );
      prev = cells
        .filter((c) => c.row === base + 7)
        .sort((x, y) => x.col - y.col);
      cycle++;
    }
    lines.push({ row: topRow, left: 0, right: raw.length - 1 });
    result = q;
    remainder = r;
    if (r) {
      const row = topRow + cycle * 7 + 2;
      cell(row, -2, "余り", "余り").span = 2;
      Array.from(String(r), (d, i) =>
        write(row, i, d, "最後の余り", "最後の差を書こう"),
      );
    }
  }
  return {
    cells,
    steps,
    lines,
    bracket,
    normalization,
    result,
    remainder,
    expr,
  };
}
