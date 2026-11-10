import React, { useEffect, useRef } from 'react';

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
  steps?: { title: string; summary?: string }[];
  homeHref?: string;
}

/**
 * Shared Bottom Navigation Panel Component (Requirements 1 & 3):
 * - Left: "← Back" button for returning to the previous step.
 * - Center: "Navigation dots", each indicating a step (`#step-1` .. `#step-N`).
 *   Active step renders as an elongated dark pill; users can click/tap any dot to jump directly.
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

  const handleNext = () => {
    if (isAnimating || isLastStep) return;
    onNext();
  };

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
          <span className="arrow">←</span> Back
        </button>
      </div>

      <div className="dots">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          const stepInfo = steps?.[idx];
          const label = stepInfo?.summary || stepInfo?.title || '';
          return (
            <button
              key={idx}
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
            Finish
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
            Next <span className="arrow">→</span>
          </button>
        )}
      </div>
    </nav>
  );
};
