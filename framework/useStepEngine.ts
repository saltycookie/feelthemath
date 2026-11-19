import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DemoConfig,
  Scene,
  ScenePatch,
  StateInterpolator,
  StepAnimationController,
  StepExitContext,
} from './types';
import {
  cloneScene,
  DEFAULT_EXIT_DURATION_MS,
  isSharedAtSamePosition,
  resolveDemoSteps,
  resolveSceneRendererEntry,
  runStepTimeline,
} from './stepTimeline';
import { clamp01, easeInOut, easeOut } from './math';
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
  const clamped = clamp01(t);
  if (easingName === 'linear') {
    return clamped;
  }
  if (easingName === 'ease-in') {
    return clamped * clamped * clamped;
  }
  if (easingName === 'ease-in-out') {
    return easeInOut(clamped);
  }
  // Default cubic-out (matches cubic-bezier(0.22, 1, 0.36, 1) closely)
  return easeOut(clamped);
}

/**
 * Default fallback state interpolator when a scene type does not register a custom
 * `interpolateState` function:
 * - Linearly interpolates any numeric properties in `targetPatch` from `startState[key]` to `targetPatch[key]`.
 * - Immediately applies non-numeric properties (booleans, strings, objects).
 */
const defaultStateInterpolator: StateInterpolator<Record<string, any>> = (
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
 * Merges only the keys touched by `targetPatch` (or modified by a custom interpolator) onto `currentState`,
 * so concurrent `parallel` cues on distinct keys never clobber each other.
 */
function mergeInterpolatedState(
  currentState: Record<string, any>,
  startState: Record<string, any>,
  targetPatch: Record<string, any>,
  interpolated: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...currentState };
  for (const key of Object.keys(interpolated)) {
    if (key in targetPatch || interpolated[key] !== startState[key]) {
      merged[key] = interpolated[key];
    }
  }
  return merged;
}

const TOP_MESSAGE_DELAY_MS = 500;
const MESSAGE_FADE_MS = 250;

/**
 * Core state-machine hook for the step-by-step math demo framework.
 *
 * Enforces all architectural invariants:
 * 1. Bottom Navigation Panel state (Back, Replay, Next, Dots, #step-X URL sync).
 * 2. Canvas active scene & title synchronization (one active scene per step).
 * 3. Initial scene rendered immediately on step entry, followed by `play` animation
 *    (disabling Next while `play` is running, disabling Replay when step has no `play`).
 * 4. `exit` animation when clicking Next (default 250ms fade-out when switching scenes,
 *    intact preservation when staying on the same scene at the same position, or custom step `exit`).
 * 5. Deterministic beginning state for every step regardless of whether entered via URL/#step-X,
 *    navigation dots, Back button, or Next button.
 * 6. Per-scene-type custom `interpolateState(startState, targetPatch, progress)` called via
 *    `requestAnimationFrame` during `animateScene`.
 */
