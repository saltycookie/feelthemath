// The example demo's scene: its state, and the renderer that draws it.
// The steps that animate the state are in demo.tsx.
//
// A renderer draws its scene as JSX worked out from the element's state and from sizes read off the page
// with useMeasure. Nothing is drawn from a size until that size has been measured.

import { useRef } from 'react';
import {
  Bubble,
  placeBubble,
  useMeasure,
  type ElementRendererComponent,
  type Size,
} from '../../framework';

/* ================= the garden (lengths in metres) ================= */
const LENGTH_M = 3;
const WIDTH_M = 2;
/** Clear space kept on each side of the garden, so the bubble has somewhere to sit. */
const MARGIN_M = 1;

/* ================= the formula bubble (px) ================= */
const BUBBLE_MAX_WIDTH = 360;
/** Room left between the widest bubble and the drawing's edges, both sides together. */
const BUBBLE_SIDE_ROOM = 24;

/**
 * What the garden scene looks like at one moment. The steps animate these values.
 * Opacities run from 0 (hidden) to 1 (fully visible).
 */
export interface GardenState {
  /** The garden rectangle's outline and fill. */
  rectangleOpacity: number;
  /** How much of its length the rectangle has grown to: 0 is none, 1 is all of it. */
  growthProgress: number;
  /** The formula bubble at the garden's corner. */
  bubbleOpacity: number;
  /** The answer written inside the garden. */
  answerOpacity: number;
}

/** Where the full-grown garden sits in a drawing area of `box`, in px: centred, with MARGIN_M around it. */
function layoutGarden(box: Size): { x: number; y: number; width: number; height: number } {
  const pxPerMetre = Math.min(
    box.w / (LENGTH_M + 2 * MARGIN_M),
    box.h / (WIDTH_M + 2 * MARGIN_M)
  );
  const width = LENGTH_M * pxPerMetre;
  const height = WIDTH_M * pxPerMetre;
  return { x: (box.w - width) / 2, y: (box.h - height) / 2, width, height };
}

export const GardenRenderer: ElementRendererComponent<GardenState> = ({ element }) => {
  const { rectangleOpacity, growthProgress, bubbleOpacity, answerOpacity } = element.state;

  const boxRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  /* ---------- measure ---------- */
  // The drawing area under the problem text. null until it has a size.
  const box = useMeasure<Size | null>(
    boxRef,
    () => {
      const rect = boxRef.current?.getBoundingClientRect();
      return rect?.width && rect.height ? { w: rect.width, h: rect.height } : undefined;
    },
    null
  );

  // The bubble, as wide as its words unless the drawing area is narrower than that.
  const bubbleMaxWidth = box ? Math.min(BUBBLE_MAX_WIDTH, box.w - BUBBLE_SIDE_ROOM) : BUBBLE_MAX_WIDTH;
  const bubbleSize = useMeasure<Size | null>(
    bubbleRef,
    () => {
      const bubble = bubbleRef.current;
      return bubble?.offsetWidth ? { w: bubble.offsetWidth, h: bubble.offsetHeight } : undefined;
    },
    null,
    [bubbleMaxWidth]
  );

  /* ---------- draw ---------- */
  const garden = box && layoutGarden(box);
  // An easing that overshoots must not ask for a negative width.
  const growth = Math.max(0, growthProgress);

  // The bubble sits to the right of the garden's top-right corner, kept inside the drawing area.
  const bubblePlacement =
    box && garden && bubbleSize
      ? placeBubble([garden.x + garden.width, garden.y, 'right'], bubbleSize, { x: 0, y: 0, ...box })
      : null;

  return (
    <>
      <p className="problem">
        {/* Each length as one string: split into two text nodes, "3" and " m" are spaced a hair differently. */}
        A garden is <b className="c-blue">{`${LENGTH_M} m`}</b> long and{' '}
        <b className="c-blue">{`${WIDTH_M} m`}</b> wide. What is its area?
      </p>
      <div className="box" ref={boxRef}>
        {/* No viewBox: the svg fills the box, so its units are the box's px. */}
        <svg className="pic">
          {garden && (
            <>
              <rect
                className="area"
                x={garden.x}
                y={garden.y}
                width={garden.width * growth}
                height={garden.height}
                opacity={rectangleOpacity}
              />
              {/* Left out while hidden, so the answer is not on the page before its step. */}
              {answerOpacity > 0 && (
                <text
                  className="big c-ink"
                  x={garden.x + garden.width / 2}
                  y={garden.y + garden.height / 2}
                  opacity={answerOpacity}
                >
                  {`${LENGTH_M * WIDTH_M} m²`}
                </text>
              )}
            </>
          )}
        </svg>
        {/* Always on the page so that it can be measured; unseen until it has been placed. */}
        <Bubble
          ref={bubbleRef}
          opacity={bubblePlacement ? bubbleOpacity : 0}
          placement={bubblePlacement}
          maxWidth={bubbleMaxWidth}
        >
          <b className="c-blue">{LENGTH_M}</b>
          <u>m</u> × <b className="c-blue">{WIDTH_M}</b>
          <u>m</u>
        </Bubble>
      </div>
    </>
  );
};
