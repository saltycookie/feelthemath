// A minimal React StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.
//
// GardenScene.tsx has the scene: its state, and the renderer that draws it.
// This file defines the step progression (DemoConfig) and mounts the demo player into the DOM.

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

/**
 * Helper to construct the garden visual element with initial state values.
 * Visual elements are placed onto the canvas and animated by step controllers.
 */
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

/**
 * Example demo configuration demonstrating a three-step progression:
 * 1. The question: presents the problem statement with all drawings hidden.
 * 2. Draw the garden: animates the garden rectangle expanding horizontally to scale, then shows the formula callout bubble.
 * 3. The answer: reveals the computed final area inside the garden.
 */
export const exampleDemo: DemoConfig = {
  id: 'example',
  name: 'Example',
  renderers: {
    garden: GardenRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'The question',
      // initialElements defines the immediate visual state when this step is loaded directly (e.g. via hash navigation).
      initialElements: [
        makeGardenElement({
          rectangleOpacity: 0,
          growthProgress: 0,
          bubbleOpacity: 0,
          answerOpacity: 0,
        }),
      ],
    },
    {
      stepNumber: 2,
      title: 'Draw the garden',
      initialElements: [
        makeGardenElement({
          rectangleOpacity: 1,
          growthProgress: 0,
          bubbleOpacity: 0,
          answerOpacity: 0,
        }),
      ],
      // play() runs animations sequentially when stepping forward into this step.
      async play(controller) {
        // Smoothly grow the garden rectangle horizontally across 1500ms
        await controller.animateElement(
          'garden',
          { state: { growthProgress: 1 } },
          { durationMs: 1500 }
        );
        // Fade in the formula bubble pointing at the top-right corner of the garden
        await controller.animateElement(
          'garden',
          { state: { bubbleOpacity: 1 } },
          { durationMs: 260 }
        );
      },
      // exit() runs cleanup animations when moving away to another step.
      async exit({ controller }) {
        // Fade out the formula callout bubble before transitioning away
        await controller.animateElement(
          'garden',
          { state: { bubbleOpacity: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'The answer',
      initialElements: [
        makeGardenElement({
          rectangleOpacity: 1,
          growthProgress: 1,
          bubbleOpacity: 0,
          answerOpacity: 0,
        }),
      ],
      async play(controller) {
        // Brief pause before revealing the result
        await controller.wait(300);
        // Fade in the final answer text inside the garden
        await controller.animateElement(
          'garden',
          { state: { answerOpacity: 1 } },
          { durationMs: 600 }
        );
      },
    },
  ],
};

// Mount the demo player into the #deck container element
const container = document.getElementById('deck');
if (container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={exampleDemo} />);
  });
}
