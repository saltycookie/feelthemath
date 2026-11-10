// Danny's Walk: from the playground to the river and on home: how short can the walk be? A paper folded along the
// river unfolds, and the shortest walk becomes a straight line.
//
// WalkScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  MathDemoPlayer,
  VisualElement,
} from '../../framework';
import {
  BASE_STATE,
  WalkSceneRenderer,
  type WalkState,
} from './WalkScene';

function makeWalkElement(patch: Partial<WalkState>): VisualElement<WalkState> {
  return {
    id: 'walk-scene',
    type: 'walk-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

const STEP2_DONE: Partial<WalkState> = {
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

const STEP3_DONE: Partial<WalkState> = {
  ...STEP2_DONE,
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

const STEP4_DONE: Partial<WalkState> = {
  ...STEP3_DONE,
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

const STEP5_DONE: Partial<WalkState> = {
  ...STEP4_DONE,
  sw: 0,
  hint4: 0,
  focus: 1,
  hint5: 1,
  flat: 1,
  view: 0,
};

export const dannysWalkDemo: DemoConfig = {
  id: 'dannys-walk',
  name: "Danny's Walk",
  renderers: {
    'walk-scene': WalkSceneRenderer,
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
        await c.animateElement(
          'walk-scene',
          { state: { river: 1 } },
          { durationMs: 1000 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { a: 1 } },
          { durationMs: 450 }
        );
        await c.wait(100);
        await c.animateElement(
          'walk-scene',
          { state: { aDim: 1 } },
          { durationMs: 700 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { b: 1 } },
          { durationMs: 450 }
        );
        await c.wait(100);
        await c.animateElement(
          'walk-scene',
          { state: { bRiver: 1 } },
          { durationMs: 800 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { bEast: 1 } },
          { durationMs: 1100 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { c: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { walk: 1 } },
          { durationMs: 2600, easing: 'linear' }
        );
        await c.wait(350);
        await c.animateElement(
          'walk-scene',
          { state: { ask: 1 } },
          { durationMs: 600 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'Imagine Danny Living on a Folded Paper',
      summary: 'The folded paper',
      initialElements: [
        makeWalkElement({
          ...STEP2_DONE,
          stepIdx: 2,
          switchOpen: false,
          controlsOn: false,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'walk-scene',
          { state: { txt: 0, ask: 0, paper: 1 } },
          { durationMs: 1200 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { view: 1 } },
          { durationMs: 1700 }
        );
        await c.wait(700);
        c.updateElementImmediate('walk-scene', { state: { switchOpen: true } });
        await c.animateElement(
          'walk-scene',
          { state: { unf: 1 } },
          { durationMs: 3000 }
        );
        await c.wait(400);
        c.updateElementImmediate('walk-scene', { state: { controlsOn: true } });
        await c.animateElement(
          'walk-scene',
          { state: { sw: 1, hint3: 1 } },
          { durationMs: 600 }
        );
      },
      async exit({ currentElements, controller }) {
        const s = currentElements['walk-scene']?.state as WalkState | undefined;
        const curHint3 = s?.hint3 ?? 0;
        const curUnf = s?.unf ?? 0;
        controller.updateElementImmediate('walk-scene', {
          state: { controlsOn: false, switchOpen: false },
        });
        await Promise.all([
          controller.animateElement(
            'walk-scene',
            { state: { hint3: 0 } },
            { durationMs: 600 * curHint3 }
          ),
          controller.animateElement(
            'walk-scene',
            { state: { unf: 0 } },
            { durationMs: 2600 * curUnf }
          ),
        ]);
      },
    },
    {
      stepNumber: 4,
      title: 'Which Path Is the Shortest?',
      summary: 'Four walks',
      initialElements: [
        makeWalkElement({
          ...STEP3_DONE,
          stepIdx: 3,
          switchOpen: false,
          controlsOn: false,
        }),
      ],
      async play(c) {
        c.animateElement(
          'walk-scene',
          { state: { lab4: 1 } },
          { durationMs: 900 }
        ).catch(() => {});
        await c.animateElement(
          'walk-scene',
          { state: { sub: 1 } },
          { durationMs: 600 }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { c2: 1 } },
          { durationMs: 450 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { c3: 1 } },
          { durationMs: 450 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { c4: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { w2: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { w3: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { w4: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { hint4: 1 } },
          { durationMs: 600 }
        );
        c.updateElementImmediate('walk-scene', { state: { controlsOn: true } });
      },
      async exit({ currentElements, controller }) {
        const s = currentElements['walk-scene']?.state as WalkState | undefined;
        const curUnf = s?.unf ?? 0;
        controller.updateElementImmediate('walk-scene', {
          state: { controlsOn: false, switchOpen: true },
        });
        await controller.animateElement(
          'walk-scene',
          { state: { unf: 1 } },
          { durationMs: 2600 * (1 - curUnf) }
        );
      },
    },
    {
      stepNumber: 5,
      title: 'Which Path Is the Shortest?',
      summary: 'The straight walk',
      initialElements: [
        makeWalkElement({
          ...STEP4_DONE,
          stepIdx: 4,
          switchOpen: true,
          controlsOn: false,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'walk-scene',
          { state: { sw: 0, hint4: 0 } },
          { durationMs: 600 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { focus: 1 } },
          { durationMs: 900 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { hint5: 1 } },
          { durationMs: 600 }
        );
      },
      async exit({ controller }) {
        controller.updateElementImmediate('walk-scene', { state: { flat: 1 } });
        await controller.animateElement(
          'walk-scene',
          { state: { view: 0 } },
          { durationMs: 1700 }
        );
      },
    },
    {
      stepNumber: 6,
      title: 'Solve the Problem',
      summary: 'The answer',
      initialElements: [
        makeWalkElement({
          ...STEP5_DONE,
          stepIdx: 5,
        }),
      ],
      async play(c) {
        c.animateElement(
          'walk-scene',
          { state: { hint5: 0 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.animateElement(
          'walk-scene',
          { state: { rise: 1 } },
          { durationMs: 1300 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { tri: 1 } },
          { durationMs: 1400 }
        );
        await c.animateElement(
          'walk-scene',
          { state: { dpt: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { swap: 1 } },
          { durationMs: 900 }
        );
        await c.wait(500);
        await c.animateElement(
          'walk-scene',
          { state: { m1: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m2: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m3: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m4: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m5: 1 } },
          { durationMs: 600 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { ring: 1 } },
          { durationMs: 900 }
        );
      },
    },
  ],
};

const container = document.getElementById('deck');
if (container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={dannysWalkDemo} />);
  });
}
