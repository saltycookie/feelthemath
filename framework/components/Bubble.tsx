import React, { forwardRef } from 'react';
import { clamp, clamp01 } from '../math';

/**
 * Callout bubbles: small ink-outlined boxes that sit beside the thing they explain, with a tail pointing at it
 * (theme.css draws them).
 *
 * A renderer measures its bubble (useMeasure, offsetWidth/offsetHeight), works out where it goes with
 * `placeBubble`, and draws it with `<Bubble>`:
 *
 *   const size = useMeasure(ref, () => ({ w: ref.current!.offsetWidth, h: ref.current!.offsetHeight }), { w: 0, h: 0 }, [text]);
 *   const at = placeBubble([x, y, 'right'], size, bounds);
 *   <Bubble ref={ref} opacity={op} placement={at} maxWidth={...}>{text}</Bubble>
 */

/** Where the bubble sits relative to the point it explains; the tail is on the facing edge ('mid': centred on the point, no tail). */
export type BubbleSide = 'right' | 'left' | 'above' | 'below' | 'mid';

/** The point to explain and where the bubble sits relative to it. */
export type BubbleAnchor = [x: number, y: number, side: BubbleSide];

export interface BubbleBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BubblePlacement {
  left: number;
  top: number;
  tail: BubbleSide;
  /** how far along its edge the tail sits, in px */
  tp: number;
}

/**
 * Places a bubble of `size` beside `anchor`, kept inside `bounds` (`inset` in from its edges), `gap` away from the
 * point. The tail stays on the bubble's edge, as close to the point as it can.
 */
export function placeBubble(
  anchor: BubbleAnchor,
  size: { w: number; h: number },
  bounds: BubbleBounds,
  gap = 11,
  inset = 4
): BubblePlacement {
  const [ax, ay, side] = anchor;
  const { w, h } = size;
  const L = bounds.x + inset,
    R = bounds.x + bounds.w - inset,
    T = bounds.y + inset,
    B = bounds.y + bounds.h - inset;
  let left: number, top: number;
  if (side === 'right') {
    left = ax + gap;
    top = ay - h / 2;
  } else if (side === 'left') {
    left = ax - gap - w;
    top = ay - h / 2;
  } else if (side === 'below') {
    left = ax - w / 2;
    top = ay + gap;
  } else if (side === 'mid') {
    left = ax - w / 2;
    top = ay - h / 2;
  } else {
    left = ax - w / 2;
    top = ay - gap - h;
  }
  left = clamp(left, L, Math.max(L, R - w));
  top = clamp(top, T, Math.max(T, B - h));
  const tp =
    side === 'right' || side === 'left'
      ? clamp(ay - top, 16, h - 16) - 6
      : clamp(ax - left, 16, w - 16) - 6;
  return { left, top, tail: side, tp };
}

export interface BubbleProps {
  opacity: number;
  /** where to draw it; leave out while the bubble is hidden */
  placement?: BubblePlacement | null;
  maxWidth?: number;
  children?: React.ReactNode;
}

export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(function Bubble(
  { opacity, placement, maxWidth, children },
  ref
) {
  const style: React.CSSProperties & { '--tp'?: string } = {
    opacity: clamp01(opacity),
    maxWidth,
  };
  if (placement) {
    style.transform = `translate(${placement.left}px,${placement.top}px)`;
    style['--tp'] = placement.tp + 'px';
  }
  return (
    <div
      ref={ref}
      className="bubble"
      data-tail={placement?.tail}
      // A faded-out bubble stays on the page to be measured; keep it from being read out meanwhile.
      aria-hidden={opacity <= 0 || undefined}
      style={style}
    >
      {children}
    </div>
  );
});
