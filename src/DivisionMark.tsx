// A curved division bracket and its vinculum share one continuous stroke.
export function DivisionMark({
  left,
  top,
  right,
  height = 48,
}: {
  left: number;
  top: number;
  right: number;
  height?: number;
}) {
  const edge = left - 12;
  const curve = left + 6;
  const d = [
    "M",
    edge,
    top + height,
    "C",
    curve,
    top + height * 0.8,
    curve,
    top + height * 0.2,
    edge,
    top,
    "H",
    right,
  ].join(" ");
  return <path className="bracket" d={d} vectorEffect="non-scaling-stroke" />;
}
