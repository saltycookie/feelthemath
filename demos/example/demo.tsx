// A minimal StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.
//
// GardenScene.tsx has the scene: its state, and the renderer that draws it.
// This file has the steps (the DemoConfig) and puts the demo on the page.

import {
  elementControls,
  mountDemo,
  type DemoConfig,
  type VisualElement,
} from '../../framework';
import { GardenRenderer, type GardenState } from './GardenScene';

/** The scene's one visual element: both its id and the renderer type it is registered under. */
const GARDEN = 'garden';
const scene = elementControls<GardenState>(GARDEN);

/** How long each animation takes, in ms. */
const GROW_MS = 1500;
const BUBBLE_IN_MS = 260;
const BUBBLE_OUT_MS = 220;
const ANSWER_PAUSE_MS = 300;
const ANSWER_IN_MS = 600;

/** Nothing drawn yet. Each step says only how it differs from this. */
const HIDDEN: GardenState = {
  rectangleOpacity: 0,
  growthProgress: 0,
  bubbleOpacity: 0,
  answerOpacity: 0,
};

/** The garden element as a step begins, with `overrides` on top of HIDDEN. */
function garden(overrides: Partial<GardenState> = {}): VisualElement<GardenState> {
  return {
    id: GARDEN,
    type: GARDEN,
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...HIDDEN, ...overrides },
  };
}

export const exampleDemo: DemoConfig = {
  id: 'example',
  name: 'Example',
  renderers: {
    [GARDEN]: GardenRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'The question',
      // initialElements is what the step shows the moment it is entered, however it is reached
      // (Next, Back, a navigation dot, or #step-N in the address).
      initialElements: [garden()],
    },
    {
      stepNumber: 2,
      title: 'Draw the garden',
      initialElements: [garden({ rectangleOpacity: 1 })],
      // play() runs once initialElements are drawn, and again on Replay. Next waits for it to finish.
      async play(controller) {
        await scene.to(controller, { growthProgress: 1 }, GROW_MS);
        await scene.to(controller, { bubbleOpacity: 1 }, BUBBLE_IN_MS);
      },
      // exit() runs on Next only (Back and the dots skip it), before the next step's initialElements
      // replace this step's. Finish with runDefaultExit() so that elements the next step does not have
      // still fade out.
      async exit({ controller, runDefaultExit }) {
        await scene.to(controller, { bubbleOpacity: 0 }, BUBBLE_OUT_MS);
        await runDefaultExit();
      },
    },
    {
      stepNumber: 3,
      title: 'The answer',
      initialElements: [garden({ rectangleOpacity: 1, growthProgress: 1 })],
      async play(controller) {
        await controller.wait(ANSWER_PAUSE_MS);
        await scene.to(controller, { answerOpacity: 1 }, ANSWER_IN_MS);
      },
    },
  ],
};

mountDemo(exampleDemo);
