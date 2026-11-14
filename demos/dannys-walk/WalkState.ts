/**
 * What the walk scene looks like at one moment. The steps (walk.tsx) animate these values; the reader changes
 * `unfold` with the switch. Unless it says otherwise, a number runs from 0 (hidden, or not begun) to 1 (shown, or
 * done).
 */
export interface WalkState {
  /** The river, drawn from west to east. */
  riverProgress: number;
  /** Home, A: its point and its name. */
  homeShown: number;
  /** The 20 m line from home to the river, drawn from home, then its length. */
  homeMeasure: number;
  /** The playground, B: its point and its name. */
  playgroundShown: number;
  /** The 30 m line from the playground to the river, then its length. */
  playgroundMeasure: number;
  /** The 120 m measure under the river, drawn eastwards from home's side, then its length. */
  eastMeasure: number;
  /** The point C on the river bank. */
  cShown: number;
  /** The walk from B to C and on to A, drawn from 0 to 1. */
  walk1: number;
  /** The question under the figure: how short can BC + CA be? */
  questionShown: number;
  /** The problem's text above the figure. */
  problemShown: number;
  /** The camera: 0 looks straight at the paper, 1 from a little to the side, to show the fold. */
  sideView: number;
  /** The sheet of paper the figure is on. */
  paperShown: number;
  /** The paper: 0 folded along the river, 1 unfolded flat. */
  unfold: number;
  /** The fold / unfold switch. */
  switchShown: number;
  /** The hint under the paper in step 3: fold and unfold Danny's world yourself. */
  hintFoldIt: number;
  /** Which way the switch points: true is "unfold". */
  switchOpen: boolean;
  /** Whether the reader can use the switch. */
  controlsOn: boolean;
  /** 0 writes the point as "C", 1 as "C₁". */
  cAsC1: number;
  /** The point C₂. */
  c2Shown: number;
  /** The point C₃, where the straight walk crosses the river. */
  c3Shown: number;
  /** The point C₄. */
  c4Shown: number;
  /** The walk through C₂, drawn from 0 to 1. */
  walk2: number;
  /** The walk through C₃. */
  walk3: number;
  /** The walk through C₄. */
  walk4: number;
  /** Slides the 120 m label along its measure, to where none of the four walks crosses it once unfolded. */
  measureLabelAside: number;
  /** The hint in step 4: which path is the shortest? Unfold to find out. */
  hintUnfoldToCompare: number;
  /** Fades out every point on the bank and every walk except C₃'s. */
  onlyC3: number;
  /** The hint in step 5: the walk through C₃ is the shortest because it is a straight line. */
  hintStraightLine: number;
  /** With the camera straight on: 0 frames the figure as in step 2, 1 the whole unfolded paper. */
  framingUnfolded: number;
  /** 1 moves the unfolded paper up, to leave room for the working under it (step 6). */
  framingRaised: number;
  /** The legs of the right triangle ABD, drawn from A and from B towards D. */
  triangleLegs: number;
  /** The point D and the right-angle mark at it. */
  dShown: number;
  /** Swaps the lengths: the 120 m measure under the river goes, and "50 m" and "120 m" appear on the legs. */
  legLengthsShown: number;
  /** The working under the paper, the first of its five pieces. */
  working1: number;
  /** Its second piece. */
  working2: number;
  /** Its third piece. */
  working3: number;
  /** Its fourth piece. */
  working4: number;
  /** Its last piece: the answer. */
  working5: number;
  /** The hand-drawn ring round the answer, drawing itself from 0 to 1. */
  answerRing: number;
}

/** The initial state of step 1 (only the problem text is shown). */
export const DEFAULT_WALK_STATE: WalkState = {
  riverProgress: 0,
  homeShown: 0,
  homeMeasure: 0,
  playgroundShown: 0,
  playgroundMeasure: 0,
  eastMeasure: 0,
  cShown: 0,
  walk1: 0,
  questionShown: 0,
  problemShown: 1,
  sideView: 0,
  paperShown: 0,
  unfold: 0,
  switchShown: 0,
  hintFoldIt: 0,
  switchOpen: false,
  controlsOn: false,
  cAsC1: 0,
  c2Shown: 0,
  c3Shown: 0,
  c4Shown: 0,
  walk2: 0,
  walk3: 0,
  walk4: 0,
  measureLabelAside: 0,
  hintUnfoldToCompare: 0,
  onlyC3: 0,
  hintStraightLine: 0,
  framingUnfolded: 0,
  framingRaised: 0,
  triangleLegs: 0,
  dShown: 0,
  legLengthsShown: 0,
  working1: 0,
  working2: 0,
  working3: 0,
  working4: 0,
  working5: 0,
  answerRing: 0,
};
