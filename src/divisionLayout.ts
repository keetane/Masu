import type { Sheet, Cell } from "./engine";
import type { Entry } from "./session";

export const divisionDigitWidth = 44;
export const divisionRowHeight = 52;
export function divisionLayout(
  w: Sheet,
  e: Entry,
  nav: boolean,
  interactive: boolean,
  solved: boolean,
) {
  const reached = e.values.reduce(
    (last, value, i) => (value ? Math.max(last, i) : last),
    e.at,
  );
  const progressive = interactive && nav && !solved;
  const shown = (cell: Cell) =>
    !progressive || cell.revealAt === undefined || cell.revealAt <= reached;
  const notes = w.cells.filter(
    (c) =>
      c.annotation && (!progressive || c.step! <= e.at || !!e.values[c.step!]),
  );
  const rows = [
    ...new Set(w.cells.filter((c) => !c.annotation).map((c) => c.row)),
  ]
    .filter((row) => {
      if (!progressive || row === w.bracket!.row - 3) return true;
      const steps = w.cells.filter(
        (c) => !c.annotation && c.row === row && c.step !== undefined,
      );
      return (
        !steps.length ||
        steps.some((c) => c.step! <= e.at || !!e.values[c.step!]) ||
        notes.some((c) => c.annotation!.row === row)
      );
    })
    .sort((a, b) => a - b);
  const numbers = w.cells.filter(
    (c) => !c.annotation && c !== w.bracket && shown(c) && rows.includes(c.row),
  );
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
