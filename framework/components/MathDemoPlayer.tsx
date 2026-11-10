import React, { useEffect, useLayoutEffect } from 'react';
import { DemoConfig } from '../types';
import { useStepEngine } from '../useStepEngine';
import { DemoCanvas } from './DemoCanvas';
import { NavigationPanel } from './NavigationPanel';
import { watchBox } from '../box.js';

if (typeof window !== 'undefined') {
  watchBox();
}

export interface MathDemoPlayerProps {
  demo: DemoConfig;
  homeHref?: string;
}

/**
 * Top-level Framework Component (`<MathDemoPlayer />`):
 * Provides the complete shared layout, step state machine, URL hash router (`#step-X`),
 * title area, visual element canvas, and bottom navigation panel across all math demos.
 */
export const MathDemoPlayer: React.FC<MathDemoPlayerProps> = ({
  demo,
  homeHref = '../../',
}) => {
  const {
    currentStepIndex,
    currentStep,
    totalSteps,
    elements,
    isAnimating,
    hasPlayAnimation,
    canGoBack,
    canGoNext,
    canReplay,
    goNext,
    goBack,
    goToStep,
    replayCurrentStep,
    updateInteractiveElementState,
  } = useStepEngine(demo);

  // Synchronize <html data-step="N" data-step-busy> attributes synchronously before paint
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.step = String(currentStepIndex + 1);
    root.toggleAttribute('data-step-busy', isAnimating);
  }, [currentStepIndex, isAnimating]);

  // Support Left / Right arrow and PageUp / PageDown keyboard step navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (!isAnimating && currentStepIndex < totalSteps - 1) {
          e.preventDefault();
          goNext();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (canGoBack) {
          e.preventDefault();
          goBack();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnimating, currentStepIndex, totalSteps, canGoBack, goNext, goBack]);

  return (
    <>
      <DemoCanvas
        title={currentStep?.title ?? demo.name}
        elements={elements}
        renderers={demo.renderers}
        isAnimating={isAnimating}
        homeHref={homeHref}
        onUpdateElementState={updateInteractiveElementState}
      />

      <NavigationPanel
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        canReplay={canReplay}
        hasPlayAnimation={hasPlayAnimation}
        isAnimating={isAnimating}
        onBack={goBack}
        onNext={goNext}
        onReplay={replayCurrentStep}
        onSelectStep={(idx) => goToStep(idx, 'dot')}
        steps={demo.steps}
        homeHref={homeHref}
      />
    </>
  );
};
