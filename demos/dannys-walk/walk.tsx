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
  river: 1,
  a: 1,
  aDim: 1,
  b: 1,
  bRiver: 1,
  bEast: 1,
  c: 1,
  walk: 1,
  ask: 1,
  txt: 1,
};

/** The figure on a paper folded along the river, seen from the side, with the fold switch showing. */
const PAPER_FOLDED: Partial<WalkState> = {
  ...FIGURE_DRAWN,
  txt: 0,
  ask: 0,
  view: 1,
  paper: 1,
  unf: 0,
  sw: 1,
  hint3: 0,
  switchOpen: false,
  controlsOn: false,
};

/** Four points on the bank and the four walks through them, on the paper unfolded. */
const FOUR_WALKS_UNFOLDED: Partial<WalkState> = {
  ...PAPER_FOLDED,
  sub: 1,
  c2: 1,
  c3: 1,
  c4: 1,
  w2: 1,
  w3: 1,
  w4: 1,
  lab4: 1,
  hint4: 1,
  unf: 1,
  switchOpen: true,
  controlsOn: false,
};

/** Only the straight walk through C3 left, on the unfolded paper seen flat on; the switch gone. */
const STRAIGHT_WALK_FLAT: Partial<WalkState> = {
  ...FOUR_WALKS_UNFOLDED,
  sw: 0,
  hint4: 0,
  focus: 1,
  hint5: 1,
  flat: 1,
  view: 0,
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
        await scene.to(c, { river: 1 }, 1000);
        await c.wait(250);
        await scene.to(c, { a: 1 }, 450);
        await c.wait(100);
        await scene.to(c, { aDim: 1 }, 700);
        await c.wait(400);
        await scene.to(c, { b: 1 }, 450);
        await c.wait(100);
        await scene.to(c, { bRiver: 1 }, 800);
        await c.wait(150);
        await scene.to(c, { bEast: 1 }, 1100);
        await c.wait(400);
        await scene.to(c, { c: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { walk: 1 }, 2600, 'linear');
        await c.wait(350);
        await scene.to(c, { ask: 1 }, 600);
      },
    },
    {
      stepNumber: 3,
      title: 'Imagine Danny Living on a Folded Paper',
      summary: 'The folded paper',
      initialElements: [makeWalkElement({ ...FIGURE_DRAWN, stepIdx: 2 })],
      async play(c) {
        await scene.to(c, { txt: 0, ask: 0, paper: 1 }, 1200);
        await c.wait(400);
        await scene.to(c, { view: 1 }, 1700);
        await c.wait(700);
        scene.set(c, { switchOpen: true });
        await scene.to(c, { unf: 1 }, 3000);
        await c.wait(400);
        scene.set(c, { controlsOn: true });
        await scene.to(c, { sw: 1, hint3: 1 }, 600);
      },
      // The reader may have left the paper anywhere between folded and unfolded: fold it from there.
      async exit({ controller }) {
        const { hint3, unf } = scene.state(controller) ?? BASE_STATE;
        scene.set(controller, { controlsOn: false, switchOpen: false });
        await Promise.all([
          scene.to(controller, { hint3: 0 }, 600 * hint3),
          scene.to(controller, { unf: 0 }, UNFOLD_MS * unf),
        ]);
      },
    },
    {
      stepNumber: 4,
      title: 'Which Path Is the Shortest?',
      summary: 'Four walks',
      initialElements: [makeWalkElement({ ...PAPER_FOLDED, stepIdx: 3 })],
      async play(c) {
        background(scene.to(c, { lab4: 1 }, 900));
        await scene.to(c, { sub: 1 }, 600);
        await c.wait(200);
        await scene.to(c, { c2: 1 }, 450);
        await c.wait(150);
        await scene.to(c, { c3: 1 }, 450);
        await c.wait(150);
        await scene.to(c, { c4: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { w2: 1 }, 1500, 'linear');
        await c.wait(200);
        await scene.to(c, { w3: 1 }, 1500, 'linear');
        await c.wait(200);
        await scene.to(c, { w4: 1 }, 1500, 'linear');
        await c.wait(400);
        await scene.to(c, { hint4: 1 }, 600);
        scene.set(c, { controlsOn: true });
      },
      // Unfold the paper from wherever the reader left it.
      async exit({ controller }) {
        const { unf } = scene.state(controller) ?? BASE_STATE;
        scene.set(controller, { controlsOn: false, switchOpen: true });
        await scene.to(controller, { unf: 1 }, UNFOLD_MS * (1 - unf));
      },
    },
    {
      stepNumber: 5,
      title: 'Which Path Is the Shortest?',
      summary: 'The straight walk',
      initialElements: [makeWalkElement({ ...FOUR_WALKS_UNFOLDED, stepIdx: 4 })],
      async play(c) {
        await scene.to(c, { sw: 0, hint4: 0 }, 600);
        await c.wait(250);
        await scene.to(c, { focus: 1 }, 900);
        await c.wait(400);
        await scene.to(c, { hint5: 1 }, 600);
      },
      async exit({ controller }) {
        scene.set(controller, { flat: 1 });
        await scene.to(controller, { view: 0 }, 1700);
      },
    },
    {
      stepNumber: 6,
      title: 'Solve the Problem',
      summary: 'The answer',
      initialElements: [makeWalkElement({ ...STRAIGHT_WALK_FLAT, stepIdx: 5 })],
      async play(c) {
        background(scene.to(c, { hint5: 0 }, 500));
        await scene.to(c, { rise: 1 }, 1300);
        await c.wait(250);
        await scene.to(c, { tri: 1 }, 1400);
        await scene.to(c, { dpt: 1 }, 450);
        await c.wait(300);
        await scene.to(c, { swap: 1 }, 900);
        // the working, a piece at a time
        await c.wait(500);
        await scene.to(c, { m1: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { m2: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { m3: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { m4: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { m5: 1 }, 600);
        await c.wait(250);
        await scene.to(c, { ring: 1 }, 900);
      },
    },
  ],
};

mountDemo(dannysWalkDemo);
