// A minimal React StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.
//
// GardenScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps that change the
// state, and starts the demo.

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  MathDemoPlayer,
  VisualElement,
} from '../../framework';
import {
  GardenRenderer,
  type GardenState,
} from './GardenScene';

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
