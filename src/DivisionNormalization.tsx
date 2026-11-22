import { useEffect, useRef, useState } from "react";
import type { BoardProps } from "./Board";
import { normalizationSteps, type DecimalMove } from "./normalization";
const digitWidth = 36;
function Operand({
  value,
  normalized,
  shift,
  label,
  kind,
  active,
  moved,
  onMove,
}: {
  value: string;
  normalized: string;
  shift: number;
  label: string;
  kind: "divisor" | "dividend";
  active: boolean;
  moved: boolean;
  onMove: (move: DecimalMove) => void;
}) {
  const initial = value.includes(".") ? value.indexOf(".") : value.length;
  const target = initial + shift;
  const [draft, setDraft] = useState<number | null>(null),
    [message, setMessage] = useState("");
  const drag = useRef<{ id: number; x: number; point: number } | null>(null);
  useEffect(() => {
    setDraft(null);
    setMessage("");
    drag.current = null;
  }, [active, moved]);
  const original = value.replace(".", "");
  const number = moved
    ? normalized.replace(".", "")
    : original.padEnd(
        active ? Math.max(original.length, target) : original.length,
        "0",
      );
  const point = moved
    ? normalized.includes(".")
      ? normalized.indexOf(".")
      : number.length
    : (draft ?? initial);
  function commit(candidate: number) {
    setDraft(null);
    if (candidate === target) {
      setMessage("");
      onMove(kind);
    } else setMessage("右へ" + shift + "桁、同じ数だけ動かそう。");
  }
  function advance() {
    const next = Math.min(target, (draft ?? initial) + 1);
    if (next === target) commit(next);
    else setDraft(next);
  }
  const showPoint = moved
    ? normalized.includes(".")
    : value.includes(".") || active;
  return (
    <div
      className={"normalization-operand " + (active ? "current" : "")}
      data-operand={kind}
      style={{ width: number.length * digitWidth + 24 }}
    >
      <span className="operand-label">{label}</span>
      <div
        className="decimal-operand"
        style={{ width: number.length * digitWidth + 24 }}
      >
        <div className="decimal-digits">
          {Array.from(number, (n, i) => (
            <span
              key={i}
              className={i >= original.length && !moved ? "added-zero" : ""}
            >
              {n}
            </span>
          ))}
        </div>
        {active && (
          <span
            className="decimal-destination"
            data-drop={kind}
            style={{ left: 12 + target * digitWidth - 12 }}
            aria-hidden="true"
          />
        )}
        {showPoint &&
          (active ? (
            <button
              role="slider"
              className="decimal-handle"
              aria-label={label + "の小数点"}
              aria-valuemin={initial}
              aria-valuemax={target}
              aria-valuenow={point}
              aria-valuetext={"右へ" + shift + "桁"}
              style={{ left: point * digitWidth - 10 }}
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                drag.current = { id: event.pointerId, x: event.clientX, point };
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                if (!start || start.id !== event.pointerId) return;
                const next = Math.max(
                  initial,
                  Math.min(
                    target,
                    Math.round(
                      start.point + (event.clientX - start.x) / digitWidth,
                    ),
                  ),
                );
                setDraft(next);
              }}
              onPointerUp={(event) => {
                const start = drag.current;
                if (!start || start.id !== event.pointerId) return;
                drag.current = null;
                const next = Math.round(
                  start.point + (event.clientX - start.x) / digitWidth,
                );
                commit(next);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDraft(null);
                setMessage("移動をキャンセルしました。");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  event.stopPropagation();
                  advance();
                }
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  event.stopPropagation();
                  setDraft(Math.max(initial, point - 1));
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  commit(point);
                }
              }}
            >
              .
            </button>
          ) : (
            <span
              className="decimal-fixed"
              style={{ left: 12 + point * digitWidth - 9 }}
            >
              .
            </span>
          ))}
      </div>
      {active && (
        <button className="move-one" onClick={advance}>
          右へ1桁動かす
        </button>
      )}
      {message && (
        <p className="drag-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function DivisionNormalization({ w, e, onNormalize }: BoardProps) {
  const groups = normalizationSteps(w),
    divisorTurn = e.at < groups.divisor.length;
  return (
    <section className="normalization-card" aria-label="小数点の移動">
      <p className="drag-instruction" aria-live="polite">
        {divisorTurn ? "まず、割る数の小数点を" : "次に、割られる数の小数点を"}
        右へ{w.normalization!.shift}桁ドラッグ
      </p>
      <div className="normalization-scroll">
        <div className="normalization-problem">
          <Operand
            value={e.p.nums[1]}
            normalized={w.normalization!.divisor}
            shift={w.normalization!.shift}
            label="除数"
            kind="divisor"
            active={divisorTurn}
            moved={!divisorTurn}
            onMove={onNormalize!}
          />
          <span className="normalization-bracket" aria-hidden="true" />
          <Operand
            value={e.p.nums[0]}
            normalized={w.normalization!.dividend}
            shift={w.normalization!.shift}
            label="被除数"
            kind="dividend"
            active={!divisorTurn}
            moved={false}
            onMove={onNormalize!}
          />
        </div>
      </div>
      {!divisorTurn && (
        <button
          className="normalization-reset"
          onClick={() => onNormalize!("reset")}
        >
          小数点の移動をやり直す
        </button>
      )}
    </section>
  );
}
