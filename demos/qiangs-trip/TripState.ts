export type BubbleKey = 'none' | 'time1' | 'equal' | 'area' | 'time2' | 'answer';

/**
 * What the trip scene looks like at one moment. The steps (trip.tsx) animate these values; the reader changes the
 * point's. Unless it says otherwise, a number is an opacity from 0 (hidden) to 1 (shown).
 */
export interface TripState {
  /** What is on the paper: 0 the problem and the road, 1 the chart. In between, the first fades out and then the second fades in. */
  chartView: number;
  /** How far the road of step 2 is through its timeline, from 0 to 1. */
  roadProgress: number;
  /** Where the point is drawn, in hours. The point is the corner of the first part's rectangle. */
  pointX: number;
  /** Where the point is drawn, in mph. */
  pointY: number;
  /** Where the reader has put the point, in hours: on the half-hour grid. The drawn point glides to it. */
  pickedX: number;
  /** Where the reader has put the point, in mph: on the 5 mph grid. */
  pickedY: number;
  /** Whether the reader can move the point (step 3). */
  draggable: boolean;
  /** The point's radius in px. Its move icon fades in between 6 and 11. */
  handleRadius: number;
  /** The point's handle. */
  handleOpacity: number;
  /** The ring round the handle: shown once this is above 0.05. */
  handleRing: number;
  /** 1 while the pointer is on the handle or dragging it, which makes it a little bigger. */
  handleHover: number;
  /** The formula above the rectangle: distance = speed × time. */
  formulaOpacity: number;
  /** The numbers along the time axis. */
  timeTicksOpacity: number;
  /** The first part's rectangle. */
  part1Opacity: number;
  /** Its area in miles, written inside it. */
  part1LabelOpacity: number;
  /** The chip on the speed axis at the rectangle's height. */
  speedChipOpacity: number;
  /** The chip on the time axis at the rectangle's right edge. */
  timeChipOpacity: number;
  /** The car on the time axis. */
  carOpacity: number;
  /** Where the car is, in hours. */
  carX: number;
  /** The second part's rectangle, 55 mph tall. */
  part2Opacity: number;
  /** How far it reaches from 0.5 h towards the chart's right edge, from 0 to 1. 2/3 is 2.5 h. */
  part2Reach: number;
  /** Its area, written inside it: "? mi", or "110 mi" once `distance2Known` is 1. */
  part2LabelOpacity: number;
  /** The 55 chip on the speed axis. */
  speed2ChipOpacity: number;
  /** The brace over the second part with its time: "? h", or "2 h" once `time2Known` is 1. */
  time2BraceOpacity: number;
  /** The 50 mph average line, drawn from left to right. Its 50 chip and its label fade in along the way. */
  averageProgress: number;
  /** The pink outlines of the deficit (above the first part) and the surplus (above the second). */
  areasOutlineOpacity: number;
  /** The two arrows from the bubble to those areas (step 7). */
  equalArrowsOpacity: number;
  /** "10 mi" written in each of them. */
  areasLabelOpacity: number;
  /** 0 writes the second part's time as "? h", 1 as "2 h". */
  time2Known: number;
  /** The 2.5 chip on the time axis. */
  endTimeChipOpacity: number;
  /** 0 writes the second part's distance as "? mi", 1 as "110 mi". */
  distance2Known: number;
  /** What the bubble says (SAY). */
  bubbleKey: BubbleKey;
  /** The bubble. */
  bubbleOpacity: number;
}

/** The state before anything is drawn: step 1. */
export const DEFAULT_TRIP_STATE: TripState = {
  chartView: 0,
  roadProgress: 0,
  pointX: 1.5,
  pointY: 40,
  pickedX: 1.5,
  pickedY: 40,
  draggable: false,
  handleRadius: 11,
  handleOpacity: 0,
  handleRing: 0,
  handleHover: 0,
  formulaOpacity: 0,
  timeTicksOpacity: 0,
  part1Opacity: 0,
  part1LabelOpacity: 0,
  speedChipOpacity: 0,
  timeChipOpacity: 0,
  carOpacity: 0,
  carX: 0.5,
  part2Opacity: 0,
  part2Reach: 0,
  part2LabelOpacity: 0,
  speed2ChipOpacity: 0,
  time2BraceOpacity: 0,
  averageProgress: 0,
  areasOutlineOpacity: 0,
  equalArrowsOpacity: 0,
  areasLabelOpacity: 0,
  time2Known: 0,
  endTimeChipOpacity: 0,
  distance2Known: 0,
  bubbleKey: 'none',
  bubbleOpacity: 0,
};
