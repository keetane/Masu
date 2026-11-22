import { useEffect, useRef } from "react";
import { type Sheet } from "./engine";
import type { Entry } from "./session";
export function Board({
  w,
  e,
  nav = true,
  select,
  solved = false,
}: {
  w: Sheet;
  e: Entry;
  nav?: boolean;
  select?: (n: number) => void;
  solved?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!select) return;
    const box = ref.current,
      active = box?.querySelector<HTMLElement>(".active");
    if (!box || !active) return;
    const b = box.getBoundingClientRect(),
      a = active.getBoundingClientRect();
    if (a.top < b.top || a.bottom > b.bottom)
      box.scrollTop += a.top - b.top - box.clientHeight / 2;
    if (a.left < b.left || a.right > b.right)
      box.scrollLeft += a.left - b.left - box.clientWidth / 2;
  }, [e.at, w, select]);
  const division = !!w.bracket;
  // Main arithmetic rows stay adjacent. Notes share the row of their
  // source number and occupy a small reserved strip above the digits.
  const reached = e.values.reduce(
    (last, value, index) => (value ? Math.max(last, index) : last),
    e.at,
  );
  const showNote = (c: Sheet["cells"][number]) =>
    solved ||
    !select ||
    !nav ||
    c.step === undefined ||
    c.step <= e.at ||
    !!e.values[c.step];
  const mainRows = [
    ...new Set(w.cells.filter((c) => !c.annotation).map((c) => c.row)),
  ]
    .filter((row) => {
      if (!division || solved || !select || !nav || row === w.bracket!.row - 3)
        return true;
      const rowSteps = w.cells.filter(
        (c) => !c.annotation && c.row === row && c.step !== undefined,
      );
      return (
        !rowSteps.length ||
        w.cells.some((c) => c.annotation?.row === row && showNote(c)) ||
        rowSteps.some((c) => c.step! <= e.at || !!e.values[c.step!])
      );
    })
    .sort((a, b) => a - b);
  const displayRow = (row: number) =>
    division ? mainRows.indexOf(row) + 1 : row + 1;
  const noteRows = new Set(
    w.cells
      .filter((c) => c.annotation && showNote(c))
      .map((c) => c.annotation!.row),
  );
  const visibleCell = (c: Sheet["cells"][number]) =>
    (!division || mainRows.includes(c.annotation?.row ?? c.row)) &&
    !(
      c.revealAt !== undefined &&
      select &&
      nav &&
      !solved &&
      reached < c.revealAt
    );
  const visibleCells = w.cells.filter(visibleCell);
  const min = Math.min(...visibleCells.map((c) => c.col));
  const max = Math.max(...visibleCells.map((c) => c.col));
  const first = e.values.indexOf(""),
    active = w.steps[e.at];
  const points = new Set(visibleCells.filter((c) => c.point).map((c) => c.col));
  const track = (col: number) =>
    1 + col - min + [...points].filter((x) => x < col).length;
  const cols = Array.from(
    { length: max - min + 1 },
    (_, i) => "var(--cell)" + (points.has(i + min) ? " 18px" : ""),
  ).join(" ");
  return (
    <div className="scrollboard" ref={ref}>
      {w.normalization && (
        <p className="normalization">
          両方の小数点を右へ{w.normalization.shift}桁動かす
          <br />
          {w.normalization.dividend} ÷ {w.normalization.divisor} にして計算
        </p>
      )}
      <div
        className={"board" + (division ? " division-board" : "")}
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: division
            ? mainRows
                .map((row) => (noteRows.has(row) ? "72px" : "44px"))
                .join(" ")
            : undefined,
        }}
      >
        {w.lines
          .filter(
            (l) =>
              !division ||
              mainRows.includes(l.row === w.bracket!.row ? l.row : l.row - 1),
          )
          .map((l, i) => (
            <span
              key={"l" + i}
              className={"rule" + (division ? " division-rule" : "")}
              style={{
                gridRow: division
                  ? displayRow(l.row === w.bracket!.row ? l.row : l.row - 1)
                  : l.row + 1,
                transform:
                  division && l.row === w.bracket!.row
                    ? "translateY(-42px)"
                    : undefined,
                gridColumn:
                  track(l.left) +
                  " / " +
                  (track(division ? Math.min(l.right, max) : l.right) + 1),
              }}
            />
          ))}
        {w.cells.map((c, i) => {
          if (
            c.revealAt !== undefined &&
            select &&
            nav &&
            !solved &&
            reached < c.revealAt
          )
            return null;
          if (
            division &&
            (!mainRows.includes(c.annotation?.row ?? c.row) ||
              (c.annotation && !showNote(c)))
          )
            return null;
          const sharedNote =
            c.annotation &&
            w.cells.some(
              (other) =>
                other !== c &&
                other.annotation?.row === c.annotation!.row &&
                other.annotation.col === c.annotation!.col &&
                showNote(other),
            );
          const s = c.step,
            val =
              s === undefined
                ? c.text
                : solved
                  ? w.steps[s].value
                  : e.values[s];
          const style = {
            gridRow: displayRow(c.annotation?.row ?? c.row),
            gridColumn: c.span
              ? track(c.col) + " / " + (track(c.col) + c.span)
              : track(c.annotation?.col ?? c.col) + (c.point ? 1 : 0),
          };
          const bad =
            s !== undefined &&
            !solved &&
            (e.checked || (division && !!val)) &&
            val !== w.steps[s].value;
          const cl = [
            "tile",
            c.annotation
              ? "annotation " +
                c.annotation.kind +
                (sharedNote ? " shared-note" : "")
              : "",
            c.span ? "caption" : "",
            c.point ? "point" : "",
            c === w.bracket ? "bracket" : "",
            s !== undefined ? "writable" : "",
            select && s === e.at ? "active" : "",
            select && nav && s === e.at + 1 ? "upcoming" : "",
            select && active.related.includes(c) ? "related" : "",
            c.slash !== undefined && (solved || e.values[c.slash])
              ? "slashed"
              : "",
            bad ? "wrong" : "",
          ].join(" ");
          if (s === undefined || !select)
            return (
              <span key={i} className={cl} style={style} aria-label={c.label}>
                {c === w.bracket ? "" : val}
              </span>
            );
          return (
            <button
              key={i}
              data-step={s}
              className={cl}
              style={style}
              disabled={nav && first !== -1 && s > first && !val}
              tabIndex={e.at === s ? 0 : -1}
              aria-current={s === e.at ? "step" : undefined}
              aria-label={
                c.label + "、" + (val || "未入力") + (bad ? "、見直し" : "")
              }
              onClick={() => select(s)}
            >
              {val || " "}
            </button>
          );
        })}
      </div>
    </div>
  );
}
