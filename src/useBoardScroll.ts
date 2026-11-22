import { useEffect, useRef } from "react";
import type { Sheet } from "./engine";
export function useBoardScroll(
  at: number,
  w: Sheet,
  select?: (n: number) => void,
) {
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
  }, [at, w, select]);
  return ref;
}
