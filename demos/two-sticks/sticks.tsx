// Two Perpendicular Sticks: AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to
// end on a ruler.
//
// SticksScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import { mountDemo, type DemoConfig } from '../../framework';
import { SticksSceneRenderer, type SticksState } from './SticksScene';

export const twoSticksDemo: DemoConfig<{ 'sticks-scene': SticksState }> = {
  id: 'two-sticks',
  name: 'Two Perpendicular Sticks',
  renderers: {
    'sticks-scene': SticksSceneRenderer,
  },
  steps: [
    {
      title: 'Problem Description',
      summary: 'The problem',
      elements: {
        'sticks-scene': { set: { printedLetters: 1, printedMarks: 1, problem: 1, crossed: 1 } },
      },
      // Nothing moves; a new pulseCount makes the scene pulse the figure's marks.
      play: { set: { pulseCount: 1 } },
      exit: { unset: ['pulseCount'] },
    },
    {
      title: 'Problem Description',
      summary: 'Think',
      play: [
        { ms: 700, set: { prompt: 1 } },
        {
          wait: 600,
          parallel: [
            { ms: 600, unset: ['printedMarks'] },
            { wait: 100, ms: 800, unset: ['printedLetters'] },
            { wait: 100, ms: 1200, set: { sideWood: 1 } },
            { wait: 100, ms: 1500, set: { mainWood: 1 } },
          ],
        },
      ],
    },
    {
      title: 'Recreate the Figure',
      summary: 'Label AC',
      play: [
        {
          parallel: [
            { ms: 700, unset: ['prompt', 'problem'] },
            { wait: 500, ms: 3200, easing: 'linear', set: { sidesToPile: 1 } },
            { wait: 3300, ms: 1280, set: { bdToPile: 1 } },
            { wait: 4600, ms: 900, unset: ['crossed'] },
          ],
        },
        { wait: 100, ms: 600, set: { xBrackets: 1 } },
        { wait: 100, ms: 1500, easing: 'linear', set: { pickO: 1 } },
        { wait: 100, ms: 600, set: { acYLabel: 1 } },
        { wait: 200, ms: 600, set: { acXMinusYLabel: 1 } },
      ],
    },
    {
      title: 'Recreate the Figure',
      summary: 'Lay BD across AC',
      play: [
        { wait: 300, ms: 1280, set: { bdFromPile: 1 } },
        { wait: 120, ms: 2800, easing: 'linear', set: { bdLabels: 1 } },
        {
          wait: 600,
          parallel: [
            { ms: 350, unset: ['xBrackets'] },
            { wait: 200, ms: 1500, set: { crossed: 1 } },
            { wait: 1550, ms: 400, set: { rightAngle: 1 } },
          ],
        },
      ],
    },
    {
      title: 'Recreate the Figure',
      summary: 'Label AB and CD',
      play: [
        { wait: 300, ms: 1300, set: { abFromPile: 1 } },
        { wait: 100, ms: 600, set: { abLabel: 1 } },
        { wait: 300, ms: 1500, set: { cdFromPile: 1 } },
        { wait: 100, ms: 600, set: { cdLabel: 1 } },
      ],
    },
    {
      title: 'Recreate the Figure',
      summary: 'Lay them on the ruler',
      play: [
        { wait: 200, ms: 1900, easing: 'linear', set: { onRuler: 1 } },
        { wait: 150, ms: 600, set: { equation: 1 } },
      ],
    },
    {
      title: 'Solve the Equation',
      summary: 'Solve',
      // The equation flies up into the working while the working's lines appear on their own clock.
      play: [
        {
          parallel: [
            { ms: 800, set: { figureGone: 1 } },
            { wait: 450, ms: 1100, set: { termsToWorking: 1 } },
          ],
        },
        { wait: 750, set: { row2: 1 } },
        { wait: 1100, set: { strike: 1 } },
        { wait: 900, set: { row3: 1 } },
        { wait: 1300, set: { row4: 1 } },
        { wait: 1300, set: { row5: 1 } },
        { wait: 1400, set: { row6: 1 } },
      ],
    },
  ],
};

mountDemo(twoSticksDemo);
