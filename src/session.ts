import { worksheet, type Op, type Problem } from "./engine.ts";
export type Config = {
  op: Op;
  a: number;
  b: number;
  da: number;
  db: number;
  terms: number;
  count: number;
  rem: string;
  nav: boolean;
  motion: boolean;
  level: number;
};
export const defaults: Config = {
  op: 0,
  a: 2,
  b: 2,
  da: 0,
  db: 0,
  terms: 2,
  count: 5,
  rem: "mixed",
  nav: true,
  motion: true,
  level: 1,
};
export function preset(op: Op, level: number): Partial<Config> {
  return {
    op,
    level,
    a: (op === 3 ? [2, 3, 4] : [1, 2, 3])[level],
    b: (op === 3 || op === 2 ? [1, 1, 2] : [1, 2, 3])[level],
    terms: 2,
    da: 0,
    db: 0,
    rem: "mixed",
  };
}
const int = (x: unknown, min: number, max: number) =>
  Number.isInteger(x) && Number(x) >= min && Number(x) <= max;
export function validConfig(c: Config) {
  if (
    !c ||
    !int(c.op, 0, 3) ||
    !int(c.level, -1, 2) ||
    !int(c.terms, 2, 3) ||
    ![5, 10, 20].includes(c.count) ||
    !["with", "without", "mixed"].includes(c.rem) ||
    typeof c.nav !== "boolean" ||
    typeof c.motion !== "boolean"
  )
    return false;
  const max = c.op === 3 ? 5 : c.op === 2 ? 4 : 3;
  return [
    [c.a, c.da],
    [c.b, c.db],
  ].every(
    ([n, d]) =>
      int(n, c.op === 3 ? 0 : 1, max) &&
      int(d, 0, c.op === 3 ? 5 : c.op === 2 ? 1 : 0) &&
      n + d >= 1 &&
      n + d <= 5,
  );
}
function fraction(n: number, k: number) {
  if (!k) return String(n);
  const s = String(n).padStart(k + 1, "0");
  return s.slice(0, -k) + "." + s.slice(-k);
}
export function generate(c: Config, seed: number): Problem {
  if (!validConfig(c))
    throw Error("桁数を見直してください。各数は合計5桁までです。");
  function random(lo: number, hi: number) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return lo + Math.floor((seed / 4294967296) * (hi - lo + 1));
  }
  const range = (n: number, d: number) => [
    (n <= 1 && d === 0) || n === 0 ? 0 : 10 ** (n + d - 1),
    10 ** (n + d) - 1,
  ];
  const [al, ah] = range(c.a, c.da),
    [bl, bh] = range(c.b, c.db);
  const decimal = !!(c.da || c.db);
  for (let i = 0; i <= 100; i++) {
    let a = random(al, ah),
      b = random(bl, bh);
    if (c.op === 1) {
      if (ah < bl) break;
      a = random(Math.max(al, bl), ah);
      b = random(bl, Math.min(a, bh));
    }
    if (c.op === 3) {
      b = Math.max(1, b);
      if (decimal) {
        // A power of two/five times a power of ten always yields a terminating quotient.
        const divisors: number[] = [];
        for (let x = 1; x <= bh; x *= 2)
          for (let y = x; y <= bh; y *= 5) if (y >= bl) divisors.push(y);
        b = divisors[random(0, divisors.length - 1)];
      } else if (c.rem === "without") {
        if (i === 100) b = Math.max(bl, 1);
        const min = Math.ceil(al / b),
          max = Math.floor(ah / b);
        if (min > max) continue;
        a = random(min, max) * b;
      } else if (c.rem === "with") {
        if (i === 100) {
          b = Math.max(bl, 2);
          a = al % b ? al : al + 1;
        }
        if (a > ah || a % b === 0) continue;
      }
    }
    const nums = [fraction(a, c.da), fraction(b, c.db)];
    if (c.op === 0 && c.terms === 3) nums.push(String(random(al, ah)));
    const p = { op: c.op, nums, fractional: decimal };
    try {
      worksheet(p);
      return p;
    } catch {
      continue;
    }
  }
  throw Error(
    "この桁数と条件では出題できません。桁数か余りの設定を変えてください。",
  );
}
export type Entry = {
  engineRevision?: 2 | 3;
  p: Problem;
  values: string[];
  at: number;
  first: boolean | null;
  checked: boolean;
  hints: number;
  revealed: boolean;
};
export type Session = { items: Entry[]; index: number; id: string };
export type Data = {
  version: 1;
  config: Config;
  active: Session | null;
  history: Session[];
};
export const fresh = (): Data => ({
  version: 1,
  config: { ...defaults },
  active: null,
  history: [],
});
export const entry = (p: Problem): Entry => ({
  engineRevision: 3,
  p,
  values: worksheet(p).steps.map(() => ""),
  at: 0,
  first: null,
  checked: false,
  hints: 0,
  revealed: false,
});
export function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // LAN HTTP pages still provide getRandomValues, even without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
export function start(items: Problem[]): Session {
  return { items: items.map(entry), index: 0, id: createSessionId() };
}
export function validSession(s: Session): boolean {
  if (
    !s ||
    !Array.isArray(s.items) ||
    !int(s.items.length, 1, 20) ||
    !int(s.index, 0, s.items.length - 1) ||
    typeof s.id !== "string" ||
    s.id.length > 80
  )
    return false;
  return s.items.every((e) => {
    try {
      const w = worksheet(e.p);
      return (
        Array.isArray(e.values) &&
        e.values.length === w.steps.length &&
        e.values.every(
          (v, i) =>
            typeof v === "string" &&
            (v === "" ||
              (w.steps[i].value === "." ? v === "." : /^[0-9]$/.test(v))),
        ) &&
        int(e.at, 0, w.steps.length - 1) &&
        int(e.hints, 0, 1000000) &&
        typeof e.checked === "boolean" &&
        typeof e.revealed === "boolean" &&
        (e.first === null || typeof e.first === "boolean")
      );
    } catch {
      return false;
    }
  });
}