export function useStepEngine(demo: DemoConfig<any>) {
  const steps = useMemo(() => resolveDemoSteps(demo), [demo]);
  const totalSteps = steps.length;

  const abortControllerRef = useRef<AbortController | null>(null);
  const sceneRef = useRef<Scene<any> | null>(null);

  const initialIdx =
    typeof window !== 'undefined'
      ? parseStepHash(window.location.hash, totalSteps) ?? 0
      : 0;

  const [scene, setSceneState] = useState<Scene<any> | null>(() => {
    const initial = steps[initialIdx]?.initialScene
      ? cloneScene(steps[initialIdx].initialScene)
      : null;
    sceneRef.current = initial;
    return initial;
  });

  const [messageVisibility, setMessageVisibility] = useState<{
    topOpacity: number;
    bottomOpacity: number;
  }>({ topOpacity: 0, bottomOpacity: 0 });

  const [phase, setPhase] = useState<StepLifecyclePhase>(() => {
    const s = steps[initialIdx];
    return s?.play || s?.topMessage !== undefined || s?.bottomMessage !== undefined
      ? 'playing'
      : 'idle';
  });

  const updateScene = useCallback(
    (updater: Scene<any> | null | ((prev: Scene<any> | null) => Scene<any> | null)) => {
      const next =
        typeof updater === 'function' ? updater(sceneRef.current) : updater;
      sceneRef.current = next;
      setSceneState(next);
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
   * Resolves the state interpolator for a given scene `type`:
   * 1. `demo.stateInterpolators[type]` if provided
   * 2. `demo.scenes[type].interpolateState` if attached to the renderer component
   * 3. `defaultStateInterpolator` fallback
   */
  const getInterpolatorForType = useCallback(
    (type: string): StateInterpolator<any> => {
      const entry = demo.scenes[type];
      const renderer = entry ? resolveSceneRendererEntry(entry).renderer : undefined;
      return (
        demo.stateInterpolators?.[type] ??
        renderer?.interpolateState ??
        defaultStateInterpolator
      );
    },
    [demo.stateInterpolators, demo.scenes]
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

      const getScene = () => sceneRef.current;

      const updateSceneImmediate = <TState = Record<string, any>>(
        patch: ScenePatch<TState>
      ) => {
        if (signal.aborted) return;
        updateScene((existing) => {
          if (!existing) return existing;
          const interpolator = getInterpolatorForType(existing.type);
          return {
            ...existing,
            x: patch.x !== undefined ? patch.x : existing.x,
            y: patch.y !== undefined ? patch.y : existing.y,
            opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
            scale: patch.scale !== undefined ? patch.scale : existing.scale,
            transitionDurationMs: 0,
            state: patch.state
              ? interpolator(existing.state, patch.state, 1)
              : existing.state,
          };
        });
      };

      const animateScene = async <TState = Record<string, any>>(
        patch: ScenePatch<TState>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        const durationMs = options?.durationMs ?? 450;
        const easing = options?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';

        const current = sceneRef.current;
        if (!current) return;

        const statePatch = patch.state;
        const startState = statePatch ? structuredClone(current.state) : null;

        // 1. Immediately apply outer CSS-transitioned properties (x, y, opacity, scale)
        //    and initial frame (progress = 0) of any state patch
        updateScene((existing) => {
          if (!existing) return existing;
          const interpolator = getInterpolatorForType(existing.type);
          let nextState = existing.state;
          if (statePatch && startState) {
            const interpolated = interpolator(
              startState,
              statePatch,
              durationMs <= 0 ? 1 : 0
            );
            nextState = mergeInterpolatedState(
              existing.state,
              startState,
              statePatch,
              interpolated
            );
          }
          return {
            ...existing,
            x: patch.x !== undefined ? patch.x : existing.x,
            y: patch.y !== undefined ? patch.y : existing.y,
            opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
            scale: patch.scale !== undefined ? patch.scale : existing.scale,
            transitionDurationMs: durationMs,
            transitionEasing: easing,
            state: nextState,
          };
        });

        if (durationMs <= 0) {
          return;
        }

        // 2. If no `state` patch was provided, CSS transitions handle x/y/opacity/scale
        if (!statePatch || !startState) {
          await wait(durationMs);
          return;
        }

        // 3. Otherwise, run a requestAnimationFrame loop over `durationMs` calling the
        //    scene type's `interpolateState(startState, targetPatch, easedProgress)`
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

            updateScene((existing) => {
              if (!existing) return existing;
              const interpolator = getInterpolatorForType(existing.type);
              const interpolated = interpolator(
                startState,
                statePatch,
                easedProgress
              );
              return {
                ...existing,
                state: mergeInterpolatedState(
                  existing.state,
                  startState,
                  statePatch,
                  interpolated
                ),
              };
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

      return {
        signal,
        wait,
        getScene,
        animateScene,
        updateSceneImmediate,
      };
    },
    [updateScene, getInterpolatorForType]
  );

  /**
   * Enters `targetStepIndex` by setting its deterministic canonical `initialScene`
   * and running its message / `play` sequence:
   * - `topMessage` fades in first, followed 500ms later by `play`, then `bottomMessage`.
   */
  const enterStep = useCallback(
    async (targetStepIndex: number) => {
      cancelActiveAnimation();
      const step = steps[targetStepIndex];
      if (!step) return;

      // Always set exact canonical beginning state for the step
      updateScene(cloneScene(step.initialScene));
      setMessageVisibility({ topOpacity: 0, bottomOpacity: 0 });

      const hasTop = step.topMessage !== undefined;
      const hasBottom = step.bottomMessage !== undefined;
      const hasPlay = Boolean(step.play);

      if (!hasTop && !hasBottom && !hasPlay) {
        setPhase('idle');
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setPhase('playing');

      try {
        const controller = createController(abortController.signal);
        const arrival = waitForBoxArrival();

        if (hasTop) {
          // Allow initial opacity: 0 frame to paint so CSS 250ms fade-in triggers cleanly
          await controller.wait(20);
          setMessageVisibility((prev) => ({ ...prev, topOpacity: 1 }));
        }

        if (arrival) {
          await arrival;
          await controller.wait(250);
        } else if (!hasTop) {
          // Small frame delay so initialScene paints cleanly before play/bottomMessage starts
          await controller.wait(40);
        }

        if (hasTop) {
          if (hasPlay || hasBottom) {
            await controller.wait(TOP_MESSAGE_DELAY_MS);
          } else if (!arrival) {
            await controller.wait(MESSAGE_FADE_MS);
          }
        }

        if (step.play) {
          if (typeof step.play === 'function') {
            await step.play(controller);
          } else {
            await runStepTimeline(step.play, controller, demo, step.sceneId);
          }
        }

        if (hasBottom && !abortController.signal.aborted) {
          setMessageVisibility((prev) => ({ ...prev, bottomOpacity: 1 }));
          await controller.wait(MESSAGE_FADE_MS);
        }

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
    [demo, steps, cancelActiveAnimation, updateScene, createController]
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
   * Resets current step to its canonical `initialScene` and replays its message/`play` sequence.
   */
  const replayCurrentStep = useCallback(() => {
    const currentStep = steps[stepIndex];
    const hasAnim = Boolean(
      currentStep?.play ||
        currentStep?.topMessage !== undefined ||
        currentStep?.bottomMessage !== undefined
    );
    if (!hasAnim || phase !== 'idle') return;
    enterStep(stepIndex);
  }, [steps, stepIndex, phase, enterStep]);

  /**
   * Next button handler:
   * - Disabled when `phase !== 'idle'` (i.e., while `play` or `exit` is ongoing).
   * - Fades out any top/bottom messages in 250ms in parallel with the current step's
   *   `exit` function/cues (and default 250ms fade-out when switching scenes).
   * - Then commits next step's canonical `initialScene`, updates URL to `#step-(X+1)`,
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

    const nextInitialScene = cloneScene(nextStep.initialScene);
    const controller = createController(abortController.signal);
    const hasMessages = Boolean(
      currentStep.topMessage !== undefined || currentStep.bottomMessage !== undefined
    );
    if (hasMessages) {
      setMessageVisibility({ topOpacity: 0, bottomOpacity: 0 });
    }

    try {
      const runDefaultExit = async (options?: { durationMs?: number }) => {
        const currentScene = sceneRef.current;
        if (!currentScene || isSharedAtSamePosition(currentScene, nextInitialScene)) {
          return;
        }
        const durationMs = options?.durationMs ?? DEFAULT_EXIT_DURATION_MS;
        if (durationMs > 0) {
          await controller.animateScene({ opacity: 0 }, { durationMs, easing: 'ease-out' });
        }
        if (!abortController.signal.aborted) {
          updateScene(null);
        }
      };

      const runSceneExit = async () => {
        if (currentStep.exit) {
          if (typeof currentStep.exit === 'function') {
            const exitContext: StepExitContext = {
              currentScene: sceneRef.current,
              nextInitialScene,
              controller,
              runDefaultExit,
            };
            await currentStep.exit(exitContext);
          } else {
            await runStepTimeline(currentStep.exit, controller, demo, currentStep.sceneId);
            await runDefaultExit();
          }
        } else {
          await runDefaultExit();
        }
      };

      await Promise.all([
        runSceneExit(),
        hasMessages ? controller.wait(MESSAGE_FADE_MS) : Promise.resolve(),
      ]);

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
    demo,
    phase,
    stepIndex,
    totalSteps,
    steps,
    cancelActiveAnimation,
    createController,
    updateScene,
    setStepIndexAndHash,
    enterStep,
  ]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1, 'back');
  }, [stepIndex, goToStep]);

  /**
   * Allows interactive canvas controls (such as the Fold/Unfold toggle switch or draggable point)
   * to update the active scene's state directly.
   */
  const updateInteractiveSceneState = useCallback(
    (statePatch: Record<string, any>) => {
      updateScene((target) => {
        if (!target) return target;
        const interpolator = getInterpolatorForType(target.type);
        return {
          ...target,
          state: interpolator(target.state, statePatch, 1),
        };
      });
    },
    [updateScene, getInterpolatorForType]
  );

  const currentStep = steps[stepIndex];
  const hasPlayAnimation = Boolean(
    currentStep?.play ||
      currentStep?.topMessage !== undefined ||
      currentStep?.bottomMessage !== undefined
  );
  const isAnimating = phase === 'playing' || phase === 'exiting';

  return {
    currentStepIndex: stepIndex,
    currentStep,
    totalSteps,
    scene,
    topMessageOpacity: messageVisibility.topOpacity,
    bottomMessageOpacity: messageVisibility.bottomOpacity,
    phase,
    isAnimating,
    canGoBack: stepIndex > 0 && phase !== 'exiting',
    canGoNext: stepIndex < totalSteps - 1 && !isAnimating,
    canReplay: hasPlayAnimation && !isAnimating,
    goNext,
    goBack,
    goToStep,
    replayCurrentStep,
    updateInteractiveSceneState,
  };
}
