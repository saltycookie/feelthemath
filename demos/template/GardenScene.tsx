// The template's scene: its state, and the renderer that draws it. The steps that change the state are in demo.tsx.
//
// A renderer draws its scene as JSX from the element's state. Whatever it needs to know about the page (how big the
// paper is, how big a bubble came out) it reads with useMeasure, and draws from that.

import { useRef } from 'react';
import {
  Bubble,
  ElementRendererComponent,
  clamp,
  placeBubble,
  useMeasure,
} from '../../framework';

export interface GardenState {
  rectOp: number;
  grow: number;
  bubbleOp: number;
  answerOp: number;
}

export const GardenRenderer: ElementRendererComponent<GardenState> = ({ element }) => {
  const { rectOp, grow, bubbleOp, answerOp } = element.state;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // measure: the space under the question, then the bubble at the width it may take there
  const size = useMeasure(
    boxRef,
    () => {
      const r = boxRef.current!.getBoundingClientRect();
      return { w: r.width, h: r.height };
    },
    { w: 0, h: 0 }
  );
  const W = size.w;
  const H = size.h;
  const maxWidth = W ? Math.min(360, W - 24) : 360;
  const bubbleSize = useMeasure(
    bubbleRef,
    () => ({ w: bubbleRef.current!.offsetWidth, h: bubbleRef.current!.offsetHeight }),
    { w: 0, h: 0 },
    [maxWidth]
  );

  // draw: a 3 × 2 rectangle as big as fits, with the bubble to the right of its top right corner
  const unit = W > 0 && H > 0 ? Math.min(W / 5, H / 4) : 0;
  const ox = (W - 3 * unit) / 2;
  const oy = (H - 2 * unit) / 2;
  const bubbleAt = placeBubble(
    [ox + 3 * unit, oy, 'right'],
    { w: bubbleSize.w || 96, h: bubbleSize.h || 38 },
    { x: 0, y: 0, w: W, h: H }
  );

  return (
    <>
      <p className="problem">
        A garden is <b className="c-blue">3 m</b> long and{' '}
        <b className="c-blue">2 m</b> wide. What is its area?
      </p>
      <div className="box" ref={boxRef}>
        <svg id="pic" viewBox={W && H ? `0 0 ${W} ${H}` : undefined}>
          {unit > 0 && (
            <>
              <rect
                className="area"
                x={ox}
                y={oy}
                width={Math.max(0, 3 * unit * grow)}
                height={Math.max(0, 2 * unit)}
                opacity={clamp(rectOp, 0, 1)}
              />
              <text
                className="big c-ink"
                x={ox + 1.5 * unit}
                y={oy + unit + 10}
                opacity={clamp(answerOp, 0, 1)}
              >
                6 m²
              </text>
            </>
          )}
        </svg>
        <Bubble ref={bubbleRef} opacity={bubbleOp} placement={bubbleAt} maxWidth={maxWidth}>
          <b className="c-blue">3</b>
          <u>m</u> × <b className="c-blue">2</b>
          <u>m</u>
        </Bubble>
      </div>
    </>
  );
};
