import type { Sheet } from "./engine";
import type { Entry } from "./session";
export type DecimalMove = "divisor" | "dividend" | "reset";
export function normalizationSteps(w: Sheet) {
  const divisor = w.steps.flatMap((step, i) =>
    step.guide === "整数にした割る数" ? [i] : [],
  );
  const dividend = w.steps.flatMap((step, i) =>
    step.guide === "同じ倍率にした割られる数" ? [i] : [],
  );
  return { divisor, dividend, count: divisor.length + dividend.length };
}
export function applyDecimalMove(
  w: Sheet,
  e: Entry,
  move: DecimalMove,
): Partial<Entry> | null {
  const groups = normalizationSteps(w);
  if (!w.normalization || !groups.count) return null;
  const values = e.values.slice();
  if (move === "reset") {
    for (let i = 0; i < groups.count; i++) values[i] = "";
    return { values, at: 0, checked: false };
  }
  if (
    move === "dividend" &&
    !groups.divisor.every((i) => values[i] === w.steps[i].value)
  )
    return null;
  for (const i of groups[move]) values[i] = w.steps[i].value;
  return {
    values,
    at: move === "divisor" ? groups.divisor.length : groups.count,
    checked: false,
  };
}
