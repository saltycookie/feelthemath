// A minimal React StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.

import React, { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  ElementRendererComponent,
  MathDemoPlayer,
  VisualElement,
  clamp,
} from '../../framework';

interface GardenState {
  rectOp: number;
  grow: number;
  bubbleOp: number;
  answerOp: number;
}

const GardenRenderer: ElementRendererComponent<GardenState> = ({ element }) => {
  const { rectOp, grow, bubbleOp, answerOp } = element.state;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bubbleSize, setBubbleSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      if (bubbleRef.current) {
        setBubbleSize({
          w: bubbleRef.current.offsetWidth,
          h: bubbleRef.current.offsetHeight,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    document.fonts?.ready?.then(measure);
    return () => ro.disconnect();
  }, []);

  const W = size.w;
  const H = size.h;
  const unit = W > 0 && H > 0 ? Math.min(W / 5, H / 4) : 0;
  const ox = (W - 3 * unit) / 2;
  const oy = (H - 2 * unit) / 2;

  // Place callout bubble anchored at (ox + 3 * unit, oy) on the right
  const ax = ox + 3 * unit;
  const ay = oy;
  const gap = 11;
  const inset = 4;
  const bw = bubbleSize.w || 96;
  const bh = bubbleSize.h || 38;
  const left = clamp(ax + gap, inset, Math.max(inset, W - inset - bw));
  const top = clamp(ay - bh / 2, inset, Math.max(inset, H - inset - bh));
  const tp = clamp(ay - top, 16, Math.max(16, bh - 16)) - 6;

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
        <div
          ref={bubbleRef}
          className="bubble"
          data-tail="right"
          style={
            {
              opacity: clamp(bubbleOp, 0, 1),
              maxWidth: W ? Math.min(360, W - 24) : 360,
              transform: `translate(${left}px, ${top}px)`,
              '--tp': `${tp}px`,
            } as React.CSSProperties
          }
        >
          <b className="c-blue">3</b>
          <u>m</u> × <b className="c-blue">2</b>
          <u>m</u>
        </div>
      </div>
    </>
  );
};

function makeGardenElement(state: GardenState): VisualElement<GardenState> {
  return {
    id: 'garden',
    type: 'garden',
    x: 0,
    y: 0,
    opacity: 1,
    state,
  };
}

export const templateDemo: DemoConfig = {
  id: 'template',
  name: 'Template',
  renderers: {
    garden: GardenRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'The question',
      initialElements: [
        makeGardenElement({ rectOp: 0, grow: 0, bubbleOp: 0, answerOp: 0 }),
      ],
    },
    {
      stepNumber: 2,
      title: 'Draw the garden',
      initialElements: [
        makeGardenElement({ rectOp: 1, grow: 0, bubbleOp: 0, answerOp: 0 }),
      ],
      async play(c) {
        await c.animateElement(
          'garden',
          { state: { grow: 1 } },
          { durationMs: 1500 }
        );
        await c.animateElement(
          'garden',
          { state: { bubbleOp: 1 } },
          { durationMs: 260 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'garden',
          { state: { bubbleOp: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'The answer',
      initialElements: [
        makeGardenElement({ rectOp: 1, grow: 1, bubbleOp: 0, answerOp: 0 }),
      ],
      async play(c) {
        await c.wait(300);
        await c.animateElement(
          'garden',
          { state: { answerOp: 1 } },
          { durationMs: 600 }
        );
      },
    },
  ],
};

const container = document.getElementById('deck');
if (container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={templateDemo} />);
  });
}
