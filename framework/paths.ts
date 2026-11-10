// Path data for SVG drawings.

/** A straight arrow from (x0, y0) to (x1, y1) with an open head. */
export function arrowPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  head = 10,
  spread = 0.5
): string {
  const a = Math.atan2(y1 - y0, x1 - x0);
  return (
    'M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1 +
    'M' + (x1 - head * Math.cos(a - spread)) + ' ' + (y1 - head * Math.sin(a - spread)) +
    'L' + x1 + ' ' + y1 +
    'L' + (x1 - head * Math.cos(a + spread)) + ' ' + (y1 - head * Math.sin(a + spread))
  );
}
