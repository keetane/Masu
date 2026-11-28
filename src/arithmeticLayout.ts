import type { Sheet } from "./engine";
import {
  divisionDigitWidth as width,
  divisionRowHeight as height,
} from "./divisionLayout.ts";
export function arithmeticLayout(w: Sheet) {
  const notes = w.cells.filter((cell) => cell.annotation);
  const rows = [
    ...new Set(
      w.cells.filter((cell) => !cell.annotation).map((cell) => cell.row),
    ),
  ].sort((a, b) => a - b);
  const main = w.cells.filter(
    (cell) => !cell.annotation && rows.includes(cell.row),
  );
  const min = Math.min(...w.cells.map((cell) => cell.col));
  const max = Math.max(...w.cells.map((cell) => cell.col));
  const x = (col: number) => (col - min) * width;
  const tracks: number[] = [];
  const positions = new Map<number, { grid: number; top: number }>();
  let top = 0;
  rows.forEach((row, index) => {
    const afterRule =
      index > 0 && w.lines.some((line) => line.row - 1 === rows[index - 1]);
    const hasNotes = w.cells.some((cell) => cell.annotation?.row === row);
    if (afterRule && hasNotes) {
      tracks.push(24);
      top += 24;
    }
    positions.set(row, { grid: tracks.length + 1, top });
    tracks.push(height);
    top += height;
  });
  const y = (row: number) => positions.get(row)!.top;
  const gridRow = (row: number) => positions.get(row)!.grid;
  return {
    numbers: main.filter((cell) => !cell.point),
    points: main.filter((cell) => cell.point),
    notes,
    rows,
    min,
    max,
    x,
    y,
    width:
      (max - min + 1) * width +
      (main.some((cell) => cell.point && cell.col === max) ? 12 : 0),
    height: top,
    tracks,
    gridRow,
    lines: w.lines.filter((line) => rows.includes(line.row - 1)),
  };
}
