import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { names, signs, worksheet, type Op, type Problem } from "./engine";
import {
  load,
  fresh,
  start,
  preset,
  generate,
  storageKey,
  limitHistory,
  type Config,
  type Data,
  type Entry,
  type Session,
} from "./session";
import {
  applyDecimalMove,
  normalizationSteps,
  type DecimalMove,
} from "./normalization";
import { Board } from "./Board";
import "./style.css";
const initial = load();
const levels = ["やさしい", "ふつう", "むずかしい"];
const goto = (name: string) => {
  location.hash = "/" + name;
};
const score = (s: Session) => s.items.filter((i) => i.first === true).length;
const label = (p: Problem) => p.nums.join(" " + signs[p.op] + " ");
function Choice({
  title,
  items,
  value,
  onChange,
}: {
  title: string;
  items: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="choices">
        {items.map((item, i) => (
          <button
            key={item}
            aria-pressed={i === value}
            onClick={() => onChange(i)}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function NumberSelect({
  label,
  value,
  max,
  min = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(+e.target.value)}>
        {Array.from({ length: max - min + 1 }, (_, i) => (
          <option key={i} value={i + min}>
            {i + min}
          </option>
        ))}
      </select>
    </label>
  );
}
function Sample({ op }: { op: Op }) {
  const samples = [
    ["46", "38", "84"],
    ["73", "28", "45"],
    ["24", "3", "72"],
    ["84", "4", "21"],
  ];
  const [a, b, r] = samples[op];
  return (
    <div
      className="sample"
      aria-label={"筆算の例 " + a + signs[op] + b + " = " + r}
    >
      <div className="sample-paper">
        {op === 3 ? (
          <>
            <div>{r}</div>
            <div className="longdivision">
              {b} ⟌ {a}
            </div>
          </>
        ) : (
          <>
            <div>{a}</div>
            <div>
              <small>{signs[op]}</small>
              {b}
            </div>
            <div className="sample-answer">
              {r.slice(0, -1)}
              <em>{r.slice(-1)}</em>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function App() {
  const [data, setData] = useState<Data>(initial.data),
    [notice, setNotice] = useState(initial.warning),
    [route, setRoute] = useState(location.hash.slice(2) || "home");
  const [hint, setHint] = useState(0),
    [feedback, setFeedback] = useState(""),
    [confirm, setConfirm] = useState(""),
    [inspect, setInspect] = useState(0);
  const c = data.config,
    s = data.active,
    e = s?.items[s.index],
    w = useMemo(() => (e ? worksheet(e.p) : null), [e?.p]);
  const groups = w ? normalizationSteps(w) : null;
  const normalizing = !!(
    w?.normalization &&
    e &&
    groups &&
    e.at < groups.count
  );
  const resetState = useRef(false);
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(2) || "home");
      setFeedback("");
      setHint(0);
      setConfirm("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    try {
      if (resetState.current) {
        resetState.current = false;
        localStorage.removeItem(storageKey);
      } else localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setNotice("この環境では保存できません。この画面で練習を続けられます。");
    }
  }, [data]);
  const config = (p: Partial<Config>) =>
    setData((d) => ({ ...d, config: { ...d.config, ...p } }));
  function updateEntry(p: Partial<Entry>) {
    setData((d) => {
      const a = d.active;
      if (!a) return d;
      return {
        ...d,
        active: {
          ...a,
          items: a.items.map((item, i) =>
            i === a.index ? { ...item, ...p } : item,
          ),
        },
      };
    });
  }
  function begin(problems?: Problem[]) {
    try {
      const items =
        problems ??
        Array.from({ length: c.count }, () =>
          generate(c, crypto.getRandomValues(new Uint32Array(1))[0]),
        );
      setData((d) => ({ ...d, active: start(items) }));
      setConfirm("");
      setFeedback("");
      setHint(0);
      goto("practice");
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }
  function select(at: number) {
    updateEntry({ at });
    setHint(0);
    setFeedback("");
  }
  function normalize(move: DecimalMove) {
    if (!e || !w) return;
    const patch = applyDecimalMove(w, e, move);
    if (patch) {
      updateEntry(patch);
      setFeedback("");
      setHint(0);
    }
  }
  function input(val: string) {
    if (
      !w ||
      !e ||
      !(w.steps[e.at].value === "." ? val === "." : /^\d$/.test(val))
    )
      return;
    const values = e.values.slice();
    values[e.at] = val;
    updateEntry({
      values,
      checked: false,
      at: c.nav ? Math.min(e.at + 1, values.length - 1) : e.at,
    });
    setHint(0);
    setFeedback("");
  }
  function erase() {
    if (!e) return;
    const at = e.values[e.at] ? e.at : Math.max(0, e.at - 1),
      values = e.values.slice();
    values[at] = "";
    updateEntry({ values, at, checked: false });
    setHint(0);
    setFeedback("");
  }
  function nextCell() {
    if (e && (!c.nav || e.values[e.at]))
      select(Math.min(e.at + 1, e.values.length - 1));
  }
  function check() {
    if (!e || !w) return;
    const blank = e.values.indexOf("");
    if (blank >= 0) {
      select(blank);
      setFeedback("このマスに数字を入れよう");
      return;
    }
    const bad = w.steps.findIndex((step, i) => step.value !== e.values[i]);
    updateEntry({
      checked: true,
      first: e.first ?? bad < 0,
      at: bad < 0 ? e.at : bad,
    });
    setHint(0);
    setFeedback(bad < 0 ? "正解です！" : "印のついたマスを見直そう");
  }
  function advance() {
    if (!s || !e?.checked) return;
    if (s.index < s.items.length - 1) {
      setData((d) => ({ ...d, active: { ...s, index: s.index + 1 } }));
      setFeedback("");
      setHint(0);
      return;
    }
    setData((d) => ({
      ...d,
      active: null,
      history: limitHistory([s, ...d.history.filter((h) => h.id !== s.id)]),
    }));
    setInspect(0);
    goto("result/" + s.id);
  }
  function navigation() {
    config({ nav: !c.nav });
    if (!c.nav && e) {
      const blank = e.values.indexOf("");
      if (blank >= 0) select(blank);
    }
  }
  useEffect(() => {
    function key(ev: KeyboardEvent) {
      if (
        normalizing ||
        route !== "practice" ||
        !e ||
        ev.metaKey ||
        ev.ctrlKey ||
        ev.altKey ||
        ev.repeat
      )
        return;
      if (/^[0-9.]$/.test(ev.key)) input(ev.key);
      else if (ev.key === "Backspace") erase();
      else if (ev.key === "ArrowLeft") select(Math.max(0, e.at - 1));
      else if (ev.key === "ArrowRight") nextCell();
      else if (ev.key === "Enter" && !(ev.target instanceof HTMLButtonElement))
        check();
      else return;
      ev.preventDefault();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const session = data.history.find((h) => route === "result/" + h.id);
  const startButton = () => (s ? setConfirm("replace") : begin());
  const practice = route === "practice" && !!s && !!w && !!e;
  const page = practice
    ? "practice"
    : route === "history" || route === "settings"
      ? route
      : session
        ? "result"
        : "home";
  const detail = (p: Partial<Config>) => config({ ...p, level: -1 });
  return (
    <div className={c.motion ? "" : "reduced"}>
      <header>
        <a className="brand" href="#/home">
          <img src="./masu.svg" alt="" />
          Masu
        </a>
        <nav>
          {[
            ["home", "ホーム"],
            ["history", "履歴"],
            ["settings", "設定"],
          ].map(([r, t]) => (
            <a
              key={r}
              aria-current={page === r ? "page" : undefined}
              href={"#/" + r}
            >
              {t}
            </a>
          ))}
        </nav>
      </header>
      <main className={practice ? "practice" : ""}>
        {notice && <p role="status">{notice}</p>}
        {page === "home" && (
          <>
            <div className="intro">
              <div>
                <p className="eyebrow">筆算の練習帳</p>
                <h1>
                  今日の筆算<span>。</span>
                </h1>
                <p>マスをたどって、一桁ずつ解いてみよう。</p>
              </div>
              <Sample op={c.op} />
            </div>
            <section className="setup">
              <h2>練習する計算</h2>
              <div className="operations">
                {names.map((name, i) => (
                  <button
                    className={"op op" + i}
                    key={name}
                    aria-pressed={c.op === i}
                    onClick={() => {
                      config(preset(i as Op, Math.max(0, c.level)));
                      setFeedback("");
                    }}
                  >
                    <b>{signs[i]}</b>
                    {name}
                  </button>
                ))}
              </div>
              <div className="options">
                <Choice
                  title="難しさ"
                  items={levels}
                  value={c.level}
                  onChange={(i) => config(preset(c.op, i))}
                />
                <Choice
                  title="問題数"
                  items={["5問", "10問", "20問"]}
                  value={[5, 10, 20].indexOf(c.count)}
                  onChange={(i) => config({ count: [5, 10, 20][i] })}
                />
              </div>
              <details>
                <summary>くわしく設定</summary>
                <div className="fields">
                  {(["a", "b"] as const).map((k, i) => (
                    <React.Fragment key={k}>
                      <NumberSelect
                        label={(i ? "2つ目" : "1つ目") + "の数の整数桁"}
                        min={c.op === 3 ? 0 : 1}
                        max={c.op === 3 ? 5 : c.op === 2 ? 4 : 3}
                        value={c[k]}
                        onChange={(n) => detail({ [k]: n })}
                      />
                      {c.op >= 2 && (
                        <NumberSelect
                          label={(i ? "2つ目" : "1つ目") + "の数の小数桁"}
                          min={0}
                          max={c.op === 2 ? 1 : 5}
                          value={i ? c.db : c.da}
                          onChange={(n) => detail({ [i ? "db" : "da"]: n })}
                        />
                      )}
                    </React.Fragment>
                  ))}
                  {c.op === 0 && (
                    <NumberSelect
                      label="足す数の個数"
                      min={2}
                      max={3}
                      value={c.terms}
                      onChange={(n) => detail({ terms: n })}
                    />
                  )}
                  {c.op === 3 && !c.da && !c.db && (
                    <label>
                      余り
                      <select
                        value={c.rem}
                        onChange={(ev) => detail({ rem: ev.target.value })}
                      >
                        <option value="mixed">混在</option>
                        <option value="with">あり</option>
                        <option value="without">なし</option>
                      </select>
                    </label>
                  )}
                </div>
              </details>
              {feedback && <p role="alert">{feedback}</p>}
              {s && (
                <button className="resume" onClick={() => goto("practice")}>
                  前回の続きから　{s.index + 1} / {s.items.length} 問
                </button>
              )}
              <button className="primary wide" onClick={startButton}>
                練習をはじめる <span>→</span>
              </button>
              {confirm === "replace" && (
                <div role="alert">
                  途中の練習を新しい問題に替えますか？{" "}
                  <button onClick={() => begin()}>新しく始める</button>{" "}
                  <button onClick={() => setConfirm("")}>キャンセル</button>
                </div>
              )}
            </section>
          </>
        )}
        {practice && (
          <>
            <div className="practice-head">
              <div>
                <p className="eyebrow">
                  {names[c.op === e.p.op ? c.op : e.p.op]}の練習
                </p>
                <h1>{w.expr}</h1>
              </div>
              <span>
                {s.index + 1} / {s.items.length} 問
              </span>
            </div>
            <div className="progress">
              <i
                style={{ width: ((s.index + 1) / s.items.length) * 100 + "%" }}
              />
            </div>
            <Board
              w={w}
              e={e}
              nav={c.nav}
              select={select}
              onNormalize={normalize}
            />
            <div className="controls">
              <div className="guide" aria-live="polite">
                <strong>
                  {normalizing
                    ? "小数点を移動すると、筆算へ進みます"
                    : feedback || w.steps[e.at].guide}
                </strong>
                <small>
                  {normalizing
                    ? e.at < groups!.divisor.length
                      ? "1 / 2 操作"
                      : "2 / 2 操作"
                    : e.at + 1 + " / " + w.steps.length + " マス"}
                </small>
              </div>
              {!normalizing && (
                <>
                  {hint > 0 && (
                    <p className="hint">
                      {w.steps[e.at].hint}
                      {hint === 2 &&
                        "　このマスは「" + w.steps[e.at].value + "」です。"}
                    </p>
                  )}
                  <div className="tools">
                    <button onClick={() => select(Math.max(0, e.at - 1))}>
                      前のマス
                    </button>
                    <button onClick={nextCell}>次のマス</button>
                    <button
                      onClick={() => {
                        setHint(Math.min(2, hint + 1));
                        updateEntry({
                          hints: e.hints + (hint === 0 ? 1 : 0),
                          revealed: e.revealed || hint >= 1,
                        });
                      }}
                    >
                      {hint === 1 ? "答えを見る" : "ヒント"}
                    </button>
                    <button aria-pressed={c.nav} onClick={navigation}>
                      ナビ {c.nav ? "ON" : "OFF"}
                    </button>
                  </div>
                  {w.steps[e.at].value === "." && (
                    <button className="wide" onClick={() => input(".")}>
                      .
                    </button>
                  )}
                  <div className="pad">
                    {[
                      "7",
                      "8",
                      "9",
                      "4",
                      "5",
                      "6",
                      "1",
                      "2",
                      "3",
                      "消す",
                      "0",
                      "確認",
                    ].map((k) => (
                      <button
                        key={k}
                        onClick={() =>
                          k === "消す"
                            ? erase()
                            : k === "確認"
                              ? check()
                              : input(k)
                        }
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {e.checked && (
                <button className="primary wide" onClick={advance}>
                  {s.index === s.items.length - 1 ? "結果を見る" : "次の問題へ"}{" "}
                  →
                </button>
              )}
            </div>
          </>
        )}
        {page === "history" && (
          <section>
            <p className="eyebrow">練習帳</p>
            <h1>練習の履歴</h1>
            {data.history.length ? (
              data.history.map((h) => (
                <button
                  className="history"
                  key={h.id}
                  onClick={() => {
                    setInspect(0);
                    goto("result/" + h.id);
                  }}
                >
                  {names[h.items[0].p.op]}　{h.items.length}問{" "}
                  <b>初回正解 {score(h)}問　→</b>
                </button>
              ))
            ) : (
              <p>練習を最後まで解くと、ここに結果が残ります。</p>
            )}
          </section>
        )}
        {page === "result" && session && (
          <Result
            session={session}
            inspect={inspect}
            setInspect={setInspect}
            retry={(problems) => {
              if (s) {
                setFeedback("進行中の練習があります。ホームから再開できます。");
                return;
              }
              begin(problems);
            }}
          />
        )}
        {page === "result" && feedback && <p role="status">{feedback}</p>}
        {page === "settings" && (
          <section>
            <p className="eyebrow">練習帳</p>
            <h1>設定</h1>
            <label className="switch">
              <input type="checkbox" checked={c.nav} onChange={navigation} />
              入力後、次のマスへ移動する
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={!c.motion}
                onChange={() => config({ motion: !c.motion })}
              />
              画面の動きを減らす
            </label>
            <details>
              <summary>保存したデータ</summary>
              <p>このブラウザの設定、途中の練習、履歴を削除できます。</p>
              <button onClick={() => setConfirm("delete")}>データを削除</button>
              {confirm === "delete" && (
                <p role="alert">
                  削除すると元に戻せません。{" "}
                  <button
                    onClick={() => {
                      resetState.current = true;
                      setData(fresh());
                      setConfirm("");
                      setFeedback("削除しました");
                    }}
                  >
                    すべて削除する
                  </button>{" "}
                  <button onClick={() => setConfirm("")}>キャンセル</button>
                </p>
              )}
              {feedback}
            </details>
          </section>
        )}
      </main>
      {!practice && (
        <footer>
          <b>Masu</b>
          <div>
            {[
              ["about", "使い方・運営"],
              ["privacy", "プライバシー"],
              ["terms", "利用規約"],
              ["licenses", "ライセンス"],
            ].map(([u, t]) => (
              <a key={u} href={"./" + u + "/index.html"}>
                {t}
              </a>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
function Result({
  session: s,
  inspect,
  setInspect,
  retry,
}: {
  session: Session;
  inspect: number;
  setInspect: (n: number) => void;
  retry: (p: Problem[]) => void;
}) {
  const i = Math.min(inspect, s.items.length - 1),
    e = s.items[i],
    w = worksheet(e.p),
    miss = s.items.filter((x) => !x.first);
  return (
    <section>
      <p className="eyebrow">{names[e.p.op]}の記録</p>
      <h1>練習の結果</h1>
      <div className="summary">
        <strong>
          {score(s)} / {s.items.length} 問
        </strong>
        <p>
          初回正答率 {Math.round((100 * score(s)) / s.items.length)}%　ヒント{" "}
          {s.items.reduce((n, x) => n + x.hints, 0)}回
        </p>
      </div>
      <div className="tools">
        <button onClick={() => retry(s.items.map((x) => x.p))}>もう一度</button>
        <button
          disabled={!miss.length}
          onClick={() => retry(miss.map((x) => x.p))}
        >
          まちがいを練習
        </button>
      </div>
      <h2>答え合わせ</h2>
      <label>
        問題{" "}
        <select value={i} onChange={(ev) => setInspect(+ev.target.value)}>
          {s.items.map((x, j) => (
            <option value={j} key={j}>
              {j + 1}. {label(x.p)}
            </option>
          ))}
        </select>
      </label>
      <p>
        {w.expr} ＝ {w.result}
        {w.remainder ? " 余り " + w.remainder : ""}　
        {e.revealed ? "補助あり" : ""}
      </p>
      <h3>自分の筆算</h3>
      <Board w={w} e={e} />
      <h3>正しい筆算</h3>
      <Board w={w} e={e} solved />
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
