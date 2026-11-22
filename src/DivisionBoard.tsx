import type { CSSProperties } from "react";
import type { Cell } from "./engine";
import type { BoardProps } from "./Board";
import {
  divisionLayout,
  divisionDigitWidth,
  divisionRowHeight,
} from "./divisionLayout";
import { useBoardScroll } from "./useBoardScroll";

export function DivisionBoard({
  w,
  e,
  nav = true,
  select,
  solved = false,
}: BoardProps) {
  const ref = useBoardScroll(e.at, w, select);
  const layout = divisionLayout(w, e, nav, !!select, solved);
  const first = e.values.indexOf("");
  function renderCell(cell: Cell, layer: "number" | "point" | "note") {
    const step = cell.step,
      value =
        step === undefined
          ? cell.text
          : solved
            ? w.steps[step].value
            : e.values[step];
    const active = !!select && step === e.at;
    const bad =
      step !== undefined && !solved && !!value && value !== w.steps[step].value;
    const related = !!select && w.steps[e.at].related.includes(cell);
    const classes = [
      "division-target",
      layer,
      cell.span ? "caption" : "",
      active ? "active" : "",
      related ? "related" : "",
      bad ? "wrong" : "",
    ].join(" ");
    let style: CSSProperties;
    if (layer === "number") {
      style = {
        gridRow: layout.rows.indexOf(cell.row) + 1,
        gridColumn: cell.col - layout.min + 1 + " / span " + (cell.span ?? 1),
      };
    } else if (layer === "point") {
      style = {
        left: layout.x(cell.col) + divisionDigitWidth - 10,
        top: layout.y(cell.row) + 10,
      };
    } else {
      const anchor = cell.annotation!;
      style = {
        left: layout.x(anchor.col) + 10,
        top: layout.y(anchor.row) - 12,
      };
    }
    const key = w.cells.indexOf(cell);
    if (step === undefined || !select)
      return (
        <span
          key={key}
          className={classes}
          style={style}
          aria-label={cell.label}
        >
          {value}
        </span>
      );
    return (
      <button
        key={key}
        className={classes}
        style={style}
        data-step={step}
        disabled={nav && first !== -1 && step > first && !value}
        tabIndex={active ? 0 : -1}
        aria-current={active ? "step" : undefined}
        aria-label={
          cell.label + "、" + (value || "未入力") + (bad ? "、見直し" : "")
        }
        onClick={() => select(step)}
      >
        {value || " "}
      </button>
    );
  }
  const top = layout.y(w.bracket!.row),
    left = layout.x(0);
  return (
    <div className="scrollboard division-paper" ref={ref}>
      {w.normalization && (
        <p className="normalization">
          両方の小数点を右へ{w.normalization.shift}桁動かす
          <br />
          {w.normalization.dividend} ÷ {w.normalization.divisor} にして計算
        </p>
      )}
      <div
        className="board division-sheet"
        style={{ width: layout.width, height: layout.height }}
      >
        <div
          className="division-digits"
          style={{
            gridTemplateColumns:
              "repeat(" +
              (layout.max - layout.min + 1) +
              ", " +
              divisionDigitWidth +
              "px)",
            gridTemplateRows:
              "repeat(" + layout.rows.length + ", " + divisionRowHeight + "px)",
          }}
        >
          {layout.numbers.map((cell) => renderCell(cell, "number"))}
        </div>
        <div className="division-points">
          {layout.points.map((cell) => renderCell(cell, "point"))}
        </div>
        <div className="division-notes">
          {layout.notes.map((cell) => renderCell(cell, "note"))}
        </div>
        <svg
          className="division-rules"
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          <path
            className="bracket"
            d={
              "M " +
              (left - 14) +
              " " +
              (top + 1) +
              " Q " +
              left +
              " " +
              (top + 1) +
              " " +
              left +
              " " +
              (top + 14) +
              " V " +
              (top + 44)
            }
          />
          {layout.lines.map((line, i) => {
            const header = line.row === w.bracket!.row;
            const y = header
              ? top + 1
              : layout.y(line.row - 1) + divisionRowHeight - 1;
            return (
              <path
                key={i}
                d={
                  "M " +
                  layout.x(line.left) +
                  " " +
                  y +
                  " H " +
                  (layout.x(Math.min(line.right, layout.max)) +
                    divisionDigitWidth)
                }
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
