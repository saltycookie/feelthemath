import { useCallback, useEffect, useRef } from 'react';
import { easeOut } from './math';

/**
 * For a renderer that moves a value itself in answer to the reader (a dragged point gliding to the grid, a switch
 * folding the paper), outside the steps' animations. Returns `tween(durationMs, onFrame, ease)`, which calls
 * `onFrame` with the eased progress, from 0 up to exactly 1, once a frame for `durationMs`:
 *
 *   const tween = useTween();
 *   tween(140, (t) => updateState({ x: lerp(fromX, toX, t) }));
 *
 * Starting a tween stops the one before it, and leaving the page stops it.
 */
export function useTween(): (durationMs: number, onFrame: (t: number) => void, ease?: (t: number) => number) => void {
  const frame = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);
  return useCallback((durationMs, onFrame, ease = easeOut) => {
    window.cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / durationMs);
      onFrame(u >= 1 ? 1 : ease(u));
      if (u < 1) frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
  }, []);
}
