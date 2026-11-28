import type { Sheet } from "./engine";

export const divisionDigitWidth = 44;
export const divisionRowHeight = 52;
export function divisionLayout(w: Sheet) {
  const notes = w.cells.filter((c) => c.annotation);
  const rows = [
    ...new Set(w.cells.filter((c) => !c.annotation).map((c) => c.row)),
  ].sort((a, b) => a - b);
  const numbers = w.cells.filter((c) => !c.annotation && c !== w.bracket);
  const all = [...numbers, ...notes];
  const min = Math.min(
    w.bracket!.col,
    ...all.map((c) => c.annotation?.col ?? c.col),
  );
  const max = Math.max(...all.map((c) => c.col + (c.span ?? 1) - 1));
  const x = (col: number) => (col - min) * divisionDigitWidth;
  const y = (row: number) => rows.indexOf(row) * divisionRowHeight;
  const lastPoint = numbers.some((c) => c.point && c.col === max);
  return {
    numbers: numbers.filter((c) => !c.point),
    points: numbers.filter((c) => c.point),
    notes,
    rows,
    min,
    max,
    x,
    y,
    width: (max - min + 1) * divisionDigitWidth + (lastPoint ? 12 : 0),
    height: rows.length * divisionRowHeight,
    tracks: rows.map(() => divisionRowHeight),
    gridRow: (row: number) => rows.indexOf(row) + 1,
    lines: w.lines.filter((l) =>
      rows.includes(l.row === w.bracket!.row ? l.row : l.row - 1),
    ),
  };
}
