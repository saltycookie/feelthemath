import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DemoConfig,
  ElementsMap,
  StateInterpolator,
  StepAnimationController,
  StepExitContext,
  VisualElement,
  VisualElementPatch,
} from './types';
import { createCanonicalElementsMap, runDefaultExitAnimation } from './exitAnimation';
import { parseStepHash, useHashStepRouter } from './useHashStepRouter';
import { waitForBoxArrival } from './box';

export type StepLifecyclePhase = 'idle' | 'playing' | 'exiting';

function createAbortError(): Error {
  const err = new Error('Animation aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Standard easing functions used for frame-by-frame state interpolation.
 */
function applyEasing(t: number, easingName?: string): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (easingName === 'linear') {
    return clamped;
  }
  if (easingName === 'ease-in') {
    return clamped * clamped * clamped;
  }
  if (easingName === 'ease-in-out') {
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }
  // Default cubic-out (matches cubic-bezier(0.22, 1, 0.36, 1) closely)
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Default fallback state interpolator when an element type does not register a custom
 * `interpolateState` function:
 * - Linearly interpolates any numeric properties in `targetPatch` from `startState[key]` to `targetPatch[key]`.
 * - Immediately applies non-numeric properties (booleans, strings, objects).
 */
export const defaultStateInterpolator: StateInterpolator<Record<string, any>> = (
  startState,
  targetPatch,
  progress
) => {
  const nextState: Record<string, any> = { ...startState };
  for (const [key, targetVal] of Object.entries(targetPatch)) {
    const startVal = startState[key];
    if (
      typeof targetVal === 'number' &&
      typeof startVal === 'number' &&
      Number.isFinite(targetVal) &&
      Number.isFinite(startVal)
    ) {
      nextState[key] =
        progress >= 1 ? targetVal : startVal + (targetVal - startVal) * progress;
    } else {
      nextState[key] = targetVal;
    }
  }
  return nextState;
};

/**
 * Core state-machine hook for the step-by-step math demo framework.
 *
 * Enforces all 5 architectural invariants + Option A custom state interpolators:
 * 1. Bottom Navigation Panel state (Back, Replay, Next, Dots, #step-X URL sync).
 * 2. Canvas visual elements & title synchronization.
 * 3. Initial visual elements rendered immediately on step entry, followed by `play` animation
 *    (disabling Next while `play` is running, disabling Replay when step has no `play`).
 * 4. `exit` animation when clicking Next (default 250ms dim-out for removed elements and
 *    intact preservation for shared same-position elements, or custom step `exit` function).
 * 5. Deterministic beginning state for every step regardless of whether entered via URL/#step-X,
 *    navigation dots, Back button, or Next button.
 * 6. Per-element-type custom `interpolateState(startState, targetPatch, progress)` called via
 *    `requestAnimationFrame` during `animateElement` / `animateElements`.
 */
export function useStepEngine(demo: DemoConfig) {
  const steps = demo.steps;
  const totalSteps = steps.length;

  const abortControllerRef = useRef<AbortController | null>(null);
  const elementsRef = useRef<ElementsMap>({});

  const initialIdx =
    typeof window !== 'undefined'
      ? parseStepHash(window.location.hash, totalSteps) ?? 0
      : 0;

  const [elements, setElementsState] = useState<ElementsMap>(() => {
    const map = createCanonicalElementsMap(steps[initialIdx]?.initialElements ?? []);
    elementsRef.current = map;
    return map;
  });

  const [phase, setPhase] = useState<StepLifecyclePhase>(() =>
    steps[initialIdx]?.play ? 'playing' : 'idle'
  );

  const updateElements = useCallback(
    (updater: ElementsMap | ((prev: ElementsMap) => ElementsMap)) => {
      const next =
        typeof updater === 'function' ? updater(elementsRef.current) : updater;
      elementsRef.current = next;
      setElementsState(next);
    },
    []
  );

  const cancelActiveAnimation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Resolves the state interpolator for a given element `type`:
   * 1. `demo.stateInterpolators[type]` if provided
   * 2. `demo.renderers[type].interpolateState` if attached to the renderer component
   * 3. `defaultStateInterpolator` fallback
   */
  const getInterpolatorForType = useCallback(
    (type: string): StateInterpolator<any> => {
      return (
        demo.stateInterpolators?.[type] ??
        demo.renderers[type]?.interpolateState ??
        defaultStateInterpolator
      );
    },
    [demo.stateInterpolators, demo.renderers]
  );

  /**
   * Builds a StepAnimationController bound to a specific AbortSignal.
   */
  const createController = useCallback(
    (signal: AbortSignal): StepAnimationController => {
      const wait = (ms: number): Promise<void> =>
        new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(createAbortError());
            return;
          }
          if (ms <= 0) {
            resolve();
            return;
          }
          const timer = window.setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
          }, ms);
          const onAbort = () => {
            window.clearTimeout(timer);
            reject(createAbortError());
          };
          signal.addEventListener('abort', onAbort, { once: true });
        });

      const getElements = () => elementsRef.current;

      const updateElementImmediate = <TState = Record<string, any>>(
        id: string,
        patch: VisualElementPatch<TState>
      ) => {
        if (signal.aborted) return;
        updateElements((prev) => {
          const existing = prev[id];
          if (!existing) return prev;
          const interpolator = getInterpolatorForType(existing.type);
          return {
            ...prev,
            [id]: {
              ...existing,
              x: patch.x !== undefined ? patch.x : existing.x,
              y: patch.y !== undefined ? patch.y : existing.y,
              opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
              scale: patch.scale !== undefined ? patch.scale : existing.scale,
              transitionDurationMs: 0,
              state: patch.state
                ? interpolator(existing.state, patch.state, 1)
                : existing.state,
            },
          };
        });
      };

      const animateElements = async (
        patches: Record<string, VisualElementPatch<any>>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        const durationMs = options?.durationMs ?? 450;
        const easing = options?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';

        // Snapshot starting states for elements whose `state` is being animated
        const startStates: Record<string, any> = {};
        let hasStatePatches = false;

        for (const [id, patch] of Object.entries(patches)) {
          const existing = elementsRef.current[id];
          if (existing && patch.state) {
            startStates[id] = structuredClone(existing.state);
            hasStatePatches = true;
          }
        }

        // 1. Immediately apply outer CSS-transitioned properties (x, y, opacity, scale)
        //    and initial frame (progress = 0) of any state patches
        updateElements((prev) => {
          const next = { ...prev };
          for (const [id, patch] of Object.entries(patches)) {
            const existing = next[id];
            if (!existing) continue;
            const interpolator = getInterpolatorForType(existing.type);
            next[id] = {
              ...existing,
              x: patch.x !== undefined ? patch.x : existing.x,
              y: patch.y !== undefined ? patch.y : existing.y,
              opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
              scale: patch.scale !== undefined ? patch.scale : existing.scale,
              transitionDurationMs: durationMs,
              transitionEasing: easing,
              state:
                patch.state && startStates[id]
                  ? interpolator(
                      startStates[id],
                      patch.state,
                      durationMs <= 0 ? 1 : 0
                    )
                  : existing.state,
            };
          }
          return next;
        });

        if (durationMs <= 0) {
          return;
        }

        // 2. If no `state` patches were provided, CSS transitions handle x/y/opacity/scale
        if (!hasStatePatches) {
          await wait(durationMs);
          return;
        }

        // 3. Otherwise, run a requestAnimationFrame loop over `durationMs` calling each
        //    element type's `interpolateState(startState, targetPatch, easedProgress)`
        await new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
            reject(createAbortError());
            return;
          }

          let rafId = 0;
          const startTime = performance.now();

          const onAbort = () => {
            window.cancelAnimationFrame(rafId);
            reject(createAbortError());
          };

          signal.addEventListener('abort', onAbort, { once: true });

          const tick = (now: number) => {
            if (signal.aborted) return;
            const elapsed = now - startTime;
            const rawProgress = Math.min(1, elapsed / durationMs);
            const easedProgress =
              rawProgress >= 1 ? 1 : applyEasing(rawProgress, easing);

            updateElements((prev) => {
              const next = { ...prev };
              for (const [id, patch] of Object.entries(patches)) {
                const existing = next[id];
                if (!existing || !patch.state || !startStates[id]) continue;
                const interpolator = getInterpolatorForType(existing.type);
                const interpolated = interpolator(
                  startStates[id],
                  patch.state,
                  easedProgress
                );
                const mergedState: Record<string, any> = { ...existing.state };
                for (const key of Object.keys(interpolated)) {
                  if (key in patch.state || interpolated[key] !== startStates[id][key]) {
                    mergedState[key] = interpolated[key];
                  }
                }
                next[id] = {
                  ...existing,
                  state: mergedState,
                };
              }
              return next;
            });

            if (rawProgress < 1) {
              rafId = window.requestAnimationFrame(tick);
            } else {
              signal.removeEventListener('abort', onAbort);
              resolve();
            }
          };

          rafId = window.requestAnimationFrame(tick);
        });
      };

      const animateElement = async <TState = Record<string, any>>(
        id: string,
        patch: VisualElementPatch<TState>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        await animateElements({ [id]: patch }, options);
      };

      const addElement = async <TState = Record<string, any>>(
        element: VisualElement<TState>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        const durationMs = options?.durationMs ?? 400;
        const easing = options?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
        const targetOpacity = element.opacity ?? 1;

        if (durationMs <= 0) {
          updateElements((prev) => ({
            ...prev,
            [element.id]: {
              ...element,
              opacity: targetOpacity,
              scale: element.scale ?? 1,
              transitionDurationMs: 0,
              state: structuredClone(element.state),
            },
          }));
          return;
        }

        // Mount with opacity 0 first, then transition to targetOpacity on next frame
        updateElements((prev) => ({
          ...prev,
          [element.id]: {
            ...element,
            opacity: 0,
            scale: element.scale ?? 1,
            transitionDurationMs: 0,
            state: structuredClone(element.state),
          },
        }));

        await wait(25);
        await animateElement(
          element.id,
          { opacity: targetOpacity },
          { durationMs, easing }
        );
      };

      const removeElement = async (id: string, durationMs = 250): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        if (durationMs > 0 && elementsRef.current[id]) {
          await animateElement(id, { opacity: 0 }, { durationMs, easing: 'ease-out' });
        }
        if (signal.aborted) throw createAbortError();
        updateElements((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      };

      return {
        signal,
        wait,
        getElements,
        addElement,
        animateElement,
        animateElements,
        updateElementImmediate,
        removeElement,
      };
    },
    [updateElements, getInterpolatorForType]
  );

  /**
   * Enters `targetStepIndex` by setting its deterministic canonical `initialElements`
   * and immediately kicking off its `play` animation (if defined).
   */
  const enterStep = useCallback(
    async (targetStepIndex: number) => {
      cancelActiveAnimation();
      const step = steps[targetStepIndex];
      if (!step) return;

      // Requirement 5: Always set exact canonical beginning state for the step
      const canonicalStart = createCanonicalElementsMap(step.initialElements);
      updateElements(canonicalStart);

      if (!step.play) {
        setPhase('idle');
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setPhase('playing');

      try {
        const controller = createController(abortController.signal);
        const arrival = waitForBoxArrival();
        if (arrival) {
          await arrival;
          await controller.wait(250);
        } else {
          // Small frame delay so initialElements paint cleanly before play animation starts
          await controller.wait(40);
        }
        await step.play(controller);
        if (!abortController.signal.aborted) {
          setPhase('idle');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(`Error in step ${targetStepIndex + 1} play():`, err);
        }
        // If no newer animation has replaced this abortController, ensure phase returns to idle
        if (abortControllerRef.current === abortController) {
          setPhase('idle');
        }
      }
    },
    [steps, cancelActiveAnimation, updateElements, createController]
  );

  const handleExternalHashJump = useCallback(
    (targetStepIndex: number) => {
      enterStep(targetStepIndex);
    },
    [enterStep]
  );

  const { stepIndex, setStepIndexAndHash } = useHashStepRouter(
    totalSteps,
    handleExternalHashJump
  );

  // Keep a ref of the initial stepIndex so the mount effect only runs on mount/unmount,
  // NOT on every stepIndex change.
  const initialStepIndexRef = useRef(stepIndex);
  useEffect(() => {
    enterStep(initialStepIndexRef.current);
    return () => {
      cancelActiveAnimation();
    };
  }, [enterStep, cancelActiveAnimation]);

  /**
   * Direct navigation via navigation dots or Back button.
   * Immediately enters the target step with its canonical initial state.
   */
  const goToStep = useCallback(
    (targetIndex: number, source: 'dot' | 'back' | 'direct' = 'direct') => {
      if (targetIndex < 0 || targetIndex >= totalSteps) return;
      if (targetIndex === stepIndex && source === 'dot') return;
      setStepIndexAndHash(targetIndex);
      enterStep(targetIndex);
    },
    [totalSteps, stepIndex, setStepIndexAndHash, enterStep]
  );

  /**
   * Replay button handler:
   * Resets current step to its canonical `initialElements` and replays `step.play()`.
   */
  const replayCurrentStep = useCallback(() => {
    const currentStep = steps[stepIndex];
    if (!currentStep?.play || phase !== 'idle') return;
    enterStep(stepIndex);
  }, [steps, stepIndex, phase, enterStep]);

  /**
   * Next button handler (Requirements 3, 4, 5):
   * - Disabled when `phase !== 'idle'` (i.e., while `play` or `exit` is ongoing).
   * - Runs current step's custom `exit` function (or `runDefaultExitAnimation` if none registered)
   *   to smoothly transition from current step's post-play state into next step's beginning state.
   * - Then commits next step's canonical `initialElements`, updates URL to `#step-(X+1)`,
   *   and runs next step's `play` animation.
   */
  const goNext = useCallback(async () => {
    if (phase !== 'idle' || stepIndex >= totalSteps - 1) return;

    const currentStep = steps[stepIndex];
    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];

    cancelActiveAnimation();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setPhase('exiting');

    const nextInitialMap = createCanonicalElementsMap(nextStep.initialElements);
    const controller = createController(abortController.signal);

    try {
      const runDefaultExit = (options?: { excludeIds?: string[]; durationMs?: number }) =>
        runDefaultExitAnimation(
          elementsRef.current,
          nextInitialMap,
          controller,
          options
        );

      if (currentStep.exit) {
        const exitContext: StepExitContext = {
          currentElements: elementsRef.current,
          nextInitialElements: nextInitialMap,
          controller,
          runDefaultExit,
        };
        await currentStep.exit(exitContext);
      } else {
        await runDefaultExit();
      }

      if (abortController.signal.aborted) return;

      // Advance URL hash to #step-(nextIndex+1) and enter next step with canonical initial state
      setStepIndexAndHash(nextIndex);
      await enterStep(nextIndex);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(`Error in step ${stepIndex + 1} exit():`, err);
        setStepIndexAndHash(nextIndex);
        await enterStep(nextIndex);
      }
    }
  }, [
    phase,
    stepIndex,
    totalSteps,
    steps,
    cancelActiveAnimation,
    createController,
    setStepIndexAndHash,
    enterStep,
  ]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1, 'back');
  }, [stepIndex, goToStep]);

  /**
   * Allows interactive canvas elements (such as the Fold/Unfold toggle switch or draggable point C)
   * to update their own internal state once `play` has completed.
   */
  const updateInteractiveElementState = useCallback(
    (elementId: string, statePatch: Record<string, any>) => {
      updateElements((prev) => {
        const target = prev[elementId];
        if (!target) return prev;
        const interpolator = getInterpolatorForType(target.type);
        return {
          ...prev,
          [elementId]: {
            ...target,
            transitionDurationMs: 350,
            state: interpolator(target.state, statePatch, 1),
          },
        };
      });
    },
    [updateElements, getInterpolatorForType]
  );

  const currentStep = steps[stepIndex];
  const hasPlayAnimation = Boolean(currentStep?.play);
  const isAnimating = phase === 'playing' || phase === 'exiting';

  return {
    currentStepIndex: stepIndex,
    currentStep,
    totalSteps,
    elements,
    phase,
    isAnimating,
    hasPlayAnimation,
    canGoBack: stepIndex > 0 && phase !== 'exiting',
    canGoNext: stepIndex < totalSteps - 1 && !isAnimating,
    canReplay: hasPlayAnimation && !isAnimating,
    goNext,
    goBack,
    goToStep,
    replayCurrentStep,
    updateInteractiveElementState,
  };
}
