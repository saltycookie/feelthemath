// The example demo's scene: its state interface and the renderer component that draws it.
// The interactive steps and animations that manipulate this state are defined in demo.tsx.
//
// A renderer draws the visual scene as JSX derived from the element's current state.
// Any measurements required from the DOM (such as container dimensions or rendered bubble sizes)
// are measured via useMeasure, ensuring accurate responsive layouts before painting.

import { useRef } from 'react';
import {
  Bubble,
  ElementRendererComponent,
  clamp,
  placeBubble,
  useMeasure,
} from '../../framework';

/**
 * State representing visual properties of the garden scene at any point in time.
 * Step controllers animate these values between keyframes.
 */
export interface GardenState {
  /** Opacity of the garden rectangle outline and background (0 = hidden, 1 = fully visible). */
  rectangleOpacity: number;
  /** Horizontal growth progress of the garden rectangle (0 = width 0, 1 = full width 3 m). */
  growthProgress: number;
  /** Opacity of the formula callout bubble (0 = hidden, 1 = fully visible). */
  bubbleOpacity: number;
  /** Opacity of the final answer text inside the garden (0 = hidden, 1 = fully visible). */
  answerOpacity: number;
}

export const GardenRenderer: ElementRendererComponent<GardenState> = ({ element }) => {
  const { rectangleOpacity, growthProgress, bubbleOpacity, answerOpacity } = element.state;

  // DOM references used to measure responsive dimensions
  const drawingContainerRef = useRef<HTMLDivElement | null>(null);
  const bubbleElementRef = useRef<HTMLDivElement | null>(null);

  // 1. Measure the container dimensions available for drawing below the problem description.
  const containerSize = useMeasure(
    drawingContainerRef,
    () => {
      const boundingBox = drawingContainerRef.current!.getBoundingClientRect();
      return { width: boundingBox.width, height: boundingBox.height };
    },
    { width: 0, height: 0 }
  );
  const containerWidth = containerSize.width;
  const containerHeight = containerSize.height;

  // 2. Measure the formula bubble at its allowed maximum width (up to 360px with padding).
  const bubbleMaxWidth = containerWidth ? Math.min(360, containerWidth - 24) : 360;
  const bubbleSize = useMeasure(
    bubbleElementRef,
    () => ({
      width: bubbleElementRef.current!.offsetWidth,
      height: bubbleElementRef.current!.offsetHeight,
    }),
    { width: 0, height: 0 },
    [bubbleMaxWidth]
  );

  // 3. Coordinate calculations:
  // The garden is 3 m wide by 2 m tall. Determine pixels per meter (grid unit)
  // such that a 5-unit wide by 4-unit high bounding box fits inside the container with margins.
  const pixelsPerMeter =
    containerWidth > 0 && containerHeight > 0
      ? Math.min(containerWidth / 5, containerHeight / 4)
      : 0;

  const gardenWidth = 3 * pixelsPerMeter;
  const gardenHeight = 2 * pixelsPerMeter;

  // Center the 3 m × 2 m garden rectangle horizontally and vertically within the container
  const gardenOriginX = (containerWidth - gardenWidth) / 2;
  const gardenOriginY = (containerHeight - gardenHeight) / 2;

  // Anchor the formula callout bubble to the right of the garden's top-right corner
  const bubblePlacement = placeBubble(
    [gardenOriginX + gardenWidth, gardenOriginY, 'right'],
    { w: bubbleSize.width || 96, h: bubbleSize.height || 38 },
    { x: 0, y: 0, w: containerWidth, h: containerHeight }
  );

  return (
    <>
      <p className="problem">
        A garden is <b className="c-blue">3 m</b> long and{' '}
        <b className="c-blue">2 m</b> wide. What is its area?
      </p>
      <div className="box" ref={drawingContainerRef}>
        <svg id="pic" viewBox={containerWidth && containerHeight ? `0 0 ${containerWidth} ${containerHeight}` : undefined}>
          {pixelsPerMeter > 0 && (
            <>
              {/* Garden boundary rectangle, growing horizontally from 0 to full width */}
              <rect
                className="area"
                x={gardenOriginX}
                y={gardenOriginY}
                width={Math.max(0, gardenWidth * growthProgress)}
                height={Math.max(0, gardenHeight)}
                opacity={clamp(rectangleOpacity, 0, 1)}
              />
              {/* Final area calculation label centered within the garden */}
              <text
                className="big c-ink"
                x={gardenOriginX + gardenWidth / 2}
                y={gardenOriginY + gardenHeight / 2 + 10}
                opacity={clamp(answerOpacity, 0, 1)}
              >
                6 m²
              </text>
            </>
          )}
        </svg>
        {/* Floating formula callout bubble */}
        <Bubble
          ref={bubbleElementRef}
          opacity={bubbleOpacity}
          placement={bubblePlacement}
          maxWidth={bubbleMaxWidth}
        >
          <b className="c-blue">3</b>
          <u>m</u> × <b className="c-blue">2</b>
          <u>m</u>
        </Bubble>
      </div>
    </>
  );
};
