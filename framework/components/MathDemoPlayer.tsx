import React, { useEffect, useLayoutEffect } from 'react';
import { DemoConfig } from '../types';
import { useStepEngine } from '../useStepEngine';
import { DemoCanvas } from './DemoCanvas';
import { NavigationPanel } from './NavigationPanel';
import { watchBox } from '../box';

if (typeof window !== 'undefined') {
  watchBox();
}

export interface MathDemoPlayerProps {
  demo: DemoConfig;
  /** Where "All demos" and Finish go. Default: the page's stepdeck-home setting (below), else the front page. */
  homeHref?: string;
}

/**
 * A page can say where its home link goes with `<meta name="stepdeck-home" content="URL">`. A demo packed into one
 * file by tools/single_file.py has no front page beside it, so the tool sets this to the live site.
 */
function homeFromPage(): string {
  const meta = typeof document !== 'undefined'
    ? document.querySelector<HTMLMetaElement>('meta[name="stepdeck-home"]')
    : null;
  return meta?.content || '../../';
}

/**
 * Top-level Framework Component (`<MathDemoPlayer />`):
 * Provides the complete shared layout, step state machine, URL hash router (`#step-X`),
 * title area, visual element canvas, and bottom navigation panel across all math demos.
 */
export const MathDemoPlayer: React.FC<MathDemoPlayerProps> = ({
  demo,
  homeHref = homeFromPage(),
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
