// Attributes for SVG marks placed from a drawing's numbers. Spread them onto the element:
//
//   <text className="len" {...textAt(x, y, S.labelOpacity)}>20 m</text>
//   <rect className="area" {...rectAt(x, y, w, h, S.areaOpacity)} />

import { clamp01 } from './math';

/** x, y and an opacity kept between 0 and 1, for a <text> or anything else placed by its x and y. */
export const textAt = (x: number, y: number, opacity = 1) => ({ x, y, opacity: clamp01(opacity) });

/** A <rect>'s place and size, with a width or height below 0 drawn as 0, and an opacity kept between 0 and 1. */
export const rectAt = (x: number, y: number, width: number, height: number, opacity = 1) => ({
  x,
  y,
  width: Math.max(0, width),
  height: Math.max(0, height),
  opacity: clamp01(opacity),
});
