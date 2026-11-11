// Danny's Walk: from the playground to the river and on home: how short can the walk be? A paper folded along the
// river unfolds, and the shortest walk becomes a straight line.
//
// WalkScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  background,
  elementControls,
  mountDemo,
  type DemoConfig,
  type VisualElement,
} from '../../framework';
import {
  BASE_STATE,
  UNFOLD_MS,
  WalkSceneRenderer,
  type WalkState,
} from './WalkScene';

const SCENE = 'walk-scene';
const scene = elementControls<WalkState>(SCENE);

function makeWalkElement(patch: Partial<WalkState>): VisualElement<WalkState> {
  return {
    id: SCENE,
    type: SCENE,
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

/* ================= what the paper shows as each step begins ================= */
// Each builds on the one before it, so a step's beginning is the end of the step before.

/** The whole figure, flat on: the river, home, the playground, C and the walk through it, and the question. */
const FIGURE_DRAWN: Partial<WalkState> = {
  riverProgress: 1,
  homeShown: 1,
  homeMeasure: 1,
  playgroundShown: 1,
  playgroundMeasure: 1,
  eastMeasure: 1,
  cShown: 1,
  walk1: 1,
  questionShown: 1,
  problemShown: 1,
};

/** The figure on a paper folded along the river, seen from the side, with the fold switch showing. */
const PAPER_FOLDED: Partial<WalkState> = {
  ...FIGURE_DRAWN,
  problemShown: 0,
  questionShown: 0,
  sideView: 1,
  paperShown: 1,
  unfold: 0,
  switchShown: 1,
  hintFoldIt: 0,
  switchOpen: false,
  controlsOn: false,
};

/** Four points on the bank and the four walks through them, on the paper unfolded. */
const FOUR_WALKS_UNFOLDED: Partial<WalkState> = {
  ...PAPER_FOLDED,
  cAsC1: 1,
  c2Shown: 1,
  c3Shown: 1,
  c4Shown: 1,
  walk2: 1,
  walk3: 1,
  walk4: 1,
  measureLabelAside: 1,
  hintUnfoldToCompare: 1,
  unfold: 1,
  switchOpen: true,
  controlsOn: false,
};

/** Only the straight walk through C3 left, on the unfolded paper seen flat on; the switch gone. */
const STRAIGHT_WALK_FLAT: Partial<WalkState> = {
  ...FOUR_WALKS_UNFOLDED,
  switchShown: 0,
  hintUnfoldToCompare: 0,
  onlyC3: 1,
  hintStraightLine: 1,
  framingUnfolded: 1,
  sideView: 0,
};

/* ================= the steps ================= */

export const dannysWalkDemo: DemoConfig = {
  id: 'dannys-walk',
  name: "Danny's Walk",
  renderers: {
    [SCENE]: WalkSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeWalkElement({ stepIdx: 0 })],
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'The problem as a figure',
      initialElements: [makeWalkElement({ stepIdx: 1 })],
      async play(c) {
        await scene.to(c, { riverProgress: 1 }, 1000);
        await c.wait(250);
        await scene.to(c, { homeShown: 1 }, 450);
        await c.wait(100);
        await scene.to(c, { homeMeasure: 1 }, 700);
        await c.wait(400);
        await scene.to(c, { playgroundShown: 1 }, 450);
        await c.wait(100);
        await scene.to(c, { playgroundMeasure: 1 }, 800);
        await c.wait(150);
        await scene.to(c, { eastMeasure: 1 }, 1100);
        await c.wait(400);
        await scene.to(c, { cShown: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { walk1: 1 }, 2600, 'linear');
        await c.wait(350);
        await scene.to(c, { questionShown: 1 }, 600);
      },
    },
    {
      stepNumber: 3,
      title: 'Imagine Danny Living on a Folded Paper',
      summary: 'The folded paper',
      initialElements: [makeWalkElement({ ...FIGURE_DRAWN, stepIdx: 2 })],
      async play(c) {
        await scene.to(c, { problemShown: 0, questionShown: 0, paperShown: 1 }, 1200);
        await c.wait(400);
        await scene.to(c, { sideView: 1 }, 1700);
        await c.wait(700);
        scene.set(c, { switchOpen: true });
        await scene.to(c, { unfold: 1 }, 3000);
        await c.wait(400);
        scene.set(c, { controlsOn: true });
        await scene.to(c, { switchShown: 1, hintFoldIt: 1 }, 600);
      },
      // The reader may have left the paper anywhere between folded and unfolded: fold it from there.
      async exit({ controller }) {
        const { hintFoldIt, unfold } = scene.state(controller) ?? BASE_STATE;
        scene.set(controller, { controlsOn: false, switchOpen: false });
        await Promise.all([
          scene.to(controller, { hintFoldIt: 0 }, 600 * hintFoldIt),
          scene.to(controller, { unfold: 0 }, UNFOLD_MS * unfold),
        ]);
      },
    },
    {
      stepNumber: 4,
      title: 'Which Path Is the Shortest?',
      summary: 'Four walks',
      initialElements: [makeWalkElement({ ...PAPER_FOLDED, stepIdx: 3 })],
      async play(c) {
        background(scene.to(c, { measureLabelAside: 1 }, 900));
        await scene.to(c, { cAsC1: 1 }, 600);
        await c.wait(200);
        await scene.to(c, { c2Shown: 1 }, 450);
        await c.wait(150);
        await scene.to(c, { c3Shown: 1 }, 450);
        await c.wait(150);
        await scene.to(c, { c4Shown: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { walk2: 1 }, 1500, 'linear');
        await c.wait(200);
        await scene.to(c, { walk3: 1 }, 1500, 'linear');
        await c.wait(200);
        await scene.to(c, { walk4: 1 }, 1500, 'linear');
        await c.wait(400);
        await scene.to(c, { hintUnfoldToCompare: 1 }, 600);
        scene.set(c, { controlsOn: true });
      },
      // Unfold the paper from wherever the reader left it.
      async exit({ controller }) {
        const { unfold } = scene.state(controller) ?? BASE_STATE;
        scene.set(controller, { controlsOn: false, switchOpen: true });
        await scene.to(controller, { unfold: 1 }, UNFOLD_MS * (1 - unfold));
      },
    },
    {
      stepNumber: 5,
      title: 'Which Path Is the Shortest?',
      summary: 'The straight walk',
      initialElements: [makeWalkElement({ ...FOUR_WALKS_UNFOLDED, stepIdx: 4 })],
      async play(c) {
        await scene.to(c, { switchShown: 0, hintUnfoldToCompare: 0 }, 600);
        await c.wait(250);
        await scene.to(c, { onlyC3: 1 }, 900);
        await c.wait(400);
        await scene.to(c, { hintStraightLine: 1 }, 600);
      },
      async exit({ controller }) {
        scene.set(controller, { framingUnfolded: 1 });
        await scene.to(controller, { sideView: 0 }, 1700);
      },
    },
    {
      stepNumber: 6,
      title: 'Solve the Problem',
      summary: 'The answer',
      initialElements: [makeWalkElement({ ...STRAIGHT_WALK_FLAT, stepIdx: 5 })],
      async play(c) {
        background(scene.to(c, { hintStraightLine: 0 }, 500));
        await scene.to(c, { framingRaised: 1 }, 1300);
        await c.wait(250);
        await scene.to(c, { triangleLegs: 1 }, 1400);
        await scene.to(c, { dShown: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { legLengthsShown: 1 }, 900);
        // the working, a piece at a time
        await c.wait(500);
        await scene.to(c, { working1: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { working2: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { working3: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { working4: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { working5: 1 }, 600);
        await c.wait(250);
        await scene.to(c, { answerRing: 1 }, 900);
      },
    },
  ],
};

mountDemo(dannysWalkDemo);
