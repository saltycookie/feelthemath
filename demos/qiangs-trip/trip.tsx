// Qiang's Trip: 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart.
//
// TripScene.tsx has the scene: its state, and the renderer that draws it. This file has the steps.

import { mountDemo, type DemoConfig } from '../../framework';
import {
  PART1,
  ROAD_MS,
  START,
  TripSceneRenderer,
  type TripState,
} from './TripScene';

const BUBBLE_IN_MS = 260;
const BUBBLE_OUT_MS = 220;

export const qiangsTripDemo: DemoConfig<{ 'trip-scene': TripState }> = {
  id: 'qiangs-trip',
  name: "Qiang's Trip",
  renderers: {
    'trip-scene': TripSceneRenderer,
  },
  steps: [
    {
      title: 'Problem Description',
      summary: 'The problem',
      elements: ['trip-scene'],
    },
    {
      title: 'Problem Description',
      summary: 'The trip as a road',
      play: { ms: ROAD_MS, easing: 'linear', set: { roadProgress: 1 } },
      exit: { ms: 1100, set: { chartView: 1 } },
    },
    {
      title: 'Use Area to Represent Distance',
      summary: 'Distance is an area',
      play: [
        {
          set: {
            pointX: START.x,
            pointY: START.y,
            pickedX: START.x,
            pickedY: START.y,
            draggable: true,
            timeTicksOpacity: 1,
          },
        },
        {
          ms: 500,
          set: {
            handleOpacity: 1,
            handleRing: 1,
            part1Opacity: 1,
            part1LabelOpacity: 1,
            speedChipOpacity: 1,
            timeChipOpacity: 1,
            formulaOpacity: 1,
          },
        },
      ],
      exit: [
        { unset: ['draggable'] },
        {
          ms: 220,
          unset: [
            'handleOpacity',
            'handleRing',
            'part1Opacity',
            'part1LabelOpacity',
            'speedChipOpacity',
            'timeChipOpacity',
            'formulaOpacity',
            'timeTicksOpacity',
          ],
        },
      ],
    },
    {
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 1: 0.5 hours',
      play: [
        { set: { pointX: 0, pointY: PART1.y, handleRadius: 5, carX: 0, part1Opacity: 1 } },
        {
          parallel: [
            { ms: 350, set: { carOpacity: 1 } },
            { wait: 200, ms: 400, set: { speedChipOpacity: 1 } },
            { wait: 1100, ms: 1500, set: { carX: PART1.x, pointX: PART1.x } },
          ],
        },
        {
          wait: 150,
          parallel: [
            { ms: 500, set: { part1LabelOpacity: 1 } },
            [
              { wait: 150, set: { bubbleKey: 'time1' } },
              { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
              { ms: 400, set: { timeChipOpacity: 1 } },
            ],
          ],
        },
      ],
      exit: [
        { ms: BUBBLE_OUT_MS, unset: ['bubbleOpacity'] },
        { unset: ['bubbleKey'] },
      ],
    },
    {
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 2: unknown time',
      play: [
        { set: { part2Opacity: 1 } },
        {
          parallel: [
            { ms: 400, set: { speed2ChipOpacity: 1 } },
            { wait: 1000, ms: 2000, set: { carX: 2.5, part2Reach: 2 / 3 } },
          ],
        },
        {
          parallel: [
            { ms: 500, set: { part2LabelOpacity: 1 } },
            { wait: 150, ms: 500, set: { time2BraceOpacity: 1 } },
          ],
        },
      ],
    },
    {
      title: "Let's Use Area to Describe the Problem",
      summary: 'The average speed',
      play: {
        parallel: [
          { ms: 500, unset: ['carOpacity'] },
          { ms: 1000, set: { averageProgress: 1 } },
        ],
      },
    },
    {
      title: 'Solve the Problem',
      summary: 'The two areas must be equal',
      play: [
        { wait: 300, ms: 600, set: { areasOutlineOpacity: 1 } },
        { wait: 500, set: { bubbleKey: 'equal' } },
        {
          parallel: [
            { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
            { ms: 450, set: { equalArrowsOpacity: 1 } },
          ],
        },
      ],
      exit: [
        // the bubble, and the two arrows that point from it at the areas
        { ms: BUBBLE_OUT_MS, unset: ['bubbleOpacity', 'equalArrowsOpacity'] },
        { unset: ['bubbleKey'] },
      ],
    },
    {
      title: 'Solve the Problem',
      summary: 'The deficit is 10 miles',
      play: [
        { wait: 300, set: { bubbleKey: 'area' } },
        { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
        { wait: 1000 - BUBBLE_IN_MS, ms: 500, set: { areasLabelOpacity: 1 } },
      ],
      exit: [
        { ms: BUBBLE_OUT_MS, unset: ['bubbleOpacity'] },
        { unset: ['bubbleKey'] },
      ],
    },
    {
      title: 'Solve the Problem',
      summary: 'Part 2 takes 2 hours',
      play: [
        { wait: 300, set: { bubbleKey: 'time2' } },
        { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
        { wait: 1500 - BUBBLE_IN_MS, ms: 500, set: { time2Known: 1, endTimeChipOpacity: 1 } },
      ],
      exit: [
        { ms: BUBBLE_OUT_MS, unset: ['bubbleOpacity'] },
        { unset: ['bubbleKey'] },
      ],
    },
    {
      title: 'Solve the Problem',
      summary: 'The answer: 110 miles',
      play: [
        { wait: 300, set: { bubbleKey: 'answer' } },
        { ms: BUBBLE_IN_MS, set: { bubbleOpacity: 1 } },
        { wait: 1200 - BUBBLE_IN_MS, ms: 500, set: { distance2Known: 1 } },
      ],
    },
  ],
};

mountDemo(qiangsTripDemo);
