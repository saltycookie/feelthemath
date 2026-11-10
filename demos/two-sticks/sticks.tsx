// Two Perpendicular Sticks: AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to
// end on a ruler.
//
// SticksScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  DemoConfig,
  StepAnimationController,
  VisualElement,
  mountDemo,
} from '../../framework';
import {
  BASE,
  SOLVE,
  SticksSceneRenderer,
  type SticksState,
} from './SticksScene';

/* ================= the choreography ================= */
const PAUSE = 600;

type BaseKey = keyof typeof BASE;
const KEYS = Object.keys(BASE) as BaseKey[];

const PIC: typeof BASE = {
  ...BASE,
  draw: 1,
  marks: 1,
  lift: 0,
  away: 0,
  wood: 0,
  bdOut: 0,
  bdIn: 0,
  pick: 0,
  ylbl: 0,
  zlbl: 0,
  bdl: 0,
  prob: 1,
};

const T: Record<string | number, typeof BASE> = {
  1: { ...PIC },
  2: { ...PIC, prompt: 1, marks: 0, draw: 0, wood: 1, lift: 1 },
  3: { ...BASE, bdIn: 0, cross: 0, xdim: 1, bdl: 0 },
  4: { ...BASE, cross: 0, xdim: 1 },
  across: { ...BASE, sq: 1 },
  5: { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1 },
  6: {
    ...BASE,
    sq: 1,
    thinAB: 1,
    t1l: 1,
    thinCD: 1,
    t2l: 1,
    lay: 1,
    eqn: 1,
  },
  7: {
    ...BASE,
    sq: 1,
    thinAB: 1,
    t1l: 1,
    thinCD: 1,
    t2l: 1,
    lay: 1,
    eqn: 1,
    fade: 1,
    gather: 1,
  },
};

const CHOREO: Record<string | number, Partial<Record<BaseKey, [number, number]>>> = {
  2: {
    prompt: [0, 700],
    marks: [1300, 600],
    draw: [1400, 800],
    wood: [1400, 1500],
    lift: [1400, 1200],
  },
  3: {
    prompt: [0, 700],
    prob: [0, 700],
    away: [500, 3200],
    bdOut: [3300, 1280],
    cross: [4600, 900],
    xdim: [5600, 600],
    pick: [6300, 1500],
    ylbl: [7900, 600],
    zlbl: [8700, 600],
  },
  4: { bdIn: [300, 1280], bdl: [1700, 2800] },
  across: { xdim: [0, 350], cross: [200, 1500], sq: [1550, 400] },
  5: {
    thinAB: [300, 1300],
    t1l: [1700, 600],
    thinCD: [2600, 1500],
    t2l: [4200, 600],
  },
  6: { lay: [200, 1900], eqn: [2250, 600] },
  7: { fade: [0, 800], prob: [0, 600], gather: [450, 1100] },
};

const LINEAR_KEYS = new Set<string>(['away', 'lay', 'pick', 'bdl']);

const SOLVE_SEQ: [number, keyof typeof SOLVE][] = [
  [2300, 'sol2'],
  [3400, 'strike'],
  [4300, 'sol3'],
  [5600, 'sol4'],
  [6900, 'sol5'],
  [8300, 'sol6'],
];

function makeSticksElement(
  baseLook: typeof BASE,
  stepIdx: number
): VisualElement<SticksState> {
  return {
    id: 'sticks-scene',
    type: 'sticks-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: {
      ...baseLook,
      ...SOLVE,
      stepIdx,
      pulseCount: 0,
    },
  };
}

async function playParts(
  c: StepAnimationController,
  initialFrom: typeof BASE,
  parts: (string | number)[]
) {
  let from = initialFrom;
  for (let i = 0; i < parts.length; i++) {
    const partKey = parts[i];
    const to = T[partKey];
    const plan = CHOREO[partKey] || {};
    const tasks: Promise<void>[] = [];

    for (const key of KEYS) {
      if (Math.abs(from[key] - to[key]) < 1e-4) continue;
      const [delay, dur] = plan[key] || [0, 600];
      const easing = LINEAR_KEYS.has(key) ? 'linear' : undefined;
      const targetVal = to[key];
      tasks.push(
        (async () => {
          if (delay > 0) await c.wait(delay);
          await c.animateElement(
            'sticks-scene',
            { state: { [key]: targetVal } as Partial<SticksState> },
            { durationMs: dur, easing }
          );
        })()
      );
    }

    await Promise.all(tasks);
    from = to;
    if (i < parts.length - 1) {
      await c.wait(PAUSE);
    }
  }
}

export const twoSticksDemo: DemoConfig = {
  id: 'two-sticks',
  name: 'Two Perpendicular Sticks',
  renderers: {
    'sticks-scene': SticksSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeSticksElement(T[1], 0)],
      async play(c) {
        const cur =
          (c.getElements()['sticks-scene']?.state as SticksState | undefined)
            ?.pulseCount ?? 0;
        c.updateElementImmediate('sticks-scene', {
          state: { pulseCount: cur + 1 },
        });
      },
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'Think',
      initialElements: [makeSticksElement(T[1], 1)],
      async play(c) {
        await playParts(c, T[1], [2]);
      },
    },
    {
      stepNumber: 3,
      title: 'Recreate the Figure',
      summary: 'Label AC',
      initialElements: [makeSticksElement(T[2], 2)],
      async play(c) {
        await playParts(c, T[2], [3]);
      },
    },
    {
      stepNumber: 4,
      title: 'Recreate the Figure',
      summary: 'Lay BD across AC',
      initialElements: [makeSticksElement(T[3], 3)],
      async play(c) {
        await playParts(c, T[3], [4, 'across']);
      },
    },
    {
      stepNumber: 5,
      title: 'Recreate the Figure',
      summary: 'Label AB and CD',
      initialElements: [makeSticksElement(T.across, 4)],
      async play(c) {
        await playParts(c, T.across, [5]);
      },
    },
    {
      stepNumber: 6,
      title: 'Recreate the Figure',
      summary: 'Lay them on the ruler',
      initialElements: [makeSticksElement(T[5], 5)],
      async play(c) {
        await playParts(c, T[5], [6]);
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Equation',
      summary: 'Solve',
      initialElements: [makeSticksElement(T[6], 6)],
      async play(c) {
        const solvePromises = SOLVE_SEQ.map(async ([delay, key]) => {
          await c.wait(delay);
          c.updateElementImmediate('sticks-scene', {
            state: { [key]: 1 } as Partial<SticksState>,
          });
        });
        await Promise.all([playParts(c, T[6], [7]), ...solvePromises]);
      },
    },
  ],
};

mountDemo(twoSticksDemo);
