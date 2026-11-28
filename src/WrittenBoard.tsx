import { arithmeticLayout } from "./arithmeticLayout";
import { DivisionMark } from "./DivisionMark";
import { DivisionNormalization } from "./DivisionNormalization";
import { normalizationSteps } from "./normalization";
import type { CSSProperties } from "react";
import type { Cell } from "./engine";
import type { BoardProps } from "./Board";
import {
  divisionLayout,
  divisionDigitWidth,
  divisionRowHeight,
} from "./divisionLayout";
import { useBoardScroll } from "./useBoardScroll";
import { useI18n } from "./Language";

export function WrittenBoard({
  w,
  e,
  nav = true,
  select,
  solved = false,
  onNormalize,
}: BoardProps) {
  const { t, language } = useI18n();
  const separator = language === "ja" ? "、" : ", ";
  const ref = useBoardScroll(e.at, w, select);
  const layout = w.bracket ? divisionLayout(w) : arithmeticLayout(w);
  const normalizing = !!(
    w.normalization &&
    onNormalize &&
    select &&
    e.at < normalizationSteps(w).count
  );
  const first = e.values.indexOf("");
  function renderCell(cell: Cell, layer: "number" | "point" | "note") {
    const step = cell.step,
      value =
        step === undefined
          ? cell.text
          : solved
            ? w.steps[step].value
            : e.values[step];
    const active = !!select && !normalizing && step === e.at;
    const bad =
      step !== undefined &&
      !solved &&
      e.checked &&
      value !== w.steps[step].value;
    const related =
      !!select &&
      !solved &&
      !normalizing &&
      cell !== w.steps[e.at].cell &&
      w.steps[e.at].related.includes(cell);
    const classes = [
      "division-target",
      layer,
      cell.span ? "caption" : "",
      step !== undefined ? "answer-cell" : "",
      active ? "active" : "",
      related ? "related" : "",
      bad ? "wrong" : "",
      cell.slash !== undefined && (solved || !!e.values[cell.slash])
        ? "slashed"
        : "",
    ].join(" ");
    let style: CSSProperties;
    if (layer === "number") {
      style = {
        gridRow: layout.gridRow(cell.row),
        gridColumn: cell.col - layout.min + 1 + " / span " + (cell.span ?? 1),
      };
    } else if (layer === "point") {
      style = {
        left: layout.x(cell.col) + divisionDigitWidth - 10,
        top: layout.y(cell.row) + 10,
      };
    } else {
      const anchor = cell.annotation!;
      const peers = layout.notes.filter(
        (note) =>
          note.annotation!.row === anchor.row &&
          note.annotation!.col === anchor.col,
      );
      const slot = peers.indexOf(cell);
      style = {
        left: layout.x(anchor.col) + (peers.length > 1 ? slot * 22 : 10),
        width: peers.length > 1 ? 22 : 24,
        top: layout.y(anchor.row) - 12,
      };
    }
    const key = w.cells.indexOf(cell);
    if (step === undefined || !select)
      return (
        <span
          key={key}
          data-cell={key}
          className={classes}
          style={style}
          aria-label={t(cell.label)}
        >
          {value === "余り" ? t("余り") : value}
        </span>
      );
    return (
      <button
        key={key}
        data-cell={key}
        className={classes}
        style={style}
        data-step={step}
        disabled={
          normalizing || (nav && first !== -1 && step > first && !value)
        }
        tabIndex={active ? 0 : -1}
        aria-current={active ? "step" : undefined}
        aria-label={
          t(cell.label) +
          separator +
          (value || t("未入力")) +
          (bad ? separator + t("見直し") : "")
        }
        onClick={() => select(step)}
      >
        {value || " "}
      </button>
    );
  }
  const top = w.bracket ? layout.y(w.bracket.row) : 0,
    left = layout.x(0);
  return (
    <div className="board-stage">
      {normalizing && (
        <DivisionNormalization w={w} e={e} onNormalize={onNormalize} />
      )}
      <div className="scrollboard division-paper" ref={ref}>
        {w.normalization && !normalizing && (
          <p className="normalization">
            {t("両方の小数点を右へ" + w.normalization.shift + "桁動かす")}
            <br />
            {t(
              w.normalization.dividend +
                " ÷ " +
                w.normalization.divisor +
                " にして計算",
            )}
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
              gridTemplateRows: layout.tracks
                .map((size) => size + "px")
                .join(" "),
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
            {w.bracket && (
              <DivisionMark
                left={left}
                top={top + 2}
                right={layout.x(layout.max) + divisionDigitWidth}
              />
            )}
            {layout.lines
              .filter((line) => !w.bracket || line.row !== w.bracket.row)
              .map((line, i) => {
                const y = layout.y(line.row - 1) + divisionRowHeight - 1;
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
    </div>
  );
}
