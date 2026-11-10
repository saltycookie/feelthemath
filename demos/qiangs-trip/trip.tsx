// Qiang's Trip: 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart.
//
// TripScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  background,
  elementControls,
  mountDemo,
  type DemoConfig,
  type StepAnimationController,
  type VisualElement,
} from '../../framework';
import {
  BASE_STATE,
  PART1,
  ROAD_MS,
  START,
  TripSceneRenderer,
  type BubbleKey,
  type TripState,
} from './TripScene';

const SCENE = 'trip-scene';
const scene = elementControls<TripState>(SCENE);

function makeTripElement(patch: Partial<TripState>): VisualElement<TripState> {
  return {
    id: SCENE,
    type: SCENE,
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

/* ================= the bubble ================= */

const BUBBLE_IN_MS = 260;
const BUBBLE_OUT_MS = 220;

/** Puts `key`'s words in the bubble and fades it in. Await it, or pass it to background() to carry on meanwhile. */
function showBubble(c: StepAnimationController, key: BubbleKey): Promise<void> {
  scene.set(c, { bubbleKey: key });
  return scene.to(c, { bubbleOpacity: 1 }, BUBBLE_IN_MS);
}

/** Fades the bubble out: what a step with a bubble does on Next. */
function hideBubble(c: StepAnimationController): Promise<void> {
  return scene.to(c, { bubbleOpacity: 0 }, BUBBLE_OUT_MS);
}

/* ================= what the chart shows as each step begins ================= */
// Each builds on the one before it, so a step's beginning is the end of the step before.

/** The empty chart, the point and the car at the start of the first part. */
const PART1_START: Partial<TripState> = {
  chartView: 1,
  pointX: 0,
  pointY: PART1.y,
  handleRadius: 5,
  carX: 0,
  timeTicksOpacity: 0,
  draggable: false,
};

/** The first part driven: its rectangle, labelled 15 mi, 30 mph tall and 0.5 h wide. */
const PART1_DRAWN: Partial<TripState> = {
  ...PART1_START,
  pointX: PART1.x,
  carX: PART1.x,
  part1Opacity: 1,
  part1LabelOpacity: 1,
  speedChipOpacity: 1,
  timeChipOpacity: 1,
  carOpacity: 1,
  bubbleKey: 'none',
  bubbleOpacity: 0,
};

/** The second part driven: its rectangle at 55 mph, of unknown width. */
const PART2_DRAWN: Partial<TripState> = {
  ...PART1_DRAWN,
  part2Opacity: 1,
  part2Reach: 2 / 3,
  part2LabelOpacity: 1,
  speed2ChipOpacity: 1,
  time2BraceOpacity: 1,
  carX: 2.5,
};

/** The 50 mph average line across both parts; the car gone. */
const AVERAGE_DRAWN: Partial<TripState> = {
  ...PART2_DRAWN,
  averageProgress: 1,
  carOpacity: 0,
};

/** The deficit and the surplus outlined in pink. */
const AREAS_OUTLINED: Partial<TripState> = {
  ...AVERAGE_DRAWN,
  areasOutlineOpacity: 1,
  equalArrowsOpacity: 0,
};

/** Both areas labelled 10 mi. */
const AREAS_LABELLED: Partial<TripState> = {
  ...AREAS_OUTLINED,
  areasLabelOpacity: 1,
};

/** The second part's time found: 2 h, ending at 2.5 h. */
const TIME2_FOUND: Partial<TripState> = {
  ...AREAS_LABELLED,
  time2Known: 1,
  endTimeChipOpacity: 1,
};

/* ================= the steps ================= */

export const qiangsTripDemo: DemoConfig = {
  id: 'qiangs-trip',
  name: "Qiang's Trip",
  renderers: {
    [SCENE]: TripSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeTripElement({ stepIdx: 0 })],
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'The trip as a road',
      initialElements: [makeTripElement({ stepIdx: 1, chartView: 0, roadProgress: 0 })],
      async play(c) {
        // The road draws itself on its own timeline (ROAD in TripScene.tsx), so `roadProgress` moves at a steady rate.
        await scene.to(c, { roadProgress: 1 }, ROAD_MS, 'linear');
      },
      async exit({ controller }) {
        await scene.to(controller, { chartView: 1 }, 1100);
      },
    },
    {
      stepNumber: 3,
      title: 'Use Area to Represent Distance',
      summary: 'Distance is an area',
      initialElements: [
        makeTripElement({
          stepIdx: 2,
          chartView: 1,
          roadProgress: 1,
          pointX: START.x,
          pointY: START.y,
          pickedX: START.x,
          pickedY: START.y,
          draggable: true,
        }),
      ],
      async play(c) {
        await scene.to(c, { handleOpacity: 1, handleRing: 1, part1Opacity: 1, part1LabelOpacity: 1, speedChipOpacity: 1, timeChipOpacity: 1, formulaOpacity: 1 }, 500);
      },
      async exit({ controller }) {
        scene.set(controller, { draggable: false });
        await scene.to(
          controller,
          { handleOpacity: 0, handleRing: 0, part1Opacity: 0, part1LabelOpacity: 0, speedChipOpacity: 0, timeChipOpacity: 0, formulaOpacity: 0, timeTicksOpacity: 0 },
          220
        );
      },
    },
    {
      stepNumber: 4,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 1: 0.5 hours',
      initialElements: [makeTripElement({ ...PART1_START, stepIdx: 3 })],
      async play(c) {
        scene.set(c, { part1Opacity: 1 });
        background(scene.to(c, { carOpacity: 1 }, 350));
        await c.wait(200);
        background(scene.to(c, { speedChipOpacity: 1 }, 400));
        await c.wait(900);
        await scene.to(c, { carX: PART1.x, pointX: PART1.x }, 1500);
        await c.wait(150);
        background(scene.to(c, { part1LabelOpacity: 1 }, 500));
        await c.wait(150);
        await showBubble(c, 'time1');
        await scene.to(c, { timeChipOpacity: 1 }, 400);
      },
      async exit({ controller }) {
        await hideBubble(controller);
      },
    },
    {
      stepNumber: 5,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 2: unknown time',
      initialElements: [makeTripElement({ ...PART1_DRAWN, stepIdx: 4 })],
      async play(c) {
        scene.set(c, { part2Opacity: 1 });
        background(scene.to(c, { speed2ChipOpacity: 1 }, 400));
        await c.wait(1000);
        await scene.to(c, { carX: 2.5, part2Reach: 2 / 3 }, 2000);
        background(scene.to(c, { part2LabelOpacity: 1 }, 500));
        await c.wait(150);
        await scene.to(c, { time2BraceOpacity: 1 }, 500);
      },
    },
    {
      stepNumber: 6,
      title: "Let's Use Area to Describe the Problem",
      summary: 'The average speed',
      initialElements: [makeTripElement({ ...PART2_DRAWN, stepIdx: 5 })],
      async play(c) {
        background(scene.to(c, { carOpacity: 0 }, 500));
        await scene.to(c, { averageProgress: 1 }, 1000);
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Problem',
      summary: 'The two areas must be equal',
      initialElements: [makeTripElement({ ...AVERAGE_DRAWN, stepIdx: 6 })],
      async play(c) {
        await c.wait(300);
        background(scene.to(c, { areasOutlineOpacity: 1 }, 600));
        await c.wait(1100);
        background(showBubble(c, 'equal'));
        await scene.to(c, { equalArrowsOpacity: 1 }, 450);
      },
      async exit({ controller }) {
        // the bubble, and the two arrows that point from it at the areas
        await scene.to(controller, { bubbleOpacity: 0, equalArrowsOpacity: 0 }, BUBBLE_OUT_MS);
      },
    },
    {
      stepNumber: 8,
      title: 'Solve the Problem',
      summary: 'The deficit is 10 miles',
      initialElements: [makeTripElement({ ...AREAS_OUTLINED, stepIdx: 7 })],
      async play(c) {
        await c.wait(300);
        background(showBubble(c, 'area'));
        await c.wait(1000);
        await scene.to(c, { areasLabelOpacity: 1 }, 500);
      },
      async exit({ controller }) {
        await hideBubble(controller);
      },
    },
    {
      stepNumber: 9,
      title: 'Solve the Problem',
      summary: 'Part 2 takes 2 hours',
      initialElements: [makeTripElement({ ...AREAS_LABELLED, stepIdx: 8 })],
      async play(c) {
        await c.wait(300);
        background(showBubble(c, 'time2'));
        await c.wait(1500);
        await scene.to(c, { time2Known: 1, endTimeChipOpacity: 1 }, 500);
      },
      async exit({ controller }) {
        await hideBubble(controller);
      },
    },
    {
      stepNumber: 10,
      title: 'Solve the Problem',
      summary: 'The answer: 110 miles',
      initialElements: [makeTripElement({ ...TIME2_FOUND, stepIdx: 9 })],
      async play(c) {
        await c.wait(300);
        background(showBubble(c, 'answer'));
        await c.wait(1200);
        await scene.to(c, { distance2Known: 1 }, 500);
      },
    },
  ],
};

mountDemo(qiangsTripDemo);
