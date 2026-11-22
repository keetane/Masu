import type { Sheet } from "./engine";
import type { Entry } from "./session";
import { DivisionBoard } from "./DivisionBoard";
import { useBoardScroll } from "./useBoardScroll";
export type BoardProps = {
  w: Sheet;
  e: Entry;
  nav?: boolean;
  select?: (n: number) => void;
  solved?: boolean;
};
export function Board(props: BoardProps) {
  return props.w.bracket ? (
    <DivisionBoard {...props} />
  ) : (
    <GridBoard {...props} />
  );
}
function GridBoard({ w, e, nav = true, select, solved = false }: BoardProps) {
  const ref = useBoardScroll(e.at, w, select);
  const min = Math.min(...w.cells.map((c) => c.col)),
    max = Math.max(...w.cells.map((c) => c.col));
  const points = new Set(w.cells.filter((c) => c.point).map((c) => c.col));
  const track = (col: number) =>
    1 + col - min + [...points].filter((x) => x < col).length;
  const cols = Array.from(
    { length: max - min + 1 },
    (_, i) => "var(--cell)" + (points.has(i + min) ? " 18px" : ""),
  ).join(" ");
  const first = e.values.indexOf(""),
    active = w.steps[e.at];
  return (
    <div className="scrollboard" ref={ref}>
      <div className="board" style={{ gridTemplateColumns: cols }}>
        {w.lines.map((line, i) => (
          <span
            key={i}
            className="rule"
            style={{
              gridRow: line.row + 1,
              gridColumn: track(line.left) + " / " + (track(line.right) + 1),
            }}
          />
        ))}
        {w.cells.map((cell, i) => {
          const step = cell.step,
            value =
              step === undefined
                ? cell.text
                : solved
                  ? w.steps[step].value
                  : e.values[step];
          const bad =
            step !== undefined &&
            !solved &&
            e.checked &&
            value !== w.steps[step].value;
          const classes = [
            "tile",
            step !== undefined ? "writable" : "",
            cell.point ? "point" : "",
            select && step === e.at ? "active" : "",
            select && nav && step === e.at + 1 ? "upcoming" : "",
            select && active.related.includes(cell) ? "related" : "",
            cell.slash !== undefined && (solved || e.values[cell.slash])
              ? "slashed"
              : "",
            bad ? "wrong" : "",
          ].join(" ");
          const style = {
            gridRow: cell.row + 1,
            gridColumn: track(cell.col) + (cell.point ? 1 : 0),
          };
          if (step === undefined || !select)
            return (
              <span
                key={i}
                className={classes}
                style={style}
                aria-label={cell.label}
              >
                {value}
              </span>
            );
          return (
            <button
              key={i}
              data-step={step}
              className={classes}
              style={style}
              disabled={nav && first !== -1 && step > first && !value}
              tabIndex={e.at === step ? 0 : -1}
              aria-current={e.at === step ? "step" : undefined}
              aria-label={
                cell.label +
                "、" +
                (value || "未入力") +
                (bad ? "、見直し" : "")
              }
              onClick={() => select(step)}
            >
              {value || " "}
            </button>
          );
        })}
      </div>
    </div>
  );
}
