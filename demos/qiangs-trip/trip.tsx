// Qiang's Trip: 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart.
//
// TripScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import {
  DemoConfig,
  VisualElement,
  mountDemo,
} from '../../framework';
import {
  BASE_STATE,
  PART1,
  ROAD_MS,
  START,
  TripSceneRenderer,
  type TripState,
} from './TripScene';

function makeTripElement(patch: Partial<TripState>): VisualElement<TripState> {
  return {
    id: 'trip-scene',
    type: 'trip-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

const STEP4_START: Partial<TripState> = {
  view: 1,
  ptX: 0,
  ptY: PART1.y,
  hR: 5,
  carX: 0,
  xtOp: 0,
  dragOn: false,
};

const STEP4_DONE: Partial<TripState> = {
  ...STEP4_START,
  ptX: PART1.x,
  carX: PART1.x,
  r1Op: 1,
  r1Lab: 1,
  gdOp: 1,
  gxOp: 1,
  carOp: 1,
  bubbleKey: 'none',
  bubble0: 0,
};

const STEP5_DONE: Partial<TripState> = {
  ...STEP4_DONE,
  r2Op: 1,
  r2Rev: 2 / 3,
  r2LabOp: 1,
  y55: 1,
  brkOp: 1,
  carX: 2.5,
};

const STEP6_DONE: Partial<TripState> = {
  ...STEP5_DONE,
  avgP: 1,
  carOp: 0,
};

const STEP7_DONE: Partial<TripState> = {
  ...STEP6_DONE,
  hiOp: 1,
  eqOp: 0,
  bubbleKey: 'none',
  bubble0: 0,
};

const STEP8_DONE: Partial<TripState> = {
  ...STEP7_DONE,
  hlOp: 1,
};

const STEP9_DONE: Partial<TripState> = {
  ...STEP8_DONE,
  lab: 1,
  x25: 1,
};

export const qiangsTripDemo: DemoConfig = {
  id: 'qiangs-trip',
  name: "Qiang's Trip",
  renderers: {
    'trip-scene': TripSceneRenderer,
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
      initialElements: [makeTripElement({ stepIdx: 1, view: 0, road: 0 })],
      async play(c) {
        await c.animateElement(
          'trip-scene',
          { state: { road: 1 } },
          { durationMs: ROAD_MS, easing: 'linear' }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { view: 1 } },
          { durationMs: 1100 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'Use Area to Represent Distance',
      summary: 'Distance is an area',
      initialElements: [
        makeTripElement({
          stepIdx: 2,
          view: 1,
          road: 1,
          ptX: START.x,
          ptY: START.y,
          uX: START.x,
          uY: START.y,
          dragOn: true,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'trip-scene',
          {
            state: {
              hOp: 1,
              ring: 1,
              r1Op: 1,
              r1Lab: 1,
              gdOp: 1,
              gxOp: 1,
              fOp: 1,
            },
          },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        controller.updateElementImmediate('trip-scene', {
          state: { dragOn: false },
        });
        await controller.animateElement(
          'trip-scene',
          {
            state: {
              hOp: 0,
              ring: 0,
              r1Op: 0,
              r1Lab: 0,
              gdOp: 0,
              gxOp: 0,
              fOp: 0,
              xtOp: 0,
            },
          },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 4,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 1: 0.5 hours',
      initialElements: [
        makeTripElement({
          ...STEP4_START,
          stepIdx: 3,
        }),
      ],
      async play(c) {
        c.updateElementImmediate('trip-scene', { state: { r1Op: 1 } });
        c.animateElement(
          'trip-scene',
          { state: { carOp: 1 } },
          { durationMs: 350 }
        ).catch(() => {});
        await c.wait(200);
        c.animateElement(
          'trip-scene',
          { state: { gdOp: 1 } },
          { durationMs: 400 }
        ).catch(() => {});
        await c.wait(900);
        await c.animateElement(
          'trip-scene',
          { state: { carX: 0.5, ptX: 0.5 } },
          { durationMs: 1500 }
        );
        await c.wait(150);
        c.animateElement(
          'trip-scene',
          { state: { r1Lab: 1 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.wait(150);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'time1' },
        });
        await c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        );
        await c.animateElement(
          'trip-scene',
          { state: { gxOp: 1 } },
          { durationMs: 400 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 5,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 2: unknown time',
      initialElements: [
        makeTripElement({
          ...STEP4_DONE,
          stepIdx: 4,
        }),
      ],
      async play(c) {
        c.updateElementImmediate('trip-scene', { state: { r2Op: 1 } });
        c.animateElement(
          'trip-scene',
          { state: { y55: 1 } },
          { durationMs: 400 }
        ).catch(() => {});
        await c.wait(1000);
        await c.animateElement(
          'trip-scene',
          { state: { carX: 2.5, r2Rev: 2 / 3 } },
          { durationMs: 2000 }
        );
        c.animateElement(
          'trip-scene',
          { state: { r2LabOp: 1 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.wait(150);
        await c.animateElement(
          'trip-scene',
          { state: { brkOp: 1 } },
          { durationMs: 500 }
        );
      },
    },
    {
      stepNumber: 6,
      title: "Let's Use Area to Describe the Problem",
      summary: 'The average speed',
      initialElements: [
        makeTripElement({
          ...STEP5_DONE,
          stepIdx: 5,
        }),
      ],
      async play(c) {
        c.animateElement(
          'trip-scene',
          { state: { carOp: 0 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.animateElement(
          'trip-scene',
          { state: { avgP: 1 } },
          { durationMs: 1000 }
        );
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Problem',
      summary: 'The two areas must be equal',
      initialElements: [
        makeTripElement({
          ...STEP6_DONE,
          stepIdx: 6,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.animateElement(
          'trip-scene',
          { state: { hiOp: 1 } },
          { durationMs: 600 }
        ).catch(() => {});
        await c.wait(1100);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'equal' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.animateElement(
          'trip-scene',
          { state: { eqOp: 1 } },
          { durationMs: 450 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0, eqOp: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 8,
      title: 'Solve the Problem',
      summary: 'The deficit is 10 miles',
      initialElements: [
        makeTripElement({
          ...STEP7_DONE,
          stepIdx: 7,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'area' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1000);
        await c.animateElement(
          'trip-scene',
          { state: { hlOp: 1 } },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 9,
      title: 'Solve the Problem',
      summary: 'Part 2 takes 2 hours',
      initialElements: [
        makeTripElement({
          ...STEP8_DONE,
          stepIdx: 8,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'time2' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1500);
        await c.animateElement(
          'trip-scene',
          { state: { lab: 1, x25: 1 } },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 10,
      title: 'Solve the Problem',
      summary: 'The answer: 110 miles',
      initialElements: [
        makeTripElement({
          ...STEP9_DONE,
          stepIdx: 9,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'answer' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1200);
        await c.animateElement(
          'trip-scene',
          { state: { ans: 1 } },
          { durationMs: 500 }
        );
      },
    },
  ],
};

mountDemo(qiangsTripDemo);
