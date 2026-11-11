// Summer and Winter: why is summer hot and winter cold? The Earth is tilted, and keeps its tilt as it goes round the
// Sun: in June sunlight meets the ground almost straight on, in December at a slant, and slanted light spreads out.
//
// SeasonsScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  background,
  elementControls,
  mountDemo,
  type DemoConfig,
  type VisualElement,
} from '../../framework';
import { BASE_STATE, SeasonsRenderer, type SeasonsState } from './SeasonsScene';

const SCENE = 'seasons-scene';
const scene = elementControls<SeasonsState>(SCENE);

function makeSeasonsElement(patch: Partial<SeasonsState>): VisualElement<SeasonsState> {
  return {
    id: SCENE,
    type: SCENE,
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

/** How long the Earth takes to go once round the Sun, in ms. */
const YEAR_MS = 4600;
/** How long the camera takes to zoom from the two Earths in to the ground, or back out, in ms. */
const ZOOM_MS = 2400;
/** How long a hint takes to fade in or out, in ms. */
const HINT_MS = 500;

/* ================= what the paper shows as each step begins ================= */
// Each builds on the one before it, so a step's beginning is the end of the step before.

/** The orbit seen from above: the Sun, the Earth in June, and the circle it has drawn in a year. */
const ORBIT_DRAWN: Partial<SeasonsState> = {
  sun: 1,
  earth: 1,
  orbit: 1,
};

/** The orbit seen from the side, the Earth a tilted globe. */
const EARTH_TILTED: Partial<SeasonsState> = {
  ...ORBIT_DRAWN,
  sideView: 1,
  globe: 1,
  axis: 1,
  tilt: 1,
};

/** A print of the Earth left at each of the four months. */
const YEAR_PRINTED: Partial<SeasonsState> = {
  ...EARTH_TILTED,
  prints: 1,
};

/** June's and December's Earths close up, either side of the Sun, with "you" on both. */
const JUNE_AND_DECEMBER: Partial<SeasonsState> = {
  ...YEAR_PRINTED,
  closeUp: 1,
  you: 1,
};

/** The ground at "you" on each Earth, and the ray of sunlight that reaches it. */
const SUNLIGHT_ON_YOU: Partial<SeasonsState> = {
  ...JUNE_AND_DECEMBER,
  floor: 1,
  rays: 1,
};

/* ================= the steps ================= */

export const summerAndWinterDemo: DemoConfig = {
  id: 'summer-and-winter',
  name: 'Summer and Winter',
  renderers: {
    [SCENE]: SeasonsRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'The Question',
      summary: 'The question',
      initialElements: [makeSeasonsElement({ stepIdx: 0, question: 1 })],
      async exit({ controller }) {
        await scene.to(controller, { question: 0 }, 300);
      },
    },
    {
      stepNumber: 2,
      title: 'Is the Sun Closer in Summer?',
      summary: 'A year around the Sun',
      initialElements: [makeSeasonsElement({ stepIdx: 1, names: 1 })],
      async play(c) {
        await scene.to(c, { sun: 1 }, 500);
        await c.wait(300);
        await scene.to(c, { earth: 1 }, 500);
        await c.wait(500);
        await scene.to(c, { distance: 1 }, 700);
        await c.wait(500);
        background(scene.to(c, { names: 0 }, 400));
        // the Earth draws its orbit as it goes, like a compass drawing a circle
        await scene.to(c, { year: 1, orbit: 1 }, YEAR_MS, 'ease-in-out');
        await c.wait(300);
        await scene.to(c, { hintDistance: 1 }, HINT_MS);
      },
      async exit({ controller }) {
        await scene.to(controller, { hintDistance: 0, distance: 0 }, 300);
      },
    },
    {
      stepNumber: 3,
      title: 'Earth Is Tilted',
      summary: 'The tilt',
      initialElements: [makeSeasonsElement({ ...ORBIT_DRAWN, stepIdx: 2 })],
      async play(c) {
        await c.wait(300);
        await scene.to(c, { sideView: 1 }, 1800, 'ease-in-out');
        await c.wait(300);
        await scene.to(c, { globe: 1 }, 900);
        await c.wait(400);
        await scene.to(c, { upright: 1, axis: 1 }, 600);
        await c.wait(600);
        await scene.to(c, { tilt: 1 }, 1400, 'ease-in-out');
      },
    },
    {
      stepNumber: 4,
      title: 'The Tilt Always Points the Same Way',
      summary: 'Around the Sun, tilted',
      initialElements: [makeSeasonsElement({ ...EARTH_TILTED, stepIdx: 3, upright: 1 })],
      async play(c) {
        await scene.to(c, { upright: 0 }, 400);
        await scene.to(c, { year: 1, prints: 1 }, YEAR_MS, 'ease-in-out');
        scene.set(c, { year: 0, earthDraggable: true, ring: 1 });
        await scene.to(c, { hintDragEarth: 1 }, HINT_MS);
      },
      // The reader may have left the Earth anywhere on its orbit: it goes on, or back, to June.
      async exit({ controller }) {
        const { year, hintDragEarth } = scene.state(controller) ?? BASE_STATE;
        const june = year < 0.5 ? 0 : 1;
        scene.set(controller, { earthDraggable: false, ring: 0 });
        await Promise.all([
          scene.to(controller, { hintDragEarth: 0 }, HINT_MS * hintDragEarth),
          scene.to(controller, { year: june }, YEAR_MS * 0.6 * Math.abs(june - year), 'ease-in-out'),
        ]);
      },
    },
    {
      stepNumber: 5,
      title: 'Toward the Sun in June, Away in December',
      summary: 'June and December',
      initialElements: [makeSeasonsElement({ ...YEAR_PRINTED, stepIdx: 4 })],
      async play(c) {
        await c.wait(300);
        await scene.to(c, { closeUp: 1 }, 2000, 'ease-in-out');
        await c.wait(300);
        await scene.to(c, { you: 1 }, 500);
      },
    },
    {
      stepNumber: 6,
      title: 'Straight Light in June, Slanted in December',
      summary: 'Sunlight on you',
      initialElements: [makeSeasonsElement({ ...JUNE_AND_DECEMBER, stepIdx: 5 })],
      async play(c) {
        await c.wait(300);
        await scene.to(c, { floor: 1 }, 500);
        await c.wait(400);
        await scene.to(c, { rays: 1 }, 2400, 'linear');
      },
    },
    {
      stepNumber: 7,
      title: 'Slanted Light Spreads Out and Warms Less',
      summary: 'On the ground',
      initialElements: [makeSeasonsElement({ ...SUNLIGHT_ON_YOU, stepIdx: 6 })],
      async play(c) {
        await c.wait(400);
        await scene.to(c, { ground: 1 }, ZOOM_MS, 'ease-in-out');
        await c.wait(200);
        await scene.to(c, { marks: 1 }, 500);
        scene.set(c, { sunDraggable: true, ring: 1 });
        await scene.to(c, { hintDragSun: 1 }, HINT_MS);
      },
      // The Sun goes back up to June from wherever the reader left it, and the camera zooms back out.
      async exit({ controller }) {
        const { sunHeight, hintDragSun } = scene.state(controller) ?? BASE_STATE;
        scene.set(controller, { sunDraggable: false, ring: 0 });
        await Promise.all([
          scene.to(controller, { hintDragSun: 0, marks: 0 }, HINT_MS * hintDragSun),
          scene.to(controller, { sunHeight: 1 }, 900 * (1 - sunHeight), 'ease-in-out'),
        ]);
        await scene.to(controller, { ground: 0 }, ZOOM_MS, 'ease-in-out');
      },
    },
    {
      stepNumber: 8,
      title: "Earth's Tilt Makes Summer and Winter",
      summary: 'The answer',
      initialElements: [makeSeasonsElement({ ...SUNLIGHT_ON_YOU, stepIdx: 7 })],
      async play(c) {
        await c.wait(400);
        await scene.to(c, { seasons: 1 }, 1800, 'linear');
      },
    },
  ],
};

mountDemo(summerAndWinterDemo);