// Match previous worksheet sequences before validating, preserving answers
// when multiplication gains sum steps or division drops borrow notes.
export function upgradeSession(session: Session): Session {
  if (!session || !Array.isArray(session.items)) return session;
  return {
    ...session,
    items: session.items.map((item) => {
      if (!item || item.engineRevision === 3) return item;
      if (item.p?.op === 3 && Array.isArray(item.values)) {
        try {
          const previous = worksheet(item.p, { divisionBorrowNotes: true });
          const current = worksheet(item.p);
          if (item.values.length === current.steps.length)
            return { ...item, engineRevision: 3 as const };
          if (item.values.length !== previous.steps.length) return item;
          const key = (step: (typeof current.steps)[number]) =>
            [step.guide, step.cell.row, step.cell.col, !!step.cell.point].join(
              ":",
            );
          const oldIndex = new Map(
            previous.steps.map((step, index) => [key(step), index]),
          );
          const indices = current.steps.map((step) => oldIndex.get(key(step))!);
          const at = indices.findIndex((index) => index >= item.at);
          return {
            ...item,
            engineRevision: 3 as const,
            values: indices.map((index) => item.values[index]),
            at: at < 0 ? current.steps.length - 1 : at,
          };
        } catch {
          return item;
        }
      }
      if (item.engineRevision === 2)
        return { ...item, engineRevision: 3 as const };
      try {
        const sheet = worksheet(item.p);
        const singleDigit =
          item.p.op === 2 &&
          String(Number(item.p.nums[1].replace(".", ""))).length === 1;
        const sumSteps = sheet.steps.filter((step) => step.phase === "sum");
        if (
          !singleDigit ||
          !Array.isArray(item.values) ||
          item.values.length !== sheet.steps.length - sumSteps.length
        )
          return item;
        let oldIndex = 0;
        const oldToNew: number[] = [];
        const values = sheet.steps.map((step, index) => {
          if (step.phase === "sum") {
            if (!item.checked) return "";
            const partial = sheet.steps.findIndex(
              (other) =>
                other.phase !== "sum" &&
                !other.cell.point &&
                other.cell.col === step.cell.col &&
                other.cell.row === 4,
            );
            const prior = oldToNew.indexOf(partial);
            return prior >= 0 ? item.values[prior] : "";
          }
          oldToNew[oldIndex] = index;
          return item.values[oldIndex++];
        });
        return {
          ...item,
          engineRevision: 3 as const,
          values,
          at: oldToNew[item.at] ?? 0,
        };
      } catch {
        return item;
      }
    }),
  };
}

export const storageKey = "masu:v1:workbook";
export function load(): { data: Data; warning: string } {
  const data = fresh();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { data, warning: "" };
    if (raw.length > 3000000) throw Error();
    const obj = JSON.parse(raw);
    if (obj?.version !== 1) throw Error();
    if (validConfig(obj.config)) data.config = obj.config;
    if (Array.isArray(obj.history))
      data.history = limitHistory(
        obj.history.slice(0, 30).map(upgradeSession).filter(validSession),
      );
    if (obj.active) obj.active = upgradeSession(obj.active);
    if (obj.active && !validSession(obj.active))
      return {
        data,
        warning: "途中の記録を読み込めませんでした。新しい練習を始められます。",
      };
    data.active = obj.active || null;
    return { data, warning: "" };
  } catch {
    return {
      data,
      warning: "保存領域を読み込めません。練習はこの画面で続けられます。",
    };
  }
}

export function limitHistory(history: Session[]): Session[] {
  let questions = 0;
  return history.slice(0, 30).filter((session) => {
    if (questions + session.items.length > 100) return false;
    questions += session.items.length;
    return true;
  });
}
