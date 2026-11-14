// Danny's Walk: from the playground to the river and on home: how short can the walk be? A paper folded along the
// river unfolds, and the shortest walk becomes a straight line.
//
// WalkScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import { mountDemo, type DemoConfig } from '../../framework';
import { UNFOLD_MS, WalkSceneRenderer, type WalkState } from './WalkScene';

export const dannysWalkDemo: DemoConfig<{ 'walk-scene': WalkState }> = {
  id: 'dannys-walk',
  name: "Danny's Walk",
  renderers: {
    'walk-scene': WalkSceneRenderer,
  },
  steps: [
    {
      title: 'Problem Description',
      summary: 'The problem',
      elements: { 'walk-scene': { set: { problemShown: 1 } } },
    },
    {
      title: 'Problem Description',
      summary: 'The problem as a figure',
      play: [
        { ms: 1000, set: { riverProgress: 1 } },
        { wait: 250, ms: 450, set: { homeShown: 1 } },
        { wait: 100, ms: 700, set: { homeMeasure: 1 } },
        { wait: 400, ms: 450, set: { playgroundShown: 1 } },
        { wait: 100, ms: 800, set: { playgroundMeasure: 1 } },
        { wait: 150, ms: 1100, set: { eastMeasure: 1 } },
        { wait: 400, ms: 450, set: { cShown: 1 } },
        { wait: 300, ms: 2600, easing: 'linear', set: { walk1: 1 } },
        { wait: 350, ms: 600, set: { questionShown: 1 } },
      ],
    },
    {
      title: 'Imagine Danny Living on a Folded Paper',
      summary: 'The folded paper',
      play: [
        { ms: 1200, unset: ['problemShown', 'questionShown'], set: { paperShown: 1 } },
        { wait: 400, ms: 1700, set: { sideView: 1 } },
        { wait: 700, set: { switchOpen: true } },
        { ms: 3000, set: { unfold: 1 } },
        { wait: 400, set: { controlsOn: true } },
        { ms: 600, set: { switchShown: 1, hintFoldIt: 1 } },
      ],
      // The reader may have left the paper anywhere between folded and unfolded: fold it from there.
      exit: [
        { unset: ['controlsOn', 'switchOpen'] },
        {
          parallel: [
            { ms: (s) => 600 * s.hintFoldIt, unset: ['hintFoldIt'] },
            { ms: (s) => UNFOLD_MS * s.unfold, unset: ['unfold'] },
          ],
        },
      ],
    },
    {
      title: 'Which Path Is the Shortest?',
      summary: 'Four walks',
      play: [
        { ms: 900, fork: true, set: { measureLabelAside: 1 } },
        { ms: 600, set: { cAsC1: 1 } },
        { wait: 200, ms: 450, set: { c2Shown: 1 } },
        { wait: 150, ms: 450, set: { c3Shown: 1 } },
        { wait: 150, ms: 450, set: { c4Shown: 1 } },
        { wait: 300, ms: 1500, easing: 'linear', set: { walk2: 1 } },
        { wait: 200, ms: 1500, easing: 'linear', set: { walk3: 1 } },
        { wait: 200, ms: 1500, easing: 'linear', set: { walk4: 1 } },
        { wait: 400, ms: 600, set: { hintUnfoldToCompare: 1 } },
        { set: { controlsOn: true } },
      ],
      // Unfold the paper from wherever the reader left it.
      exit: [
        { unset: ['controlsOn'], set: { switchOpen: true } },
        { ms: (s) => UNFOLD_MS * (1 - s.unfold), set: { unfold: 1 } },
      ],
    },
    {
      title: 'Which Path Is the Shortest?',
      summary: 'The straight walk',
      play: [
        { ms: 600, unset: ['switchShown', 'hintUnfoldToCompare'] },
        { wait: 250, ms: 900, set: { onlyC3: 1 } },
        { wait: 400, ms: 600, set: { hintStraightLine: 1 } },
      ],
      exit: [
        { set: { framingUnfolded: 1 } },
        { ms: 1700, unset: ['sideView'] },
      ],
    },
    {
      title: 'Solve the Problem',
      summary: 'The answer',
      play: [
        { ms: 500, fork: true, unset: ['hintStraightLine'] },
        { ms: 1300, set: { framingRaised: 1 } },
        { wait: 250, ms: 1400, set: { triangleLegs: 1 } },
        { ms: 450, set: { dShown: 1 } },
        { wait: 300, ms: 900, set: { legLengthsShown: 1 } },
        // the working, a piece at a time
        { wait: 500, ms: 600, set: { working1: 1 } },
        { wait: 600, ms: 600, set: { working2: 1 } },
        { wait: 600, ms: 600, set: { working3: 1 } },
        { wait: 600, ms: 600, set: { working4: 1 } },
        { wait: 600, ms: 600, set: { working5: 1 } },
        { wait: 250, ms: 900, set: { answerRing: 1 } },
      ],
    },
  ],
};

mountDemo(dannysWalkDemo);
