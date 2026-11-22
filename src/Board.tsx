import type { Sheet } from "./engine";
import type { DecimalMove } from "./normalization";
import type { Entry } from "./session";
import { WrittenBoard } from "./WrittenBoard";
export type BoardProps = {
  w: Sheet;
  e: Entry;
  nav?: boolean;
  select?: (n: number) => void;
  solved?: boolean;
  onNormalize?: (move: DecimalMove) => void;
};
export function Board(props: BoardProps) {
  return <WrittenBoard {...props} />;
}
