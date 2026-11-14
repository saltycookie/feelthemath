/**
 * The figure's state. The steps (sticks.tsx) animate these values. Every value runs from 0
 * (not shown, or not begun) to 1 (shown, or done), except `pulseCount` which triggers a pulse when incremented.
 */
export interface SticksState {
  /** The printed figure's letters A, B, C, D and O. The sticks' own letters show as this goes to 0. */
  printedLetters: number;
  /** The printed figure's equal-length ticks and its right-angle mark. */
  printedMarks: number;
  /** The four sides: 0 pencil lines, 1 thin sticks. */
  sideWood: number;
  /** The sides lifted off the figure, one after another, onto the pile in the corner. */
  sidesToPile: number;
  /** AC and BD: 0 pencil lines, 1 wooden sticks. */
  mainWood: number;
  /** BD taken from the figure to the pile. */
  bdToPile: number;
  /** BD taken from the pile and laid under AC. */
  bdFromPile: number;
  /** The pointer that runs along AC and picks the point O. */
  pickO: number;
  /** The brackets that mark the whole of AC, and then of BD, as x. */
  xBrackets: number;
  /** y, written beside AO. */
  acYLabel: number;
  /** x − y, written beside OC. */
  acXMinusYLabel: number;
  /** BD's names, its mark at O, and its x, y and x − y, one after another. */
  bdLabels: number;
  /** BD turned across AC at O: 0 lying under it, 1 at a right angle to it. */
  crossed: number;
  /** The right-angle marks at O. */
  rightAngle: number;
  /** AB taken from the pile and laid on the figure. */
  abFromPile: number;
  /** Its length, √2 · y. */
  abLabel: number;
  /** CD taken from the pile and laid on the figure. */
  cdFromPile: number;
  /** Its length, √2 · (x − y). */
  cdLabel: number;
  /** AB, then CD, laid end to end on the ruler. */
  onRuler: number;
  /** The "+", the "= 10" and the reading line that make the equation on the ruler. */
  equation: number;
  /** The grid, the ruler and the sticks faded out, to leave the paper to the working. */
  figureGone: number;
  /** The equation's terms flown up into the first row of the working. */
  termsToWorking: number;
  /** The prompt above the ruler: how would you build this shape using sticks? */
  prompt: number;
  /** The question at the top of the mat. */
  problem: number;
  /** The working of step 7: rows 2 to 6 shown, and the terms that cancel in row 2 struck out. */
  row2: number;
  strike: number;
  row3: number;
  row4: number;
  row5: number;
  row6: number;
  /** Incremented on step 1 to pulse the figure's marks. */
  pulseCount: number;
}

export const DEFAULT_STICKS_STATE: SticksState = {
  printedLetters: 1,
  printedMarks: 1,
  sideWood: 0,
  sidesToPile: 0,
  mainWood: 0,
  bdToPile: 0,
  bdFromPile: 0,
  pickO: 0,
  xBrackets: 0,
  acYLabel: 0,
  acXMinusYLabel: 0,
  bdLabels: 0,
  crossed: 1,
  rightAngle: 0,
  abFromPile: 0,
  abLabel: 0,
  cdFromPile: 0,
  cdLabel: 0,
  onRuler: 0,
  equation: 0,
  figureGone: 0,
  termsToWorking: 0,
  prompt: 0,
  problem: 1,
  row2: 0,
  strike: 0,
  row3: 0,
  row4: 0,
  row5: 0,
  row6: 0,
  pulseCount: 0,
};
