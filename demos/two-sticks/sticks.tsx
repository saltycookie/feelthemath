// Two Perpendicular Sticks: AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to
// end on a ruler.
//
// SticksScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  elementControls,
  mountDemo,
  type DemoConfig,
  type StepAnimationController,
  type VisualElement,
} from '../../framework';
import {
  BASE,
  SOLVE,
  SticksSceneRenderer,
  type SticksState,
} from './SticksScene';

const SCENE = 'sticks-scene';
const scene = elementControls<SticksState>(SCENE);

/* ================= the choreography ================= */

/** The figure's values at one moment: BASE with some of them changed. */
type Look = typeof BASE;
type LookKey = keyof Look;
const LOOK_KEYS = Object.keys(BASE) as LookKey[];

/** The homework figure as printed: pencil lines, with its marks and the question. */
const PRINTED: Look = {
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
/** Both thin sticks back on the figure and labelled. */
const THIN_STICKS_ON: Look = { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1 };
/** The thin sticks end to end on the ruler, with the equation they make. */
const ON_THE_RULER: Look = { ...THIN_STICKS_ON, lay: 1, eqn: 1 };

/**
 * The look each part of the choreography ends on. A part is named after the step that plays it; step 4 plays
 * two, `4` and then `across`.
 */
const LOOKS = {
  1: PRINTED,
  2: { ...PRINTED, prompt: 1, marks: 0, draw: 0, wood: 1, lift: 1 },
  3: { ...BASE, bdIn: 0, cross: 0, xdim: 1, bdl: 0 },
  4: { ...BASE, cross: 0, xdim: 1 },
  across: { ...BASE, sq: 1 },
  5: THIN_STICKS_ON,
  6: ON_THE_RULER,
  7: { ...ON_THE_RULER, fade: 1, gather: 1 },
} satisfies Record<string, Look>;
type Part = keyof typeof LOOKS;

/** When a value starts to change within its part, and for how long: [delay, duration] in ms. */
type Timing = [delayMs: number, durationMs: number];
/** For a value that changes in a part without being listed in TIMINGS. */
const DEFAULT_TIMING: Timing = [0, 600];

const TIMINGS: Partial<Record<Part, Partial<Record<LookKey, Timing>>>> = {
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

/** Values the scene itself turns into staged, eased movements, so they are animated at a steady rate. */
const LINEAR_KEYS = new Set<LookKey>(['away', 'lay', 'pick', 'bdl']);

/** The pause between two parts of one step, in ms. */
const PAUSE_BETWEEN_PARTS_MS = 600;

/** When each line of the working appears in step 7, in ms from the start of the step. */
const SOLVE_SEQUENCE: [atMs: number, key: keyof typeof SOLVE][] = [
  [2300, 'sol2'],
  [3400, 'strike'],
  [4300, 'sol3'],
  [5600, 'sol4'],
  [6900, 'sol5'],
  [8300, 'sol6'],
];

function makeSticksElement(look: Look, stepIdx: number): VisualElement<SticksState> {
  return {
    id: SCENE,
    type: SCENE,
    x: 0,
    y: 0,
    opacity: 1,
    state: {
      ...look,
      ...SOLVE,
      stepIdx,
      pulseCount: 0,
    },
  };
}

/** Animates one value of the look to `value`, after `delayMs`. */
async function animateValue(
  c: StepAnimationController,
  key: LookKey,
  value: number,
  [delayMs, durationMs]: Timing
): Promise<void> {
  if (delayMs > 0) await c.wait(delayMs);
  const state: Partial<SticksState> = {};
  state[key] = value;
  await scene.to(c, state, durationMs, LINEAR_KEYS.has(key) ? 'linear' : undefined);
}

/**
 * Plays `parts` one after another, starting from the look `start`. Within a part, every value that differs from
 * the part's look moves to it on its own timing, all at once.
 */
async function playParts(c: StepAnimationController, start: Look, parts: Part[]): Promise<void> {
  let from = start;
  for (const [i, part] of parts.entries()) {
    if (i > 0) await c.wait(PAUSE_BETWEEN_PARTS_MS);
    const to: Look = LOOKS[part];
    const timings = TIMINGS[part] ?? {};
    await Promise.all(
      LOOK_KEYS.filter((key) => Math.abs(from[key] - to[key]) >= 1e-4).map((key) =>
        animateValue(c, key, to[key], timings[key] ?? DEFAULT_TIMING)
      )
    );
    from = to;
  }
}

export const twoSticksDemo: DemoConfig = {
  id: 'two-sticks',
  name: 'Two Perpendicular Sticks',
  renderers: {
    [SCENE]: SticksSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeSticksElement(LOOKS[1], 0)],
      // Nothing moves; a new pulseCount makes the scene pulse the figure's marks.
      async play(c) {
        scene.set(c, { pulseCount: (scene.state(c)?.pulseCount ?? 0) + 1 });
      },
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'Think',
      initialElements: [makeSticksElement(LOOKS[1], 1)],
      async play(c) {
        await playParts(c, LOOKS[1], [2]);
      },
    },
    {
      stepNumber: 3,
      title: 'Recreate the Figure',
      summary: 'Label AC',
      initialElements: [makeSticksElement(LOOKS[2], 2)],
      async play(c) {
        await playParts(c, LOOKS[2], [3]);
      },
    },
    {
      stepNumber: 4,
      title: 'Recreate the Figure',
      summary: 'Lay BD across AC',
      initialElements: [makeSticksElement(LOOKS[3], 3)],
      async play(c) {
        await playParts(c, LOOKS[3], [4, 'across']);
      },
    },
    {
      stepNumber: 5,
      title: 'Recreate the Figure',
      summary: 'Label AB and CD',
      initialElements: [makeSticksElement(LOOKS.across, 4)],
      async play(c) {
        await playParts(c, LOOKS.across, [5]);
      },
    },
    {
      stepNumber: 6,
      title: 'Recreate the Figure',
      summary: 'Lay them on the ruler',
      initialElements: [makeSticksElement(LOOKS[5], 5)],
      async play(c) {
        await playParts(c, LOOKS[5], [6]);
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Equation',
      summary: 'Solve',
      initialElements: [makeSticksElement(LOOKS[6], 6)],
      async play(c) {
        // The equation flies up into the working while the working's lines appear on their own clock.
        const working = SOLVE_SEQUENCE.map(async ([atMs, key]) => {
          await c.wait(atMs);
          const state: Partial<SticksState> = {};
          state[key] = 1;
          scene.set(c, state);
        });
        await Promise.all([playParts(c, LOOKS[6], [7]), ...working]);
      },
    },
  ],
};

mountDemo(twoSticksDemo);
