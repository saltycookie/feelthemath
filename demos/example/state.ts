/**
 * What the garden scene looks like at one moment. The steps (demo.tsx) animate these values.
 * Opacities run from 0 (hidden) to 1 (fully visible).
 */
export interface GardenState {
  /** The garden rectangle's outline and fill. */
  rectangleOpacity: number;
  /** How much of its length the rectangle has grown to: 0 is none, 1 is all of it. */
  growthProgress: number;
  /** The formula bubble at the garden's corner. */
  bubbleOpacity: number;
  /** The answer written inside the garden. */
  answerOpacity: number;
}

export const DEFAULT_GARDEN_STATE: GardenState = {
  rectangleOpacity: 0,
  growthProgress: 0,
  bubbleOpacity: 0,
  answerOpacity: 0,
};
