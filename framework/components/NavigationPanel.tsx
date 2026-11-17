import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface NavigationPanelProps {
  currentStepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  canReplay: boolean;
  hasPlayAnimation: boolean;
  isAnimating: boolean;
  onBack: () => void;
  onNext: () => void;
  onReplay: () => void;
  onSelectStep: (stepIndex: number) => void;
  steps?: { title?: string; summary?: string }[];
  homeHref?: string;
}

/**
 * Shared Bottom Navigation Panel Component (Requirements 1 & 3):
 * - Left: "← Back" button for returning to the previous step (reduces to icon on narrow screens).
 * - Center: "Navigation dots", each indicating a step (`#step-1` .. `#step-N`).
 *   Active step renders as an elongated dark pill; users can click/tap any dot to jump directly,
 *   and swipe/scroll when there are more steps than fit.
 * - Right group:
 *   - "↺ Replay" button on the left-hand side of "Next" for replaying the current step's `play` animation.
 *     Grayed out when there is no `play` animation for the step, or while `play` is currently running.
 *   - "Next →" button on the far right (or "Finish" on the final step). Disabled while `play` or `exit` is ongoing.
 */
export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  currentStepIndex,
  totalSteps,
  canGoBack,
  canGoNext,
  canReplay,
  isAnimating,
  onBack,
  onNext,
  onReplay,
  onSelectStep,
  steps,
  homeHref = '../../',
}) => {
  const nextBtnRef = useRef<HTMLElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const activeDotRef = useRef<HTMLButtonElement | null>(null);
  const didMountRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    dragged: boolean;
  } | null>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const isLastStep = currentStepIndex >= totalSteps - 1;

  useEffect(() => {
    // Keep keyboard focus from getting lost when a button becomes disabled
    const active = document.activeElement as HTMLButtonElement | null;
    if (
      active &&
      active.disabled &&
      nextBtnRef.current &&
      !(nextBtnRef.current as HTMLButtonElement).disabled
    ) {
      nextBtnRef.current.focus();
    }
  }, [canGoBack, canReplay, canGoNext, isAnimating]);

  const syncScrollEdges = useCallback(() => {
    const container = dotsRef.current;
    if (!container) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const left = maxScroll > 1 && container.scrollLeft > 1;
    const right = maxScroll > 1 && container.scrollLeft < maxScroll - 1;
    setScrollEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, []);

  const centerActiveDot = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const container = dotsRef.current;
      const active = activeDotRef.current;
      if (!container || !active) return;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll <= 1) {
        if (container.scrollLeft !== 0) container.scrollLeft = 0;
        syncScrollEdges();
        return;
      }
      const cr = container.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      const activeCenter = container.scrollLeft + (ar.left - cr.left) + ar.width / 2;
      const target = Math.max(0, Math.min(maxScroll, activeCenter - container.clientWidth / 2));
      if (Math.abs(container.scrollLeft - target) > 0.5) {
        container.scrollTo({ left: target, behavior });
      }
      syncScrollEdges();
    },
    [syncScrollEdges]
  );

  // Keep the current step centered in the dots strip whenever step or step count changes
  useLayoutEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior =
      didMountRef.current && !reducedMotion ? 'smooth' : 'auto';
    didMountRef.current = true;
    centerActiveDot(behavior);
  }, [currentStepIndex, totalSteps, centerActiveDot]);

  // Re-center immediately when the dots container resizes
  useEffect(() => {
    const container = dotsRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      centerActiveDot('auto');
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [centerActiveDot]);

  const handleDotsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const container = dotsRef.current;
    if (!container || container.scrollWidth <= container.clientWidth + 1) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: container.scrollLeft,
      dragged: false,
    };
  };

  const handleDotsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = dotsRef.current;
    if (!drag || !container || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.dragged && Math.abs(dx) > 4) {
      drag.dragged = true;
      suppressClickRef.current = true;
      container.setAttribute('data-dragging', 'true');
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
    }
    if (drag.dragged) {
      container.scrollLeft = drag.startScrollLeft - dx;
    }
  };

  const endDotsDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = dotsRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (container) {
      container.removeAttribute('data-dragging');
      if (drag.dragged) {
        try {
          if (container.hasPointerCapture(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore if pointer capture was already released
        }
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }
  };

  const handleDotsClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  const handleNext = () => {
    if (isAnimating || isLastStep) return;
    onNext();
  };

  const dotsClass = `dots${scrollEdges.left ? ' fade-l' : ''}${scrollEdges.right ? ' fade-r' : ''}`;

  return (
    <nav className="nav" aria-label="Steps">
      <div className="nav-l">
        <button
          className="btn"
          type="button"
          data-act="back"
          aria-label="Previous step"
          disabled={!canGoBack}
          onClick={onBack}
        >
          <span className="ic" aria-hidden="true">
            ←
          </span>
          <span className="lbl">Back</span>
        </button>
      </div>

      <div
        ref={dotsRef}
        className={dotsClass}
        onScroll={syncScrollEdges}
        onPointerDown={handleDotsPointerDown}
        onPointerMove={handleDotsPointerMove}
        onPointerUp={endDotsDrag}
        onPointerCancel={endDotsDrag}
        onClickCapture={handleDotsClickCapture}
      >
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          const stepInfo = steps?.[idx];
          const label = stepInfo?.summary || stepInfo?.title || '';
          return (
            <button
              key={idx}
              ref={isActive ? activeDotRef : undefined}
              type="button"
              className={`dot${isDone ? ' done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}${label ? `: ${label}` : ''}`}
              onClick={() => onSelectStep(idx)}
            >
              <i />
            </button>
          );
        })}
      </div>

      <div className="nav-r">
        <button
          className="btn ghost"
          type="button"
          data-act="replay"
          aria-label="Replay this step"
          disabled={!canReplay}
          onClick={onReplay}
        >
          <span className="ic" aria-hidden="true">
            ↺
          </span>
          <span className="lbl">Replay</span>
        </button>

        {isLastStep ? (
          <a
            ref={nextBtnRef as React.RefObject<HTMLAnchorElement>}
            className="btn"
            href={homeHref}
            data-act="next"
            aria-label="Finish and go back to all demos"
          >
            <span className="ic finish-ic" aria-hidden="true">
              ✓
            </span>
            <span className="lbl">Finish</span>
          </a>
        ) : (
          <button
            ref={nextBtnRef as React.RefObject<HTMLButtonElement>}
            className="btn"
            type="button"
            data-act="next"
            aria-label="Next step"
            disabled={!canGoNext}
            onClick={handleNext}
          >
            <span className="lbl">Next</span>
            <span className="ic" aria-hidden="true">
              →
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
