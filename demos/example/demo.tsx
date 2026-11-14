// A minimal StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.
//
// GardenScene.tsx has the scene: its state, and the renderer that draws it.
// This file has the steps (the DemoConfig) and puts the demo on the page.

import { mountDemo, type DemoConfig } from '../../framework';
import { GardenRenderer } from './GardenScene';
import { type GardenState } from './GardenState';

/** How long each animation takes, in ms. */
const GROW_MS = 1500;
const BUBBLE_IN_MS = 260;
const BUBBLE_OUT_MS = 220;
const ANSWER_PAUSE_MS = 300;
const ANSWER_IN_MS = 600;

export const exampleDemo: DemoConfig<{ garden: GardenState }> = {
  id: 'example',
  name: 'Example',
  renderers: {
    garden: GardenRenderer,
  },
  steps: [
    {
      title: 'The question',
    },
    {
      title: 'Draw the garden',
      play: [
        { set: { rectangleOpacity: 1 } },
        { ms: GROW_MS, set: { growthProgress: 1 } },
        { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
      ],
      exit: { ms: BUBBLE_OUT_MS, unset: ['bubbleOpacity'] },
    },
    {
      title: 'The answer',
      play: { wait: ANSWER_PAUSE_MS, ms: ANSWER_IN_MS, set: { answerOpacity: 1 } },
    },
  ],
};

mountDemo(exampleDemo);
